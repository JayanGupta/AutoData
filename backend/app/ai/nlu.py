"""Natural-language question answering.

Two modes:
1. LLM mode (when USER_LLM_API_KEY is configured): the LLM writes a SQL
   SELECT query against the dataset, we validate and execute it, then the LLM
   interprets the *actual* query results. The model never invents numbers
   because it only summarises what the query returned.
2. Local mode: a deterministic rule-based analyst (see local_analyst.py).
"""

from __future__ import annotations

import json

from .. import config
from ..data_engine.profiler import NUMERIC_TYPES
from . import llm_client, local_analyst, sql_runner

TYPE_DATETIME = "datetime"


def _schema_context(engine) -> str:
    lines = ["The dataset table is named `data`. Columns:"]
    for col in engine.columns:
        kind = col["inferred_type"]
        extra = ""
        if kind in NUMERIC_TYPES:
            s = col.get("stats", {})
            if s:
                extra = f" range [{s.get('min')} .. {s.get('max')}], mean {s.get('mean')}"
        elif kind == TYPE_DATETIME:
            s = col.get("stats", {})
            extra = f" range {s.get('min')} .. {s.get('max')}" if s else ""
        else:
            top = col.get("top_k", [])
            if top:
                extra = " top values " + ", ".join(f"'{t['value']}'" for t in top[:4])
        lines.append(f"- {col['name']} ({kind}){extra}")
    lines.append(
        f"The dataset has {engine.summary['row_count']:,} rows. "
        "Use SQL aggregate functions (COUNT, SUM, AVG, MIN, MAX, GROUP BY) "
        "and always quote column names with double quotes."
    )
    return "\n".join(lines)


def _generate_sql(question: str, engine) -> str:
    messages = [
        {
            "role": "system",
            "content": (
                "You translate user questions into a single read-only SQL SELECT query for "
                "a SQLite table named `data`. Return ONLY the SQL, no markdown, no comments, "
                "no semicolon. Always use double quotes around column names. Prefer GROUP BY "
                "aggregations; add ORDER BY ... DESC/LIMIT when ranking."
            ),
        },
        {"role": "user", "content": f"Schema:\n{_schema_context(engine)}\n\nQuestion: {question}\nSQL:"},
    ]
    sql = llm_client.chat(messages, max_tokens=300)
    return sql_runner.validate_select(sql)


def _interpret(question: str, query_result: dict, engine) -> dict:
    table_text = "\n".join(
        " | ".join(str(v) for v in row) for row in query_result["rows"][:15]
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are a precise data analyst. Answer the user's question based ONLY on the "
                "query result table. Never invent numbers. Respond with valid JSON: "
                '{"answer": "<2-3 sentence direct answer citing the numbers>", '
                '"numbers": [{"label": "...", "value": "..."}], '
                '"explanation": "<1 sentence explaining how it was computed>"}. '
                "If the result is empty, say the dataset contains no matching records."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Question: {question}\n"
                f"Result columns: {query_result['columns']}\n"
                f"Result rows:\n{table_text}\n"
                "JSON:"
            ),
        },
    ]
    data = llm_client.chat_json(messages, max_tokens=500)
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object")
    return data


def _heuristic_chart(query_result: dict) -> dict | None:
    """Build a simple chart when the result is a group-by (2-3 columns)."""
    cols = query_result["columns"]
    rows = query_result["rows"]
    if not rows:
        return None
    if len(cols) == 2 and isinstance(rows[0][0], str):
        try:
            float(rows[0][1])
            return {
                "chart_type": "bar",
                "title": f"{cols[0]} by {cols[1]}",
                "x": "group",
                "y": "value",
                "data": [{"group": r[0], "value": r[1]} for r in rows[:15]],
            }
        except (TypeError, ValueError):
            return None
    return None


def answer(question: str, engine, memory: list[dict] | None = None) -> dict:
    """Answer a natural-language question, preferring LLM mode."""
    if config.llm_enabled():
        sql = None
        try:
            sql = _generate_sql(question, engine)
            result = sql_runner.run_query(engine.df, sql)
            interpretation = _interpret(question, result, engine)
            return {
                "answer": interpretation.get("answer", ""),
                "numbers": interpretation.get("numbers", []),
                "explanation": interpretation.get("explanation", ""),
                "intent": "llm",
                "mode": "llm",
                "sql": sql,
                "chart": _heuristic_chart(result),
                "query_result": {k: result[k] for k in ("columns", "rows", "row_count")},
                "related_insights": [],
            }
        except Exception:  # noqa: BLE001 - any LLM/query failure falls back to local mode
            pass

    return local_analyst.answer(question, engine, memory=memory)
