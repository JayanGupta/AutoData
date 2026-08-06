"""Dataset profiling: type inference and per-column statistics.

All functions are pure and operate on a pandas DataFrame so they can be unit
tested in isolation. Type detection uses a parsing-first strategy: we try to
coerce a column to a richer type and measure how many rows succeed.
"""

from __future__ import annotations

import datetime as _dt

import numpy as np
import pandas as pd

from .. import config

# Display categories used by the frontend.
TYPE_INTEGER = "integer"
TYPE_FLOAT = "float"
TYPE_DATETIME = "datetime"
TYPE_BOOLEAN = "boolean"
TYPE_CATEGORICAL = "categorical"
TYPE_TEXT = "text"

NUMERIC_TYPES = {TYPE_INTEGER, TYPE_FLOAT}

_MISSING = {np.nan, None, "", "nan", "NaN", "N/A", "NA", "null", "None", "-", "?"}


def _is_missing(value) -> bool:
    if value is None or value is pd.NA:
        return True
    if isinstance(value, float) and np.isnan(value):
        return True
    if isinstance(value, str):
        return value.strip() in _MISSING
    return False


def _coerce_numeric(series: pd.Series) -> tuple[pd.Series, float]:
    """Try to coerce a column to numeric; return (coerced, success_fraction)."""
    sample = series.dropna().head(500).astype(str).str.strip()
    cleaned = sample.replace({"": np.nan, "nan": np.nan, "NaN": np.nan, "N/A": np.nan,
                              "NA": np.nan, "null": np.nan, "None": np.nan, "-": np.nan, "?": np.nan})
    cleaned = cleaned.str.replace(r"[$,%\s]", "", regex=True)
    cleaned = cleaned.replace({"": np.nan})
    coerced = pd.to_numeric(cleaned, errors="coerce")
    valid = int(coerced.notna().sum())
    total = max(len(cleaned), 1)
    return coerced, valid / total


def _coerce_datetime(series: pd.Series) -> tuple[pd.Series, float]:
    sample = series.dropna().astype(str).head(500)
    coerced = pd.to_datetime(sample, errors="coerce", format="mixed")
    valid = int(coerced.notna().sum())
    total = max(len(sample), 1)
    return coerced, valid / total


def _coerce_boolean(series: pd.Series) -> tuple[pd.Series, float]:
    sample = series.dropna().astype(str).str.strip().str.lower()
    true_vals = {"true", "yes", "y", "1", "t"}
    false_vals = {"false", "no", "n", "0", "f"}
    matched = sample.isin(true_vals | false_vals)
    return sample.isin(true_vals), int(matched.sum()) / max(len(sample), 1)


SEMANTIC_HINTS = {
    "price": "currency",
    "revenue": "currency",
    "sales": "currency",
    "cost": "currency",
    "amount": "currency",
    "amount_": "currency",
    "value": "currency",
    "salary": "currency",
    "income": "currency",
    "budget": "currency",
    "price_": "currency",
    "spend": "currency",
    "rate": "percent",
    "percent": "percent",
    "pct": "percent",
    "ratio": "percent",
    "discount": "percent",
    "margin": "percent",
    "share": "percent",
    "growth": "percent",
    "count": "count",
    "quantity": "count",
    "qty": "count",
    "number": "count",
    "n_": "count",
    "age": "count",
    "score": "score",
    "rating": "score",
    "rank": "rank",
    "date": "date",
    "time": "date",
    "day": "date",
    "month": "date",
    "year": "date",
    "timestamp": "date",
    "created_at": "date",
    "updated_at": "date",
    "email": "identifier",
    "id": "identifier",
    "user_id": "identifier",
    "product_id": "identifier",
    "order_id": "identifier",
    "customer_id": "identifier",
    "name": "name",
    "country": "geo",
    "city": "geo",
    "state": "geo",
    "region": "geo",
    "address": "geo",
}


