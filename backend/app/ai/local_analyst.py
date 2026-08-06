"""Local, rule-based analyst used when no LLM API key is configured.

Answers natural-language questions using only the computed statistics, so the
product is fully usable offline. It recognises a set of common intents and
always grounds its answer in the actual profile/aggregation numbers.
"""

from __future__ import annotations

import re

from ..data_engine import analysis
from ..data_engine.profiler import NUMERIC_TYPES

INTENT_PATTERNS = [
    ("median", r"\bmedian|midpoint|middle value|50th percentile|50th pct"),
    ("percentage", r"\bpercentage|percent|share of|fraction|proportion|what %|what pct|how much of"),
    ("compare", r"\bcompare|versus|\bvs\b|between|\bdiffer|difference between"),
    ("trend", r"\btrend|over time|over\s+the\s+period|changed|increase|decrease|seasonal"),
    ("correlation", r"\bcorrelat|relat(ion|ionship)|associated|linked|moves together"),
    ("outlier", r"\boutlier|unusual|anomal|abnormal|extreme|irregular|suspicious"),
    ("missing", r"\bmissing|absent|empty|gap|incomplete"),
    ("duplicate", r"\bdup\b|duplicate|identical rows|repeated"),
    ("highest", r"\bhighest|maximum|max\b|best|top|most|largest|biggest|peak|leader|leading"),
    ("lowest", r"\blowest|minimum|min\b|worst|bottom|least|smallest|weakest"),
    ("average", r"\baverage|\bmean|typical|middle"),
    ("total", r"\btotal|overall|sum of|combined|aggregate"),
    ("count", r"\bcount\b|how many|number of|volume|frequency"),
    ("distribution", r"\bdistribut|breakdown|composition|share|percentage of|by\b|share of"),
    ("list", r"\blist\b|show|what are the|sample|example|rows"),
]

TYPE_DATETIME = "datetime"
TYPE_CATEGORICAL = "categorical"
TYPE_BOOLEAN = "boolean"


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def _find_column(question: str, columns: list[dict]) -> list[dict]:
    """Return columns mentioned in the question, best match first."""
    q = _norm(question)
    scored = []
    for col in columns:
        n = _norm(col["name"])
        if n and (n in q or q in n or n.rstrip("s") in q):
            scored.append(col)
    return scored


def _detect_intent(question: str) -> str:
    q = question.lower()
    for intent, pattern in INTENT_PATTERNS:
        if re.search(pattern, q):
            return intent
    return "unknown"


def _numeric_stats(col: dict) -> dict:
    return col.get("stats", {})


