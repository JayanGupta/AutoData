from __future__ import annotations

import io
import json
import os
import sqlite3
import threading
import zlib
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

# Overridable so deployments can point the session database at a persistent
# disk (e.g. AUTODATA_DATA_DIR=/opt/data on Render) instead of the ephemeral
# package directory.
DATA_DIR = Path(os.getenv("AUTODATA_DATA_DIR", str(Path(__file__).resolve().parents[1] / "data")))
DB_PATH = DATA_DIR / "sessions.db"
_LOCK = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at REAL NOT NULL,
    last_access REAL NOT NULL,
    csv BLOB NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    file_type TEXT NOT NULL DEFAULT '',
    favorite INTEGER NOT NULL DEFAULT 0,
    owner TEXT
);
CREATE TABLE IF NOT EXISTS session_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    step INTEGER NOT NULL,
    description TEXT NOT NULL,
    csv BLOB NOT NULL,
    UNIQUE(session_id, step)
);
CREATE TABLE IF NOT EXISTS session_conversation (
    session_id TEXT PRIMARY KEY,
    messages TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS session_dashboards (
    session_id TEXT PRIMARY KEY,
    layout TEXT NOT NULL,
    updated_at REAL NOT NULL
);
"""


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def initialize_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _LOCK:
        conn = _get_connection()
        conn.executescript(_SCHEMA)
        _migrate(conn)
        conn.commit()
        conn.close()


def _migrate(conn: sqlite3.Connection) -> None:
    """Add columns introduced after the initial schema, if missing."""
    existing = {row[1] for row in conn.execute("PRAGMA table_info(sessions)").fetchall()}
    if "file_size" not in existing:
        conn.execute("ALTER TABLE sessions ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0")
    if "file_type" not in existing:
        conn.execute("ALTER TABLE sessions ADD COLUMN file_type TEXT NOT NULL DEFAULT ''")
    if "favorite" not in existing:
        conn.execute("ALTER TABLE sessions ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0")
    if "owner" not in existing:
        conn.execute("ALTER TABLE sessions ADD COLUMN owner TEXT")


_FRAME_VERSION = b"autodata-json-1\n"


def _encode_value(value):
    if value is pd.NA:
        return {"type": "missing"}
    if value is pd.NaT:
        return {"type": "nat"}
    if isinstance(value, Decimal):
        return {"type": "decimal", "value": str(value)}
    if isinstance(value, (pd.Timedelta, timedelta)):
        return {"type": "duration", "value": pd.Timedelta(value).isoformat()}
    if isinstance(value, (datetime, date, time)):
        return {"type": type(value).__name__, "value": value.isoformat()}
    if isinstance(value, np.generic):
        return value.item()
    raise TypeError(f"Unsupported dataset value type: {type(value).__name__}")


def _decode_value(value):
    kind = value["type"]
    if kind == "missing":
        return pd.NA
    if kind == "nat":
        return pd.NaT
    if kind == "Timestamp":
        return pd.Timestamp(value["value"])
    if kind == "duration":
        return pd.Timedelta(value["value"])
    parser = {"datetime": datetime.fromisoformat, "date": date.fromisoformat,
              "time": time.fromisoformat, "decimal": Decimal}[kind]
    return parser(value["value"])


def _df_to_bytes(df: pd.DataFrame) -> bytes:
    columns = [
        [name, str(df[name].dtype), df[name].tolist()]
        for name in df.columns
    ]
    payload = json.dumps([len(df), columns], default=_encode_value, ensure_ascii=False, separators=(",", ":"))
    return _FRAME_VERSION + zlib.compress(payload.encode("utf-8"), level=1)


def _bytes_to_df(data: bytes) -> pd.DataFrame:
    if not data.startswith(_FRAME_VERSION):
        return pd.read_csv(io.BytesIO(data))
    length, columns = json.loads(zlib.decompress(data[len(_FRAME_VERSION):]), object_hook=_decode_value)
    restored = {}
    for name, dtype, values in columns:
        if dtype.startswith("datetime64") and "," in dtype:
            values = pd.to_datetime(values, utc=True)
        restored[name] = pd.Series(values, dtype=dtype)
    return pd.DataFrame(restored, index=pd.RangeIndex(length))


def dump_session(session_id: str, name: str, created_at: float, last_access: float,
                 df: pd.DataFrame, history: list[dict], conversation: list[dict],
                 file_size: int = 0, file_type: str = "", favorite: bool = False, owner: str | None = None) -> None:
    """Persist a session: current dataframe, cleaning history and conversation.

    `history` is a list of {"df": DataFrame, "description": str}.
    """
    with _LOCK:
        conn = _get_connection()
        conn.execute(
            "REPLACE INTO sessions (id, name, created_at, last_access, csv, file_size, file_type, favorite, owner)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (session_id, name, created_at, last_access, sqlite3.Binary(_df_to_bytes(df)),
             file_size, file_type, 1 if favorite else 0, owner),
        )
        conn.execute("DELETE FROM session_history WHERE session_id = ?", (session_id,))
        conn.executemany(
            "INSERT INTO session_history (session_id, step, description, csv) VALUES (?, ?, ?, ?)",
            [
                (session_id, i, entry["description"], sqlite3.Binary(_df_to_bytes(entry["df"])))
                for i, entry in enumerate(history)
            ],
        )
        conn.execute("DELETE FROM session_conversation WHERE session_id = ?", (session_id,))
        conn.execute(
            "INSERT OR REPLACE INTO session_conversation (session_id, messages) VALUES (?, ?)",
            (session_id, json.dumps(conversation)),
        )
        conn.commit()
        conn.close()


def load_session(session_id: str) -> dict[str, Any] | None:
    """Load a session as raw data. Returns None if missing.

    Result keys: id, name, created_at, last_access, df, history, conversation,
    file_size, file_type, favorite.
    """
    with _LOCK:
        conn = _get_connection()
        row = conn.execute(
            "SELECT id, name, created_at, last_access, csv, file_size, file_type, favorite, owner"
            " FROM sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        if row is None:
            conn.close()
            return None
        hist_rows = conn.execute(
            "SELECT step, description, csv FROM session_history WHERE session_id = ? ORDER BY step",
            (session_id,),
        ).fetchall()
        conv_row = conn.execute(
            "SELECT messages FROM session_conversation WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        conn.close()

    return {
        "id": row[0],
        "name": row[1],
        "created_at": row[2],
        "last_access": row[3],
        "df": _bytes_to_df(row[4]),
        "file_size": row[5] if len(row) > 5 else 0,
        "file_type": row[6] if len(row) > 6 else "",
        "favorite": bool(row[7]),
        "owner": row[8],
        "history": [
            {"df": _bytes_to_df(h[2]), "description": h[1]}
            for h in hist_rows
        ],
        "conversation": json.loads(conv_row[0]) if conv_row else [],
    }


def touch_session(session_id: str, last_access: float) -> None:
    with _LOCK:
        conn = _get_connection()
        try:
            with conn:
                conn.execute("UPDATE sessions SET last_access = ? WHERE id = ?", (last_access, session_id))
        finally:
            conn.close()


def delete_session(session_id: str) -> bool:
    with _LOCK:
        conn = _get_connection()
        cur = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        deleted = cur.rowcount > 0
        conn.execute("DELETE FROM session_history WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM session_conversation WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM session_dashboards WHERE session_id = ?", (session_id,))
        conn.commit()
        conn.close()
        return deleted


def save_dashboard_layout(session_id: str, layout: dict) -> None:
    import time
    with _LOCK:
        conn = _get_connection()
        conn.execute(
            "INSERT OR REPLACE INTO session_dashboards (session_id, layout, updated_at) VALUES (?, ?, ?)",
            (session_id, json.dumps(layout), time.time()),
        )
        conn.commit()
        conn.close()


def load_dashboard_layout(session_id: str) -> dict | None:
    with _LOCK:
        conn = _get_connection()
        row = conn.execute(
            "SELECT layout FROM session_dashboards WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        conn.close()
    if row and row[0]:
        try:
            return json.loads(row[0])
        except Exception:
            return None
    return None


def list_session_records() -> list[dict[str, Any]]:
    with _LOCK:
        conn = _get_connection()
        rows = conn.execute(
            "SELECT id, name, created_at, last_access, file_size, file_type, favorite"
            " FROM sessions ORDER BY created_at DESC"
        ).fetchall()
        conn.close()
    return [
        {"id": r[0], "name": r[1], "created_at": r[2], "last_access": r[3],
         "file_size": r[4] if len(r) > 4 else 0,
         "file_type": r[5] if len(r) > 5 else "",
         "favorite": bool(r[6]) if len(r) > 6 else False}
        for r in rows
    ]
