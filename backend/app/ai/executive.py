"""Rule-based executive analytics for the AI-analyst experience.

Builds a decision-ready summary from an ``EngineResult`` without requiring an
LLM: overview paragraph, KPI cards, key takeaways, anomaly flags, correlation
highlights, concrete recommendations and suggested next analyses.
"""

from __future__ import annotations

import math

from ..data_engine import analysis
from .insights import dataset_overview_text
from .nlu import suggested_questions

_NUMERIC_TYPES = ("integer", "float")
_CAT_TYPES = ("categorical", "boolean")

SEVERITY_LABEL = {"high": "High", "medium": "Medium", "low": "Low"}


def _fmt(value, digits: int = 1) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if number == 0 or abs(number) >= 1000 or abs(number) < 0.001:
        return f"{number:.2g}"
    return f"{number:,}".replace(",", ",") if abs(number) >= 1000 else f"{number:,.{digits}f}"


def _numeric_profiles(engine) -> list[dict]:
    return [c for c in engine.columns if c["inferred_type"] in _NUMERIC_TYPES]


def _categorical_profiles(engine) -> list[dict]:
    return [c for c in engine.columns if c["inferred_type"] in _CAT_TYPES]


def _datetime_profiles(engine) -> list[dict]:
    return [c for c in engine.columns if c["inferred_type"] == "datetime"]


def _kpis(engine) -> list[dict]:
    summary = engine.summary
    quality = engine.quality["summary"]
    kpis = [
        {
            "label": "Data health",
            "value": f"{quality['quality_score']}",
            "suffix": "/100",
            "hint": f"{quality['total_issues']} issues · {quality['high']} high priority",
            "tone": "good" if quality["quality_score"] >= 85 else ("warn" if quality["quality_score"] >= 60 else "bad"),
        },
        {
            "label": "Rows",
            "value": f"{summary['row_count']:,}",
            "hint": f"{summary['column_count']} columns",
            "tone": "neutral",
        },
        {
            "label": "Missing cells",
            "value": f"{summary['missing_pct']}",
            "suffix": "%",
            "hint": f"{summary['missing_cells']:,} of {summary['total_cells']:,}",
            "tone": "good" if summary["missing_pct"] <= 2 else ("warn" if summary["missing_pct"] <= 10 else "bad"),
        },
        {
            "label": "Duplicate rows",
            "value": f"{summary['duplicate_count']:,}",
            "hint": "exact duplicate records",
            "tone": "good" if summary["duplicate_count"] == 0 else "warn",
        },
    ]
    numeric = _numeric_profiles(engine)
    if numeric:
        col = numeric[0]
        stats = col.get("stats") or {}
        kpis.insert(1, {
            "label": f"Avg {col['name']}",
            "value": _fmt(stats.get("mean", 0)),
            "hint": f"median {_fmt(stats.get('median', 0))} · std {_fmt(stats.get('std', 0))}",
            "tone": "neutral",
        })
    return kpis[:6]


def _anomaly_flags(engine) -> list[dict]:
    flags = []
    for issue in engine.quality["issues"]:
        if issue["severity"] not in ("high", "medium"):
            continue
        flags.append({
            "category": issue["category"].replace("_", " ").title(),
            "column": issue.get("column"),
            "severity": issue["severity"],
            "severity_label": SEVERITY_LABEL[issue["severity"]],
            "message": f"{issue['title']}: {issue['detail']}",
        })
    return flags[:6]


def _correlation_highlights(engine) -> list[dict]:
    return [
        {
            "col_a": c["col_a"],
            "col_b": c["col_b"],
            "correlation": c["correlation"],
            "strength": c["strength"],
            "message": (
                f"{c['col_a']} and {c['col_b']} move "
                f"{'together' if c['strength'] == 'positive' else 'in opposite directions'}"
                f" (r = {c['correlation']:+.2f})."
            ),
        }
        for c in engine.strong_correlations[:3]
    ]


def _recommendations(engine) -> list[dict]:
    recs = []
    summary = engine.summary
    if summary["duplicate_count"] > 0:
        recs.append({
            "action": "Remove duplicate rows",
            "reason": f"{summary['duplicate_count']:,} exact duplicate rows inflate every aggregate.",
            "clean_action": "dedupe",
        })
    for issue in engine.quality["issues"]:
        if issue["category"] == "missing_values" and issue["severity"] in ("high", "medium"):
            col = issue["column"]
            recs.append({
                "action": f"Handle missing values in {col}",
                "reason": issue["detail"],
                "clean_action": "fill_missing",
                "column": col,
            })
            break
    if engine.quality["summary"]["high"] > 0:
        recs.append({
            "action": "Review the AI analyst's observations",
            "reason": "Several columns need attention before trusting downstream results.",
        })
    if not recs:
        recs.append({
            "action": "Dataset looks clean",
            "reason": "No high-priority issues detected. Start exploring trends and relationships.",
        })
    return recs[:5]


