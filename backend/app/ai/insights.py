"""Rule-based insight generation.

Every insight is derived deterministically from the computed analysis - the
LLM is never asked to invent statistics. This module produces the "Generate
Insights" feature and the building blocks used by the NLQ responses.
"""

from __future__ import annotations

from ..data_engine import analysis
from ..data_engine.profiler import NUMERIC_TYPES

TYPE_DATETIME = "datetime"
TYPE_CATEGORICAL = "categorical"
TYPE_BOOLEAN = "boolean"

def _mk(category: str, severity: str, title: str, detail: str,
        numbers: list[dict] | None = None, evidence: dict | None = None,
        query_hint: str | None = None) -> dict:
    return {
        "id": "",
        "category": category,
        "severity": severity,
        "title": title,
        "detail": detail,
        "numbers": numbers or [],
        "evidence": evidence or {},
        "query_hint": query_hint,
    }


def _format_num(v) -> str:
    if v is None:
        return "n/a"
    try:
        f = float(v)
        if f == int(f) and abs(f) < 1e15:
            return f"{int(f):,}"
        return f"{f:,.2f}"
    except (TypeError, ValueError):
        return str(v)


def _chart_lookup(charts: list[dict], predicate) -> str | None:
    for c in charts:
        if predicate(c):
            return c["id"]
    return None