def detect_semantic(name: str) -> str | None:
    lower = name.lower().strip()
    if lower in SEMANTIC_HINTS:
        return SEMANTIC_HINTS[lower]
    for key, value in SEMANTIC_HINTS.items():
        if lower.startswith(key) or lower.endswith(key):
            return value
    return None


def _detect_type(name: str, series: pd.Series) -> tuple[str, float, pd.Series]:
    """Return (detected_type, confidence, coerced_series) for one column."""
    non_null = series[series.map(_is_missing) == False]  # noqa: E712  # noqa: E712
    non_null = non_null.astype(object).map(
        lambda v: None if _is_missing(v) else v
    ).dropna()

    if len(non_null) == 0:
        return TYPE_TEXT, 1.0, series

    if non_null.dtype == bool or (non_null.dtype == object and non_null.map(type).eq(bool).all()):
        return TYPE_BOOLEAN, 1.0, non_null

    # datetime check first (date-looking strings fail numeric parse anyway)
    dt_coerced, dt_score = _coerce_datetime(non_null)
    num_coerced, num_score = _coerce_numeric(non_null)

    if num_score >= 0.95:
        if dt_score >= 0.95:
            # Ambiguous: prefer numeric only if the column is clearly a number
            # (e.g. int-like). Dates rarely parse cleanly as numbers, so prefer
            # datetime when both match.
            numeric_vals = num_coerced.dropna()
            is_int = bool(np.allclose(numeric_vals.values % 1, 0)) if len(numeric_vals) else True
            dt_vals = dt_coerced.dropna()
            if len(dt_vals) and dt_vals.dt.year.between(1900, 2100).all():
                return TYPE_DATETIME, dt_score, dt_coerced
            return (TYPE_INTEGER if is_int else TYPE_FLOAT), num_score, num_coerced
        numeric_vals = num_coerced.dropna()
        is_int = bool(np.allclose(numeric_vals.values % 1, 0)) if len(numeric_vals) else True
        return (TYPE_INTEGER if is_int else TYPE_FLOAT), num_score, num_coerced

    if dt_score >= 0.95:
        dt_vals = dt_coerced.dropna()
        if len(dt_vals) and dt_vals.dt.year.between(1900, 2100).all():
            return TYPE_DATETIME, dt_score, dt_coerced

    bool_coerced, bool_score = _coerce_boolean(non_null)
    if bool_score >= 0.95:
        return TYPE_BOOLEAN, bool_score, bool_coerced

    # Categorical vs free text: categorical if low cardinality relative to size.
    distinct = non_null.nunique(dropna=True)
    if distinct <= 1:
        return TYPE_CATEGORICAL, 1.0, non_null
    if distinct <= 50 or (distinct / max(len(non_null), 1) <= 0.05):
        return TYPE_CATEGORICAL, 0.9, non_null
    return TYPE_TEXT, 0.85, non_null


def _build_histogram(series: pd.Series, bins: int = 20) -> list[dict]:
    series = series.dropna()
    if len(series) == 0 or not np.issubdtype(series.dtype, np.number):
        return []
    q_low, q_high = series.quantile([0.01, 0.99])
    if pd.isna(q_low) or pd.isna(q_high) or q_low == q_high:
        q_low, q_high = series.min(), series.max()
    counts, edges = np.histogram(series.clip(lower=q_low, upper=q_high), bins=bins)
    return [
        {"bin_start": round(float(edges[i]), 4), "bin_end": round(float(edges[i + 1]), 4), "count": int(counts[i])}
        for i in range(len(counts))
    ]


def _cardinality(distinct: int, total: int) -> str:
    ratio = distinct / max(total, 1)
    if distinct <= 10:
        return "low"
    if ratio <= 0.05 or distinct <= 100:
        return "medium"
    return "high"