def _trend_takeaways(engine) -> list[dict]:
    takeaways = []
    for ins in engine.cached_insights(limit=12):
        if ins["category"] in ("trend", "top", "correlation", "distribution"):
            takeaways.append({
                "category": ins["category"],
                "severity": ins.get("severity", "info"),
                "title": ins["title"],
                "detail": ins["detail"],
            })
        if len(takeaways) >= 4:
            break
    return takeaways


def _suggested_next(engine) -> list[dict]:
    items = []
    numeric = _numeric_profiles(engine)
    categorical = _categorical_profiles(engine)
    datetime_cols = _datetime_profiles(engine)

    if datetime_cols and numeric:
        items.append({
            "title": "Trend analysis over time",
            "description": f"Track how {numeric[0]['name']} evolves across {datetime_cols[0]['name']}.",
            "chart": "area",
            "columns": [datetime_cols[0]["name"], numeric[0]["name"]],
        })
    if len(numeric) >= 2:
        a, b = numeric[0]["name"], numeric[1]["name"]
        items.append({
            "title": f"Relationship between {a} and {b}",
            "description": "Scatter with correlation insight to spot patterns and outliers.",
            "chart": "scatter",
            "columns": [a, b],
        })
    if numeric:
        col = numeric[0]["name"]
        items.append({
            "title": f"Distribution profile of {col}",
            "description": "Histogram with density overlay, skew and spread diagnostics.",
            "chart": "distribution",
            "columns": [col],
        })
    if len(numeric) >= 3:
        items.append({
            "title": "Multi-variable bubble chart",
            "description": f"Compare {numeric[0]['name']} vs {numeric[1]['name']} sized by {numeric[2]['name']}.",
            "chart": "bubble",
            "columns": [numeric[0]["name"], numeric[1]["name"], numeric[2]["name"]],
        })
    if categorical and numeric:
        items.append({
            "title": f"{numeric[0]['name']} by {categorical[0]['name']}",
            "description": "Compare performance across categories with a ranked bar chart.",
            "chart": "bar",
            "columns": [categorical[0]["name"], numeric[0]["name"]],
        })
    if numeric:
        items.append({
            "title": "Box plot of all numeric columns",
            "description": "Compare distributions, spread and outliers side by side.",
            "chart": "box",
            "columns": [c["name"] for c in numeric[:6]],
        })
    if len(categorical) >= 2:
        items.append({
            "title": f"Breakdown of {categorical[1]['name']} by {categorical[0]['name']}",
            "description": "Treemap reveals which segments dominate the mix.",
            "chart": "treemap",
            "columns": [categorical[0]["name"], categorical[1]["name"]],
        })
    return items[:6]


def build_executive_summary(engine) -> dict:
    summary = engine.summary
    quality = engine.quality["summary"]
    overview = dataset_overview_text(engine)
    overview += (
        f" Overall data health scores {quality['quality_score']}/100 "
        f"({quality['total_issues']} issues found)."
    )
    if engine.strong_correlations:
        top = engine.strong_correlations[0]
        overview += (
            f" The strongest relationship in the data is between {top['col_a']} and "
            f"{top['col_b']} (r = {top['correlation']:+.2f})."
        )

    return {
        "overview": overview,
        "kpis": _kpis(engine),
        "key_takeaways": _trend_takeaways(engine),
        "anomaly_flags": _anomaly_flags(engine),
        "correlation_highlights": _correlation_highlights(engine),
        "recommendations": _recommendations(engine),
        "suggested_next": _suggested_next(engine),
        "question_suggestions": suggested_questions(engine, limit=6),
    }


def build_snippet(engine) -> str:
    """A short, human-friendly one-liner summarising a dataset for list cards.

    Cheap to compute (no insight regeneration) so it is safe to call for every
    dataset in the library.
    """
    summary = engine.summary
    quality = engine.quality["summary"]
    parts = [
        f"{summary['row_count']:,} rows",
        f"{summary['column_count']} columns",
        f"quality {quality['quality_score']}/100",
    ]

    cats = _categorical_profiles(engine)
    if cats:
        counts = analysis.count_by_category(engine.df, cats[0]["name"], limit=1)
        if counts:
            parts.append(f"top {cats[0]['name']}: {counts[0]['group']}")

    dts = _datetime_profiles(engine)
    numerics = _numeric_profiles(engine)
    if dts and numerics:
        trend = analysis.temporal_trend(engine.df, dts[0]["name"], numerics[0]["name"])
        if trend:
            parts.append(
                f"{numerics[0]['name']} {trend['direction']} "
                f"{abs(trend['change_pct']):.0f}% in H2"
            )
    return " · ".join(parts)
