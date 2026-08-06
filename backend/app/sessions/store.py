"""Persistent session store using SQLite backing (CSV + JSON, no pickle)."""

from __future__ import annotations

import threading
import time
import uuid

from .. import config
from ..data_engine import analyze
from ..data_engine.cleaning import OPERATIONS
from ..data_engine.engine import EngineResult
from ..data_store import storage


class DatasetSession:
    def __init__(
        self,
        session_id: str,
        name: str,
        engine: EngineResult,
        created_at: float,
        history: list[dict] | None = None,
        conversation: list[dict] | None = None,
    ):
        self.id = session_id
        self.name = name
        self.engine = engine
        self.created_at = created_at
        self.last_access = created_at
        # history entries: {"engine": EngineResult, "description": str}
        self.history = history or []
        self.conversation = conversation or []

    def touch(self):
        self.last_access = time.time()

    def expired(self, now: float) -> bool:
        return now - self.last_access > config.SESSION_TTL_SECONDS

    def apply_clean(self, action: str, params: dict) -> tuple[EngineResult, str]:
        op = OPERATIONS.get(action)
        if op is None:
            raise ValueError(f"Unknown cleaning action '{action}'.")
        try:
            new_df, description = op(self.engine.df, **params)
        except TypeError as exc:
            raise ValueError(f"Invalid parameters for '{action}': {exc}") from exc
        if len(new_df) == 0:
            raise ValueError("That cleaning step would leave the dataset empty.")
        self.history.append({"engine": self.engine, "description": description})
        self.engine = analyze(new_df)
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
                  df, history: list[dict], conversation: list[dict]) -> "DatasetSession":
        """Reconstruct a session from persisted raw data (df + history dfs)."""
        engine = analyze(df)
        session = DatasetSession(session_id, name, engine, created_at, None, conversation)
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
                )
                if not session.expired(now):
                    self._sessions[session.id] = session
                else:
                    storage.delete_session(session.id)
            except Exception:
                storage.delete_session(record["id"])

    def _persist(self, session: DatasetSession) -> None:
        storage.dump_session(
            session.id,
            session.name,
            session.created_at,
            session.last_access,
            session.engine.df,
            [{"df": h["engine"].df, "description": h["description"]} for h in session.history],
            session.conversation,
        )

    def persist(self, session: DatasetSession) -> None:
        """Public helper to persist an in-memory session after mutation."""
        with self._lock:
            self._persist(session)

    def create(self, name: str, engine: EngineResult) -> DatasetSession:
        with self._lock:
            session_id = uuid.uuid4().hex
            session = DatasetSession(session_id, name, engine, time.time())
            self._sessions[session_id] = session
            self._persist(session)
            self._evict_expired()
            return session

    def get(self, session_id: str) -> DatasetSession | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is not None:
                session.touch()
                self._persist(session)
            return session

    def delete(self, session_id: str) -> bool:
        with self._lock:
            deleted = self._sessions.pop(session_id, None) is not None
            if deleted:
                storage.delete_session(session_id)
            return deleted

    def list_sessions(self) -> list[dict]:
        with self._lock:
            self._evict_expired()
            return [
                {
                    "id": s.id,
                    "name": s.name,
                    "created_at": s.created_at,
                    "rows": s.engine.summary["row_count"],
                    "columns": s.engine.summary["column_count"],
                    "quality_score": s.engine.quality["summary"]["quality_score"],
                }
                for s in self._sessions.values()
            ]

    def _evict_expired(self):
        now = time.time()
        expired = [sid for sid, s in self._sessions.items() if s.expired(now)]
        for sid in expired:
            self._sessions.pop(sid, None)
            storage.delete_session(sid)


store = SessionStore()
