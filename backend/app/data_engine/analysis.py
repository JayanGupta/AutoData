"""Cross-column analysis: correlations, aggregations and groupings."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .profiler import NUMERIC_TYPES, _is_missing


def _parse_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(
        series.astype(object).map(lambda v: None if _is_missing(v) else str(v).replace(",", "").strip()),
        errors="coerce",
    )


def correlation_matrix(df: pd.DataFrame, profiles: list[dict]) -> dict:
    numeric_cols = [
        (p["name"], p["inferred_type"]) for p in profiles if p["inferred_type"] in NUMERIC_TYPES
    ]
    if len(numeric_cols) < 2:
        return {"columns": [], "matrix": []}

    matrix = pd.DataFrame({name: _parse_numeric(df[name]) for name, _ in numeric_cols})
    corr = matrix.corr().round(3)

    columns = [c for c, _ in numeric_cols]
    return {
        "columns": columns,
        "matrix": [[None if pd.isna(v) else float(v) for v in row] for _, row in corr.iterrows()],
    }


def strong_correlations(df: pd.DataFrame, profiles: list[dict], threshold: float = 0.6) -> list[dict]:
    corr = correlation_matrix(df, profiles)
    if not corr["matrix"]:
        return []
    cols = corr["columns"]
    pairs = []
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            v = corr["matrix"][i][j]
            if v is not None and abs(v) >= threshold:
                pairs.append({
                    "col_a": cols[i],
                    "col_b": cols[j],
                    "correlation": float(v),
                    "strength": "positive" if v > 0 else "negative",
                })
    pairs.sort(key=lambda p: abs(p["correlation"]), reverse=True)
    return pairs


def grouped_aggregate(
    df: pd.DataFrame, group_col: str, value_col: str, agg: str = "sum", limit: int = 15
) -> list[dict]:
    """Group by a categorical column and aggregate a numeric column."""
    group_series = df[group_col].astype(str).str.strip()
    value_series = _parse_numeric(df[value_col])
    tmp = pd.DataFrame({"group": group_series, "value": value_series}).dropna(subset=["value"])
    if tmp.empty:
        return []
    grouped = tmp.groupby("group", dropna=False)["value"].agg(agg)
    grouped = grouped.sort_values(ascending=False).head(limit)
    return [{"group": str(k), "value": round(float(v), 4)} for k, v in grouped.items()]


def count_by_category(df: pd.DataFrame, col: str, limit: int = 15) -> list[dict]:
    counts = df[col].astype(str).str.strip().value_counts().head(limit)
    return [{"group": str(k), "value": int(v)} for k, v in counts.items()]


def time_series(
    df: pd.DataFrame, date_col: str, value_col: str, agg: str = "mean"
) -> list[dict]:
    dates = pd.to_datetime(df[date_col], errors="coerce")
    values = _parse_numeric(df[value_col])
    tmp = pd.DataFrame({"date": dates, "value": values}).dropna(subset=["date", "value"]).sort_values("date")
    if tmp.empty:
        return []
    by_day = tmp.groupby(tmp["date"].dt.date)["value"].agg(agg).reset_index()
    by_day.columns = ["date", "value"]
    return [{"date": str(d), "value": round(float(v), 4)} for d, v in zip(by_day["date"], by_day["value"])]


def temporal_trend(
    df: pd.DataFrame, date_col: str, value_col: str, threshold: float = 0.2
) -> dict | None:
    """Compare mean of first half vs second half of the time range."""
    dates = pd.to_datetime(df[date_col], errors="coerce")
    values = _parse_numeric(df[value_col])
    tmp = pd.DataFrame({"date": dates, "value": values}).dropna(subset=["date", "value"]).sort_values("date")
    if len(tmp) < 10:
        return None
    midpoint = tmp["date"].quantile(0.5)
    first = tmp.loc[tmp["date"] <= midpoint, "value"].mean()
    second = tmp.loc[tmp["date"] > midpoint, "value"].mean()
    if first == 0 or pd.isna(first) or pd.isna(second):
        return None
    change = (second - first) / first
    if abs(change) < threshold:
        return None
    return {
        "date_col": date_col,
        "value_col": value_col,
        "first_half_mean": round(float(first), 4),
        "second_half_mean": round(float(second), 4),
        "change_pct": round(float(change * 100), 2),
        "direction": "up" if change > 0 else "down",
    }
