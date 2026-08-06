from __future__ import annotations

import sqlite3
import threading
from pathlib import Path
from typing import Any

from ..data_engine.engine import EngineResult

DB_PATH = Path(__file__).resolve().parents[1] / "sessions.db"
_LOCK = threading.Lock()

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    data BLOB NOT NULL
);
"""


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def initialize_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _LOCK:
        conn = _get_connection()
        conn.execute(CREATE_TABLE_SQL)
        conn.commit()
        conn.close()


def dump_session(session_id: str, payload: bytes) -> None:
    with _LOCK:
        conn = _get_connection()
        conn.execute(
            "REPLACE INTO sessions (id, data) VALUES (?, ?)",
            (session_id, sqlite3.Binary(payload)),
        )
        conn.commit()
        conn.close()


def delete_session(session_id: str) -> bool:
    with _LOCK:
        conn = _get_connection()
        cur = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        deleted = cur.rowcount > 0
        conn.commit()
        conn.close()
        return deleted


def list_session_records() -> list[dict[str, Any]]:
    with _LOCK:
        conn = _get_connection()
        rows = conn.execute("SELECT id, data FROM sessions").fetchall()
        conn.close()
    return [{"id": row[0], "data": row[1]} for row in rows]


def load_session_data(session_id: str) -> bytes | None:
    with _LOCK:
        conn = _get_connection()
        row = conn.execute("SELECT data FROM sessions WHERE id = ?", (session_id,)).fetchone()
        conn.close()
    return row[0] if row else None


def pickle_session(session: Any) -> bytes:
    import pickle

    return pickle.dumps(session, protocol=pickle.HIGHEST_PROTOCOL)


def unpickle_session(payload: bytes) -> Any:
    import pickle

    return pickle.loads(payload)
