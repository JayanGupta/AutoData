"""Declarative chart spec generation.

Builds a list of chart suggestions the frontend can render directly. Charts
are chosen based on the inferred column types, and data is pre-aggregated so
the browser never receives raw, unsampled datasets.
"""

from __future__ import annotations

import pandas as pd

from .. import config
from . import analysis
from .profiler import NUMERIC_TYPES

TYPE_DATETIME = "datetime"
TYPE_CATEGORICAL = "categorical"
TYPE_BOOLEAN = "boolean"
TYPE_FLOAT = "float"
TYPE_INTEGER = "integer"

CHART_BAR = "bar"
CHART_LINE = "line"
CHART_HISTOGRAM = "histogram"
CHART_SCATTER = "scatter"
CHART_HEATMAP = "heatmap"
CHART_PIE = "pie"


def _mk(chart_id: str, chart_type: str, title: str, data: list, x_key: str, y_key: str, **extra) -> dict:
    return {
        "id": chart_id,
        "chart_type": chart_type,
        "title": title,
        "data": data,
        "x": x_key,
        "y": y_key,
        **extra,
    }


def _sample_for_scatter(df: pd.DataFrame) -> pd.DataFrame:
    if len(df) > config.CHART_SAMPLE_ROWS:
        return df.sample(n=config.CHART_SAMPLE_ROWS, random_state=42)
    return df


def build_chart_suggestions(df: pd.DataFrame, profiles: list[dict]) -> list[dict]:
    charts = []
    seen = set()

    numeric = [p for p in profiles if p["inferred_type"] in NUMERIC_TYPES]
    categorical = [p for p in profiles if p["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)]
    datetime_cols = [p for p in profiles if p["inferred_type"] == TYPE_DATETIME]

    idx = 0

    # 1. Histograms for numeric columns
    for p in numeric[:6]:
        hist = p["histogram"]
        if not hist:
            continue
        data = [
            {"label": f"{b['bin_start']:g}-{b['bin_end']:g}", "count": b["count"]}
            for b in hist
        ]
        charts.append(_mk(
            f"c{idx}", CHART_HISTOGRAM, f"Distribution of {p['name']}", data, "label", "count",
        ))
        seen.add(("hist", p["name"]))
        idx += 1

    # 2. Time series: datetime vs numeric
    for dt in datetime_cols[:3]:
        for num in numeric[:3]:
            key = ("ts", dt["name"], num["name"])
            if key in seen:
                continue
            data = analysis.time_series(df, dt["name"], num["name"], agg="mean")
            if len(data) < 2:
                continue
            charts.append(_mk(
                f"c{idx}", CHART_LINE, f"{num['name']} over time", data, "date", "value",
            ))
            seen.add(key)
            idx += 1

    # 3. Categorical breakdowns: category vs numeric aggregate
    for cat in categorical[:5]:
        for num in numeric[:3]:
            key = ("agg", cat["name"], num["name"])
            if key in seen:
                continue
            data = analysis.grouped_aggregate(df, cat["name"], num["name"], agg="sum", limit=config.TOP_K_CATEGORIES)
            if len(data) < 2:
                continue
            charts.append(_mk(
                f"c{idx}", CHART_BAR, f"{num['name']} by {cat['name']}", data, "group", "value",
                aggregation="sum",
            ))
            seen.add(key)
            idx += 1

    # 4. Category counts
    for cat in categorical[:5]:
        key = ("count", cat["name"])
        if key in seen:
            continue
        data = analysis.count_by_category(df, cat["name"], limit=config.TOP_K_CATEGORIES)
        if len(data) < 2:
            continue
        charts.append(_mk(
            f"c{idx}", CHART_PIE, f"Distribution of {cat['name']}", data, "group", "value",
        ))
        seen.add(key)
        idx += 1

    # 5. Scatter plots for numeric pairs
    scatter_pairs = 0
    for i in range(len(numeric)):
        for j in range(i + 1, len(numeric)):
            if scatter_pairs >= 4:
                break
            a, b = numeric[i], numeric[j]
            key = ("scatter", a["name"], b["name"])
            if key in seen:
                continue
            sub = _sample_for_scatter(df[[a["name"], b["name"]]])
            clean = sub.copy()
            for col in (a["name"], b["name"]):
                clean[col] = pd.to_numeric(
                    sub[col].astype(object).map(
                        lambda v: None if v is None or (isinstance(v, float) and pd.isna(v)) else str(v).replace(",", "").strip()
                    ),
                    errors="coerce",
                )
            clean = clean.dropna()
            if len(clean) < 5:
                continue
            data = clean.head(config.CHART_SAMPLE_ROWS).to_dict("records")
            charts.append(_mk(
                f"c{idx}", CHART_SCATTER, f"{a['name']} vs {b['name']}",
                data, a["name"], b["name"],
            ))
            seen.add(key)
            idx += 1
            scatter_pairs += 1
        if scatter_pairs >= 4:
            break

    # 6. Correlation heatmap when there are 2+ numeric columns
    corr = analysis.correlation_matrix(df, profiles)
    if len(corr["columns"]) >= 2:
        charts.append(_mk(
            f"c{idx}", CHART_HEATMAP, "Correlation heatmap",
            [], "", "", columns=corr["columns"], matrix=corr["matrix"],
        ))
        idx += 1

    return charts
