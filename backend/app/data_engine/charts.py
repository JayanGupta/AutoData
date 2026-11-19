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


def build_chart_suggestions(df: pd.DataFrame, profiles: list[dict]) -> list[dict]:
    numeric = [p for p in profiles if p["inferred_type"] in NUMERIC_TYPES]
    groups = sorted(
        (p for p in profiles if p["inferred_type"] in (TYPE_CATEGORICAL, TYPE_BOOLEAN)
         and p["distinct_count"] > 1 and p["distinct_count"] < max(3, len(df))),
        key=lambda p: p["distinct_count"],
    )
    dates = [p for p in profiles if p["inferred_type"] == TYPE_DATETIME]
    charts = []
    if dates and numeric:
        x, y = dates[0]["name"], numeric[0]["name"]
        points = analysis.time_series(df, x, y, agg="mean")
        if len(points) > 1:
            charts.append(_mk("trend", CHART_LINE, f"Average {y} over time", points,
                              "date", "value", source_x=x, source_y=y, aggregation="avg"))
    if groups:
        x = groups[0]["name"]
        y = numeric[0]["name"] if numeric else None
        points = (analysis.grouped_aggregate(df, x, y, agg="sum", limit=config.TOP_K_CATEGORIES)
                  if y else analysis.count_by_category(df, x, limit=config.TOP_K_CATEGORIES))
        if points:
            charts.append(_mk("breakdown", CHART_BAR, f"{y or 'Rows'} by {x}", points,
                              "group", "value", source_x=x, source_y=y, aggregation="sum" if y else "count"))
    for col in numeric:
        if len(charts) >= 2:
            break
        points = [{"label": f"{b['bin_start']:g}–{b['bin_end']:g}", "count": b["count"]}
                  for b in col["histogram"]]
        if points:
            charts.append(_mk(f"hist-{len(charts)}", CHART_HISTOGRAM,
                              f"Distribution of {col['name']}", points, "label", "count", source_x=col["name"]))
    return charts
