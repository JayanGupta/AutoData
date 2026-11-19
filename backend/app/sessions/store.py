"""Dataset sessions and cleaning history backed by SQLite."""

from __future__ import annotations

import logging
import threading
import time
import uuid

from .. import config
from ..data_engine import analyze
from ..data_engine.cleaning import prepare_clean
from ..data_engine.engine import EngineResult
from ..data_store import storage
from ..workspace import can_access, workspace_owner

logger = logging.getLogger(__name__)


class DatasetSession:
    def __init__(
        self,
        session_id: str,
        name: str,
        engine: EngineResult,
        created_at: float,
        history: list[dict] | None = None,
        conversation: list[dict] | None = None,
        file_size: int = 0,
        file_type: str = "",
        favorite: bool = False,
        owner: str | None = None,
    ):
        self.clean_lock = threading.Lock()
        self.id = session_id
        self.name = name
        self.engine = engine
        self.created_at = created_at
        self.last_access = created_at
        self.file_size = file_size
        self.file_type = file_type
        self.favorite = favorite
        self.owner = owner
        # history entries: {"engine": EngineResult, "description": str}
        self.history = history or []
        self.conversation = conversation or []

    def touch(self):
        self.last_access = time.time()

    def expired(self, now: float) -> bool:
        return now - self.last_access > config.SESSION_TTL_SECONDS

    def apply_clean(self, action: str, params: dict) -> tuple[EngineResult, str]:
        new_df, description = prepare_clean(self.engine.df, action, params)
        next_engine = analyze(new_df.reset_index(drop=True))
        self.history.append({"engine": self.engine, "description": description})
        self.engine = next_engine
        return self.engine, description

    def undo_clean(self) -> tuple[EngineResult, str] | None:
        if not self.history:
            return None
        entry = self.history.pop()
        self.engine = entry["engine"]
        return self.engine, entry["description"]

    def cleaning_history(self) -> list[dict]:
        return [
            {"description": h["description"], "step": i}
            for i, h in enumerate(self.history)
        ]

    @staticmethod
    def from_data(session_id: str, name: str, created_at: float, last_access: float,
                  df, history: list[dict], conversation: list[dict],
                  file_size: int = 0, file_type: str = "", favorite: bool = False, owner: str | None = None) -> "DatasetSession":
        """Reconstruct a session from persisted raw data (df + history dfs)."""
        engine = analyze(df)
        session = DatasetSession(session_id, name, engine, created_at, None, conversation,
                                 file_size=file_size, file_type=file_type, favorite=favorite, owner=owner)
        session.last_access = last_access
        session.history = [
            {"engine": analyze(entry["df"]), "description": entry["description"]}
            for entry in history
        ]
        return session


class SessionStore:
    def __init__(self):
        self._sessions: dict[str, DatasetSession] = {}
        self._lock = threading.Lock()
        storage.initialize_db()
        self._load_persisted()

    def _load_persisted(self) -> None:
        now = time.time()
        for record in storage.list_session_records():
            try:
                data = storage.load_session(record["id"])
                if data is None:
                    continue
                session = DatasetSession.from_data(
                    data["id"], data["name"], data["created_at"],
                    data["last_access"], data["df"], data["history"], data["conversation"],
                    file_size=data.get("file_size", 0),
                    file_type=data.get("file_type", ""),
                    favorite=data.get("favorite", False),
                    owner=data["owner"],
                )
                if not session.expired(now):
                    self._sessions[session.id] = session
                else:
                    storage.delete_session(session.id)
            except Exception:
                logger.exception("Could not load dataset %s", record["id"])

    def _persist(self, session: DatasetSession) -> None:
        storage.dump_session(
            session.id,
            session.name,
            session.created_at,
            session.last_access,
            session.engine.df,
            [{"df": h["engine"].df, "description": h["description"]} for h in session.history],
            session.conversation,
            file_size=session.file_size,
            file_type=session.file_type,
            favorite=session.favorite,
            owner=session.owner,
        )

    def persist(self, session: DatasetSession) -> None:
        """Public helper to persist an in-memory session after mutation."""
        with self._lock:
            if self._sessions.get(session.id) is session and can_access(session.owner):
                self._persist(session)

    def create(self, name: str, engine: EngineResult, file_size: int = 0,
               file_type: str = "") -> DatasetSession:
        with self._lock:
            session_id = uuid.uuid4().hex
            session = DatasetSession(session_id, name, engine, time.time(),
                                     file_size=file_size, file_type=file_type, owner=workspace_owner.get())
            self._persist(session)
            self._sessions[session_id] = session
            self._evict_expired()
            return session

    def get(self, session_id: str) -> DatasetSession | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None or not can_access(session.owner):
                return None
            if session.expired(time.time()):
                storage.delete_session(session_id)
                del self._sessions[session_id]
                return None
            session.touch()
            storage.touch_session(session_id, session.last_access)
            return session

    def delete(self, session_id: str) -> bool:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None or not can_access(session.owner):
                return False
            storage.delete_session(session_id)
            del self._sessions[session_id]
            return True

    def rename(self, session_id: str, new_name: str) -> DatasetSession | None:
        new_name = (new_name or "").strip()
        if not new_name:
            raise ValueError("Name cannot be empty.")
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None or not can_access(session.owner):
                return None
            session.name = new_name
            self._persist(session)
            return session

    def set_favorite(self, session_id: str, favorite: bool) -> DatasetSession | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None or not can_access(session.owner):
                return None
            session.favorite = bool(favorite)
            self._persist(session)
            return session

    def duplicate(self, session_id: str) -> DatasetSession | None:
        """Clone an existing session into a new independent session."""
        with self._lock:
            source = self._sessions.get(session_id)
            if source is None or not can_access(source.owner):
                return None
            new_id = uuid.uuid4().hex
            dup_name = f"{source.name} (copy)"
            engine = analyze(source.engine.df.copy())
            session = DatasetSession(
                new_id, dup_name, engine, time.time(),
                conversation=[dict(m) for m in source.conversation],
                file_size=source.file_size, file_type=source.file_type, favorite=False, owner=workspace_owner.get(),
            )
            self._persist(session)
            self._sessions[new_id] = session
            self._evict_expired()
            return session

    def list_sessions(self) -> list[dict]:
        with self._lock:
            self._evict_expired()
            from ..ai.executive import build_snippet
            return [
                {
                    "id": s.id,
                    "name": s.name,
                    "created_at": s.created_at,
                    "last_access": s.last_access,
                    "rows": s.engine.summary["row_count"],
                    "columns": s.engine.summary["column_count"],
                    "quality_score": s.engine.quality["summary"]["quality_score"],
                    "file_size": s.file_size,
                    "file_type": s.file_type,
                    "favorite": s.favorite,
                    "snippet": build_snippet(s.engine),
                }
                for s in self._sessions.values() if can_access(s.owner)
            ]

    def _evict_expired(self):
        now = time.time()
        expired = [sid for sid, s in self._sessions.items() if s.expired(now)]
        for sid in expired:
            self._sessions.pop(sid, None)
            storage.delete_session(sid)


store = SessionStore()