def _json_safe(value):
    if value is pd.NA:
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if np.isnan(value) or np.isinf(value):
            return None
        return round(float(value), 6)
    if isinstance(value, (pd.Timestamp, _dt.datetime, _dt.date)):
        return str(value)
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def profile_column(name: str, series: pd.Series) -> dict:
    dtype, confidence, coerced = _detect_type(name, series)

    null_mask = series.map(_is_missing)
    null_count = int(null_mask.sum())
    non_null = series[~null_mask]
    total = max(len(series), 1)

    distinct_count = int(non_null.nunique(dropna=True)) if len(non_null) else 0

    stats = {}
    if dtype in NUMERIC_TYPES:
        vals = pd.to_numeric(non_null.astype(str).str.replace(r"[$,%\s]", "", regex=True).replace({"": np.nan}), errors="coerce")
        vals = vals.dropna()
        if len(vals):
            stats = {
                "min": _json_safe(vals.min()),
                "max": _json_safe(vals.max()),
                "mean": _json_safe(vals.mean()),
                "median": _json_safe(vals.median()),
                "std": _json_safe(vals.std()),
                "sum": _json_safe(vals.sum()),
                "q1": _json_safe(vals.quantile(0.25)),
                "q3": _json_safe(vals.quantile(0.75)),
                "p05": _json_safe(vals.quantile(0.05)),
                "p95": _json_safe(vals.quantile(0.95)),
                "skewness": _json_safe(vals.skew()) if len(vals) > 2 else None,
                "kurtosis": _json_safe(vals.kurt()) if len(vals) > 3 else None,
            }
    elif dtype == TYPE_DATETIME:
        dt_vals = pd.to_datetime(non_null, errors="coerce")
        dt_vals = dt_vals.dropna()
        if len(dt_vals):
            stats = {
                "min": str(dt_vals.min()),
                "max": str(dt_vals.max()),
                "span_days": int((dt_vals.max() - dt_vals.min()).days),
            }

    top_k = []
    if dtype in (TYPE_CATEGORICAL, TYPE_TEXT, TYPE_BOOLEAN):
        counts = non_null.astype(str).str.strip().value_counts().head(config.TOP_K_CATEGORIES)
        top_k = [{"value": str(k)[:80], "count": int(v)} for k, v in counts.items()]

    histogram = []
    if dtype in NUMERIC_TYPES:
        vals = pd.to_numeric(non_null.astype(str).str.replace(r"[$,%\s]", "", regex=True).replace({"": np.nan}), errors="coerce")
        histogram = _build_histogram(vals.dropna())

    return {
        "name": name,
        "inferred_type": dtype,
        "confidence": round(confidence, 2),
        "semantic": detect_semantic(name),
        "null_count": null_count,
        "null_pct": round(null_count / total * 100, 2),
        "distinct_count": distinct_count,
        "cardinality": _cardinality(distinct_count, len(non_null)),
        "stats": stats,
        "top_k": top_k,
        "histogram": histogram,
        "sample_values": [_json_safe(v) for v in non_null.head(5).tolist()],
    }


def profile_dataframe(df: pd.DataFrame) -> list[dict]:
    return [profile_column(name, df[name]) for name in df.columns]


def overview_summary(df: pd.DataFrame, columns: list[dict]) -> dict:
    num_cols = [c for c in columns if c["inferred_type"] in NUMERIC_TYPES]
    cat_cols = [c for c in columns if c["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)]
    date_cols = [c for c in columns if c["inferred_type"] == TYPE_DATETIME]
    return {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "numeric_columns": len(num_cols),
        "categorical_columns": len(cat_cols),
        "datetime_columns": len(date_cols),
        "text_columns": len([c for c in columns if c["inferred_type"] == TYPE_TEXT]),
        "duplicate_count": int(df.duplicated().sum()),
        "total_cells": int(len(df) * len(df.columns)),
        "missing_cells": int(df.map(_is_missing).sum().sum()),
        "missing_pct": round(float(df.map(_is_missing).sum().sum()) / max(len(df) * len(df.columns), 1) * 100, 2),
    }
