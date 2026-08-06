"""Safe execution of natural-language-derived SQL.

DataFrames are loaded into an in-memory SQLite database. Column names are
remapped to safe aliases (c0, c1, ...) so the LLM only ever works with
generated identifiers, and every query passes a validation gate that only
allows a single read-only SELECT statement.
"""

from __future__ import annotations

import re
import sqlite3

import pandas as pd

_MAX_ROWS = 500
_MAX_COLUMNS = 20
_MAX_SELECT_LENGTH = 4000

_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|create|alter|attach|detach|pragma|vacuum|"
    r"replace|grant|revoke|load_extension|union|select\s+.*\binfo|"
    r"sqlite_|into|begin|commit|rollback)\b",
    re.IGNORECASE,
)


class QueryError(Exception):
    pass


def _clean_query(sql: str) -> str:
    # Strip comments
    sql = re.sub(r"--[^\n]*", "", sql)
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    sql = sql.strip().rstrip(";").strip()
    if len(sql) > _MAX_SELECT_LENGTH:
        raise QueryError("Generated query is too long.")
    return sql


def validate_select(sql: str) -> str:
    sql = _clean_query(sql)
    if not sql.lower().startswith("select"):
        raise QueryError("Only SELECT queries are allowed.")
    if ";" in sql:
        raise QueryError("Multiple statements are not allowed.")
    if _FORBIDDEN.search(sql):
        raise QueryError("Query contains disallowed operations.")
    if not re.search(r"\blimit\s+\d+", sql.lower()):
        sql += "\nLIMIT 500"
    return sql


def build_schema_map(df: pd.DataFrame) -> dict[str, str]:
    """Map safe SQL aliases (c0, c1, ...) to the original column names."""
    return {f"c{i}": str(col) for i, col in enumerate(df.columns)}


def _build_schema_map(df: pd.DataFrame) -> dict[str, str]:
    return build_schema_map(df)


def _infer_sql_type(series: pd.Series) -> str:
    if pd.api.types.is_integer_dtype(series):
        return "INTEGER"
    if pd.api.types.is_float_dtype(series):
        return "REAL"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "TEXT"
    if pd.api.types.is_bool_dtype(series):
        return "INTEGER"
    return "TEXT"


def _load_sqlite(df: pd.DataFrame) -> tuple[sqlite3.Connection, dict[str, str]]:
    conn = sqlite3.connect(":memory:")
    alias_map = _build_schema_map(df)
    aliased = pd.DataFrame(
        {alias: df[orig].tolist() for alias, orig in alias_map.items()}
    )
    aliased.to_sql("data", conn, if_exists="replace", index=False)
    return conn, alias_map


def run_query(df: pd.DataFrame, sql: str) -> dict:
    """Execute a validated query against an in-memory copy of the dataset."""
    sql = validate_select(sql)
    conn, alias_map = _load_sqlite(df)
    try:
        cur = conn.execute(sql)
        names = [d[0] for d in cur.description][:_MAX_COLUMNS]
        rows = [list(r)[:_MAX_COLUMNS] for r in cur.fetchall()[:_MAX_ROWS]]
    except sqlite3.Error as exc:
        raise QueryError(f"Query execution failed: {exc}") from exc
    finally:
        conn.close()

    def safe(v):
        if v is None:
            return None
        if isinstance(v, (int, float, bool)):
            if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf"))):
                return None
            return v
        return str(v)

    # Map aliases back to the original column names for display.
    display = [
        {"name": alias_map.get(n, n), "values": [safe(v) for v in row]}
        for n, row in zip(names, zip(*rows)) if row
    ] if rows else []
    return {
        "columns": [alias_map.get(n, n) for n in names],
        "rows": [[safe(v) for v in row] for row in rows],
        "row_count": len(rows),
    }