def _answer_highest_lowest(question: str, cols: list[dict], intent: str, engine) -> dict:
    cats = [c for c in cols if c["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)]
    numerics = [c for c in cols if c["inferred_type"] in NUMERIC_TYPES]
    side = "highest" if intent == "highest" else "lowest"

    # Prefer a grouped ("per category") answer when both a categorical and a
    # numeric column are mentioned in the question.
    if cats and numerics:
        ranked = analysis.grouped_aggregate(engine.df, cats[0]["name"], numerics[0]["name"], agg="sum", limit=5)
        if ranked:
            winner = ranked[0] if intent == "highest" else ranked[-1]
            return {
                "answer": f"The {side} total {numerics[0]['name']} is '{winner['group']}' "
                          f"with {_format(winner['value'])}.",
                "numbers": [{"label": f"{side} ({winner['group'][:18]})", "value": _format(winner["value"])}],
                "explanation": f"Summed {numerics[0]['name']} grouped by {cats[0]['name']}.",
            }

    if numerics:
        col = numerics[0]
        stats = _numeric_stats(col)
        key = "max" if intent == "highest" else "min"
        value = stats.get(key)
        if value is not None:
            return {
                "answer": f"The {side} value in {col['name']} is {_format(value)}.",
                "numbers": [{"label": f"{side} {col['name']}", "value": _format(value)}],
                "explanation": (
                    f"Computed from {engine.summary['row_count']:,} rows. "
                    f"Mean is {_format(stats.get('mean'))} and median is {_format(stats.get('median'))}."
                ),
            }
    # Highest by category aggregate when only a categorical column is mentioned
    for cat in cats:
        for num in [c for c in engine.columns if c["inferred_type"] in NUMERIC_TYPES]:
            ranked = analysis.grouped_aggregate(engine.df, cat["name"], num["name"], agg="sum", limit=5)
            if not ranked:
                continue
            best = ranked[0]
            return {
                "answer": f"The {side} {num['name']} is '{best['group']}' with {_format(best['value'])}.",
                "numbers": [{"label": f"{side} {num['name']}", "value": _format(best['value'])},
                            {"label": "group", "value": best["group"]}],
                "explanation": f"Summed {num['name']} grouped by {cat['name']}.",
            }
    return _unknown_answer(question)


def _answer_average_total(question: str, cols: list[dict], intent: str, engine) -> dict:
    numerics = [c for c in cols if c["inferred_type"] in NUMERIC_TYPES]
    if not numerics:
        # choose any numeric column if one is mentioned by category
        numerics = [c for c in engine.columns if c["inferred_type"] in NUMERIC_TYPES][:1]
    if numerics:
        col = numerics[0]
        stats = _numeric_stats(col)
        if intent == "average":
            val = stats.get("mean")
            label = "average"
        else:
            val = stats.get("sum")
            label = "total"
        if val is not None:
            return {
                "answer": f"The {label} of {col['name']} is {_format(val)}.",
                "numbers": [{"label": f"{label} {col['name']}", "value": _format(val)}],
                "explanation": (
                    f"Median is {_format(stats.get('median'))} and std dev is "
                    f"{_format(stats.get('std'))} across {engine.summary['row_count']:,} rows."
                ),
            }
    return _unknown_answer(question)


def _answer_count(question: str, cols: list[dict], engine) -> dict:
    if not cols:
        return {
            "answer": f"The dataset has {engine.summary['row_count']:,} rows and {engine.summary['column_count']} columns.",
            "numbers": [{"label": "rows", "value": f"{engine.summary['row_count']:,}"},
                        {"label": "columns", "value": str(engine.summary["column_count"])}],
            "explanation": "Full-dataset row and column counts.",
        }
    col = cols[0]
    distinct = col.get("distinct_count", 0)
    nulls = col.get("null_count", 0)
    return {
        "answer": f"{col['name']} has {distinct:,} unique values "
                  f"({nulls:,} missing of {engine.summary['row_count']:,} rows).",
        "numbers": [{"label": "unique values", "value": f"{distinct:,}"},
                    {"label": "missing", "value": f"{nulls:,}"}],
        "explanation": "Distinct and missing counts computed from the full column.",
    }


def _answer_distribution(question: str, cols: list[dict], engine) -> dict:
    cats = [c for c in cols if c["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)]
    if not cats:
        cats = [c for c in engine.columns if c["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)]
    if cats:
        cat = cats[0]
        counts = analysis.count_by_category(engine.df, cat["name"], limit=5)
        if counts:
            total = sum(c["value"] for c in counts)
            top = counts[0]
            lines = "; ".join(f"{c['group']}: {c['value']:,}" for c in counts[:4])
            return {
                "answer": f"The most common {cat['name']} is '{top['group']}' ({top['value']:,} rows). "
                          f"Top values: {lines}.",
                "numbers": [{"label": f"top value ({top['group'][:16]})", "value": f"{top['value']:,}"},
                            {"label": "top-5 share", "value": f"{total / max(engine.summary['row_count'], 1) * 100:.0f}%"}],
                "explanation": "Counts are computed directly from the dataset.",
            }
    return _unknown_answer(question)


def _answer_correlation(question: str, engine) -> dict:
    pairs = engine.strong_correlations[:3]
    if not pairs:
        return {
            "answer": "No strong correlations (|r| >= 0.6) were found between numeric columns.",
            "numbers": [],
            "explanation": "Pearson correlation was computed for all numeric column pairs.",
        }
    p = pairs[0]
    kind = "positive" if p["strength"] == "positive" else "negative"
    return {
        "answer": f"The strongest relationship is between {p['col_a']} and {p['col_b']} "
                  f"({kind} correlation r = {p['correlation']:.2f}).",
        "numbers": [{"label": "correlation", "value": f"{p['correlation']:.2f}"}],
        "explanation": "Pearson correlation computed on complete numeric pairs.",
    }


def _answer_trend(question: str, engine) -> dict:
    from ..data_engine import analysis as ana
    dts = [c for c in engine.columns if c["inferred_type"] == TYPE_DATETIME]
    nums = [c for c in engine.columns if c["inferred_type"] in NUMERIC_TYPES]
    for dt in dts[:1]:
        for num in nums[:1]:
            t = ana.temporal_trend(engine.df, dt["name"], num["name"])
            if t:
                return {
                    "answer": f"{num['name']} has {t['direction']} across the time range "
                              f"({t['change_pct']:+.1f}% change from early to recent average).",
                    "numbers": [{"label": "change", "value": f"{t['change_pct']:+.1f}%"},
                                {"label": "early avg", "value": _format(t["first_half_mean"])},
                                {"label": "recent avg", "value": _format(t["second_half_mean"])}],
                    "explanation": "Compares the mean of the first half of the date range to the second half.",
                }
    return {
        "answer": "No clear time trend was detected, or the dataset has no date column.",
        "numbers": [],
        "explanation": "Trend detection needs a date column and a numeric column.",
    }


def _answer_quality(question: str, intent: str, engine) -> dict:
    issues = engine.quality["issues"]
    matching = [i for i in issues if i["category"] == intent]
    if not matching:
        return {
            "answer": f"No {intent} issues were detected in the dataset.",
            "numbers": [],
            "explanation": "The data quality engine found no problems of this type.",
        }
    top = matching[0]
    return {
        "answer": top["title"] + ". " + top["detail"],
        "numbers": [{"label": "affected", "value": f"{top['count']:,}"}],
        "explanation": f"Severity: {top['severity']}. Detected automatically by the quality engine.",
    }


def _answer_list(question: str, cols: list[dict], engine) -> dict:
    cats = [c for c in cols if c["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)]
    if cats:
        counts = analysis.count_by_category(engine.df, cats[0]["name"], limit=5)
        if counts:
            return {
                "answer": "Top values in " + cats[0]["name"] + ": " +
                          ", ".join(f"{c['group']} ({c['value']:,})" for c in counts) + ".",
                "numbers": [{"label": f"top ({counts[0]['group'][:16]})", "value": f"{counts[0]['value']:,}"}],
                "explanation": "Most frequent categories with counts.",
            }
    return _unknown_answer(question)


def _answer_median(question: str, cols: list[dict], engine) -> dict:
    numerics = [c for c in cols if c["inferred_type"] in NUMERIC_TYPES]
    if not numerics:
        numerics = [c for c in engine.columns if c["inferred_type"] in NUMERIC_TYPES][:1]
    if numerics:
        col = numerics[0]
        median = _numeric_stats(col).get("median")
        if median is not None:
            return {
                "answer": f"The median of {col['name']} is {_format(median)}.",
                "numbers": [{"label": f"median {col['name']}", "value": _format(median)}],
                "explanation": (
                    f"The median is the midpoint of {col['name']}; half the values fall "
                    f"below it. Mean is {_format(_numeric_stats(col).get('mean'))}."
                ),
            }
    return _unknown_answer(question)


def _answer_percentage(question: str, cols: list[dict], engine) -> dict:
    cats = [c for c in cols if c["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)]
    if not cats:
        cats = [c for c in engine.columns if c["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)]
    numerics = [c for c in cols if c["inferred_type"] in NUMERIC_TYPES]
    if not numerics:
        numerics = [c for c in engine.columns if c["inferred_type"] in NUMERIC_TYPES]

    for cat in cats:
        grouped = analysis.grouped_aggregate(engine.df, cat["name"], numerics[0]["name"], agg="sum", limit=30) if numerics else []
        if grouped and sum(g["value"] for g in grouped) > 0:
            total = sum(g["value"] for g in grouped)
            named = _named_category(question, grouped)
            target = next((g for g in grouped if g["group"] == named), None) if named else None
            if target is None:
                continue
            share = target["value"] / total * 100
            return {
                "answer": f"'{target['group']}' accounts for {share:.1f}% of the total "
                          f"{numerics[0]['name']} ({_format(target['value'])} of {_format(total)}).",
                "numbers": [{"label": "share", "value": f"{share:.1f}%"},
                            {"label": target["group"][:18], "value": _format(target["value"])}],
                "explanation": f"Share of {numerics[0]['name']} grouped by {cat['name']}.",
            }

    for cat in cats:
        counts = analysis.count_by_category(engine.df, cat["name"], limit=50)
        if not counts:
            continue
        total = sum(c["value"] for c in counts)
        named = _named_category(question, counts)
        target = next((c for c in counts if c["group"] == named), None) if named else counts[0]
        if target is None:
            continue
        share = target["value"] / max(total, 1) * 100
        return {
            "answer": f"'{target['group']}' is {share:.1f}% of all rows "
                      f"({target['value']:,} of {total:,}).",
            "numbers": [{"label": "share", "value": f"{share:.1f}%"},
                        {"label": target["group"][:18], "value": f"{target['value']:,}"}],
            "explanation": f"Row share across {cat['name']} values.",
        }
    return _unknown_answer(question)


def _named_category(question: str, groups: list[dict]) -> str | None:
    """Return the category value mentioned in the question, if any."""
    q = question.lower()
    for g in groups:
        name = g["group"]
        if len(name) > 1 and name.lower() in q:
            return name
    return None


def _answer_compare(question: str, cols: list[dict], engine) -> dict:
    cats = [c for c in cols if c["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)]
    if not cats:
        cats = [c for c in engine.columns if c["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)]
    numerics = [c for c in cols if c["inferred_type"] in NUMERIC_TYPES]
    if not numerics:
        numerics = [c for c in engine.columns if c["inferred_type"] in NUMERIC_TYPES]

    # Compare two categories of the same categorical column.
    for cat in cats:
        counts = analysis.count_by_category(engine.df, cat["name"], limit=50)
        named = [g["group"] for g in counts if g["group"] and g["group"].lower() in question.lower()]
        if len(named) >= 2:
            a, b = named[:2]
            va = next(g["value"] for g in counts if g["group"] == a)
            vb = next(g["value"] for g in counts if g["group"] == b)
            diff = va - vb
            return {
                "answer": f"'{a}' has {va:,} rows and '{b}' has {vb:,} rows "
                          f"({'+' if diff >= 0 else ''}{diff:,} difference).",
                "numbers": [{"label": a[:18], "value": f"{va:,}"},
                            {"label": b[:18], "value": f"{vb:,}"},
                            {"label": "difference", "value": f"{diff:+,}"}],
                "explanation": f"Counts compared within {cat['name']}.",
            }

    # Compare the means of two numeric columns.
    if len(numerics) >= 2:
        a, b = numerics[:2]
        ma = _numeric_stats(a).get("mean")
        mb = _numeric_stats(b).get("mean")
        if ma is not None and mb is not None:
            return {
                "answer": f"The mean of {a['name']} is {_format(ma)} vs {_format(mb)} for "
                          f"{b['name']} (difference {_format(ma - mb)}).",
                "numbers": [{"label": f"mean {a['name']}", "value": _format(ma)},
                            {"label": f"mean {b['name']}", "value": _format(mb)}],
                "explanation": "Compares the column means across the full dataset.",
            }
    return _unknown_answer(question)


def _unknown_answer(question: str) -> dict:
    return {
        "answer": "I could not confidently match that question to the dataset's statistics. "
                  "Try asking about the highest/lowest values, averages, distributions, "
                  "correlations, trends, or missing data.",
        "numbers": [],
        "explanation": "The local analyst recognises a fixed set of question intents. "
                       "Configure an LLM API key for richer natural-language answers.",
    }


def _format(v) -> str:
    if v is None:
        return "n/a"
    if isinstance(v, float):
        if v == int(v) and abs(v) < 1e15:
            return f"{int(v):,}"
        return f"{v:,.2f}"
    return str(v)


def _columns_from_memory(memory: list[dict] | None, columns: list[dict]) -> list[dict]:
    """Resolve follow-up questions by reusing columns mentioned in prior turns."""
    if not memory:
        return []
    for entry in reversed(memory):
        if entry.get("role") == "user":
            found = _find_column(entry.get("content", ""), columns)
            if found:
                return found
    return []


def answer(question: str, engine, memory: list[dict] | None = None) -> dict:
    """Answer a natural-language question using only computed statistics.

    `memory` is the recent conversation (list of user/assistant turns). It lets
    follow-up questions such as "and what is its median?" reuse columns that were
    mentioned in earlier turns.
    """
    cols = _find_column(question, engine.columns)
    if not cols:
        cols = _columns_from_memory(memory, engine.columns)
    intent = _detect_intent(question)

    handler = {
        "highest": lambda: _answer_highest_lowest(question, cols, "highest", engine),
        "lowest": lambda: _answer_highest_lowest(question, cols, "lowest", engine),
        "average": lambda: _answer_average_total(question, cols, "average", engine),
        "median": lambda: _answer_median(question, cols, engine),
        "percentage": lambda: _answer_percentage(question, cols, engine),
        "compare": lambda: _answer_compare(question, cols, engine),
        "total": lambda: _answer_average_total(question, cols, "total", engine),
        "count": lambda: _answer_count(question, cols, engine),
        "distribution": lambda: _answer_distribution(question, cols, engine),
        "correlation": lambda: _answer_correlation(question, engine),
        "trend": lambda: _answer_trend(question, engine),
        "missing": lambda: _answer_quality(question, "missing_values", engine),
        "duplicate": lambda: _answer_quality(question, "duplicates", engine),
        "outlier": lambda: _answer_quality(question, "outliers", engine),
        "list": lambda: _answer_list(question, cols, engine),
    }

    result = handler.get(intent, lambda: _unknown_answer(question))()

    related = _related_insights(question, intent, engine)
    return {
        "answer": result["answer"],
        "numbers": result["numbers"],
        "explanation": result["explanation"],
        "intent": intent,
        "mode": "local",
        "related_insights": related,
        "sql": None,
        "chart": None,
    }


def _related_insights(question: str, intent: str, engine) -> list[dict]:
    from .insights import generate_insights

    insights = generate_insights(engine, limit=6)
    return [
        {"id": i["id"], "title": i["title"], "query_hint": i.get("query_hint")}
        for i in insights if i.get("query_hint")
    ][:3]