def generate_insights(engine: "object", limit: int = 12) -> list[dict]:
    """engine is a data_engine.EngineResult instance."""
    insights: list[dict] = []
    df = engine.df
    columns = engine.columns
    charts = engine.chart_suggestions
    summary = engine.summary

    numeric = [c for c in columns if c["inferred_type"] in NUMERIC_TYPES]
    categorical = [c for c in columns if c["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)]
    datetime_cols = [c for c in columns if c["inferred_type"] == TYPE_DATETIME]

    # --- Correlations -----------------------------------------------------
    for pair in engine.strong_correlations[:5]:
        kind = "positive" if pair["strength"] == "positive" else "negative"
        chart_id = _chart_lookup(charts, lambda c, p=pair:
            c["chart_type"] in ("scatter",) and {p["col_a"], p["col_b"]} <= {c["x"], c["y"]})
        insights.append(_mk(
            "correlation",
            "high" if abs(pair["correlation"]) >= 0.8 else "medium",
            f"Strong {kind} relationship: {pair['col_a']} and {pair['col_b']}",
            f"These two columns move together ({kind} correlation of "
            f"{pair['correlation']:.2f}). When one increases, the other "
            f"{'tends to increase as well' if pair['strength'] == 'positive' else 'tends to decrease'}.",
            numbers=[{"label": "correlation", "value": f"{pair['correlation']:.2f}"}],
            evidence={"chart_id": chart_id, "columns": [pair["col_a"], pair["col_b"]]},
            query_hint=f"How does {pair['col_a']} relate to {pair['col_b']}?",
        ))

    # --- Temporal trends --------------------------------------------------
    if datetime_cols and numeric:
        for dt in datetime_cols[:1]:
            for num in numeric[:2]:
                trend = analysis.temporal_trend(df, dt["name"], num["name"])
                if not trend:
                    continue
                chart_id = _chart_lookup(charts, lambda c, dt=dt, num=num:
                    c["chart_type"] == "line" and c["x"] == "date" and c["y"] == "value"
                    and num["name"] in c["title"])
                direction = "rising" if trend["direction"] == "up" else "falling"
                insights.append(_mk(
                    "trend",
                    "high" if abs(trend["change_pct"]) >= 30 else "medium",
                    f"{trend['value_col']} is {direction} over time",
                    f"Average {trend['value_col']} moved from {_format_num(trend['first_half_mean'])} "
                    f"to {_format_num(trend['second_half_mean'])} across the dataset "
                    f"({trend['change_pct']:+.1f}%).",
                    numbers=[
                        {"label": "early avg", "value": _format_num(trend["first_half_mean"])},
                        {"label": "recent avg", "value": _format_num(trend["second_half_mean"])},
                        {"label": "change", "value": f"{trend['change_pct']:+.1f}%"},
                    ],
                    evidence={"chart_id": chart_id, "columns": [dt["name"], num["name"]]},
                    query_hint=f"What is the trend of {num['name']} over time?",
                ))

    # --- Top / bottom performers ------------------------------------------
    if categorical and numeric:
        for cat in categorical[:1]:
            for num in numeric[:2]:
                ranked = analysis.grouped_aggregate(df, cat["name"], num["name"], agg="sum", limit=10)
                if len(ranked) < 2:
                    continue
                best, worst = ranked[0], ranked[-1]
                total = sum(r["value"] for r in ranked)
                top_share = best["value"] / total * 100 if total else 0
                chart_id = _chart_lookup(charts, lambda c, cat=cat, num=num:
                    c["chart_type"] == "bar" and c["x"] == "group" and c["y"] == "value"
                    and cat["name"] in c["title"])
                insights.append(_mk(
                    "comparison",
                    "medium",
                    f"{best['group']} leads {num['name']}",
                    f"Top contributor among {cat['name']} is '{best['group']}' with "
                    f"{_format_num(best['value'])} total {num['name']} "
                    f"({top_share:.0f}% of the top-{len(ranked)} groups). "
                    f"Lowest is '{worst['group']}' at {_format_num(worst['value'])}.",
                    numbers=[
                        {"label": f"best ({best['group'][:18]})", "value": _format_num(best["value"])},
                        {"label": f"lowest ({worst['group'][:18]})", "value": _format_num(worst["value"])},
                    ],
                    evidence={"chart_id": chart_id, "columns": [cat["name"], num["name"]]},
                    query_hint=f"Which {cat['name']} has the highest total {num['name']}?",
                ))

    # --- Dominant category ------------------------------------------------
    for cat in categorical[:2]:
        counts = analysis.count_by_category(df, cat["name"], limit=10)
        if len(counts) >= 2 and counts[0]["value"] > 0:
            share = counts[0]["value"] / max(sum(c["value"] for c in counts), 1) * 100
            if share >= 30:
                chart_id = _chart_lookup(charts, lambda c, cat=cat:
                    c["chart_type"] in ("pie",) and cat["name"] in c["title"])
                insights.append(_mk(
                    "distribution",
                    "low" if share < 50 else "medium",
                    f"'{counts[0]['group']}' dominates {cat['name']}",
                    f"The most common value in {cat['name']} is '{counts[0]['group']}' "
                    f"appearing {counts[0]['value']:,} times ({share:.0f}% of the top-10).",
                    numbers=[{"label": "share", "value": f"{share:.0f}%"}],
                    evidence={"chart_id": chart_id, "columns": [cat["name"]]},
                    query_hint=f"What is the distribution of {cat['name']}?",
                ))

    # --- Outliers ----------------------------------------------------------
    for issue in engine.quality["issues"]:
        if issue["category"] == "outliers" and issue["severity"] in ("high", "medium"):
            chart_id = _chart_lookup(charts, lambda c, col=issue["column"]:
                c["chart_type"] == "histogram" and col in c["title"])
            insights.append(_mk(
                "outlier",
                issue["severity"],
                issue["title"],
                issue["detail"],
                numbers=[{"label": "flagged values", "value": f"{issue['count']:,}"}],
                evidence={"chart_id": chart_id, "columns": [issue["column"]]},
                query_hint=f"Are there unusual patterns in {issue['column']}?",
            ))
        if len(insights) >= limit:
            break

    # --- Quality findings that materially affect analysis ------------------
    for issue in engine.quality["issues"]:
        if issue["category"] == "missing_values" and issue["severity"] == "high":
            insights.append(_mk(
                "quality",
                issue["severity"],
                issue["title"],
                issue["detail"],
                numbers=[{"label": "missing", "value": f"{issue['count']:,}"}],
                evidence={"columns": [issue["column"]]},
                query_hint=f"How much data is missing in {issue['column']}?",
            ))

    # --- Skew --------------------------------------------------------------
    for issue in engine.quality["issues"]:
        if issue["category"] == "skew":
            insights.append(_mk(
                "distribution",
                "low",
                issue["title"],
                issue["detail"],
                evidence={"columns": [issue["column"]]},
                query_hint=f"What is the distribution of {issue['column']}?",
            ))

    for i, ins in enumerate(insights[:limit], start=1):
        ins["id"] = f"i{i}"
    return insights[:limit]


def dataset_overview_text(engine: "object") -> str:
    s = engine.summary
    return (
        f"This dataset has {s['row_count']:,} rows and {s['column_count']} columns. "
        f"It contains {s['numeric_columns']} numeric, {s['categorical_columns']} categorical, "
        f"{s['datetime_columns']} date, and {s['text_columns']} text columns. "
        f"There are {s['missing_cells']:,} missing cells ({s['missing_pct']}%) and "
        f"{s['duplicate_count']:,} duplicate rows."
    )
