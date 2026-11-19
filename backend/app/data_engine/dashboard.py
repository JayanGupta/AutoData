"""Full-dataset aggregates for custom dashboard widgets."""

import math

import numpy as np
import pandas as pd

from .cleaning import matching_rows

from .analysis import _parse_numeric


def _kpi_value(rows, column: str | None, aggregation: str | None) -> int | float | None:
    if aggregation == "none":
        raise ValueError("KPI cards require a summary.")
    if column == "_rows":
        return len(rows)
    if column not in rows.columns:
        return None
    values = rows[column].dropna()
    values = values[values.ne("")]
    if aggregation == "count":
        return len(values)
    if aggregation == "unique":
        return int(values.nunique())
    numbers = _parse_numeric(values).dropna()
    if numbers.empty:
        return None
    value = float(numbers.agg("mean" if aggregation == "avg" else aggregation or "sum"))
    return value if math.isfinite(value) else None


def _chart_values(rows, widget: dict) -> list[dict]:
    x, y = widget.get("x"), widget.get("y")
    if x not in rows.columns or (y and y not in rows.columns):
        return []
    kind = widget.get("chart_type")
    if widget.get("aggregation") == "none":
        if kind not in (None, "bar", "line", "area", "table") or not y:
            raise ValueError("Choose a numeric Y column and a bar, line, area or table for individual rows.")
        labels = rows[x]
        values = _parse_numeric(rows[y]).replace([math.inf, -math.inf], float("nan"))
        points = pd.DataFrame({"name": labels, "value": values}).dropna()
        if kind in ("line", "area"):
            order = points["name"]
            if widget.get("date_axis"):
                order = pd.to_datetime(order, format="mixed", errors="coerce", utc=True)
            elif not pd.api.types.is_numeric_dtype(order):
                order = order.astype(str)
            points = points.loc[order.dropna().sort_values(kind="stable").index]
        return [{"name": str(label), "value": float(value)}
                for label, value in points.head(400).itertuples(index=False, name=None)]
    if kind == "scatter":
        if not y:
            return []
        pairs = pd.DataFrame({"x": _parse_numeric(rows[x]), "y": _parse_numeric(rows[y])})
        pairs = pairs.replace([math.inf, -math.inf], float("nan")).dropna()
        if len(pairs) > 400:
            pairs = pairs.sample(400, random_state=7)
        return [{"name": str(a), "value": float(b)} for a, b in pairs.itertuples(index=False, name=None)]
    if kind == "histogram":
        values = _parse_numeric(rows[x]).replace([math.inf, -math.inf], float("nan")).dropna()
        if values.empty:
            return []
        counts, edges = np.histogram(values, bins=min(12, values.nunique()))
        return [{"name": f"{lo:.6g}–{hi:.6g}", "value": int(n)}
                for lo, hi, n in zip(edges[:-1], edges[1:], counts)]
    labels = rows[x]
    if widget.get("date_axis"):
        labels = pd.to_datetime(labels, format="mixed", errors="coerce", utc=True).dt.strftime("%Y-%m-%d")
    if y:
        values = _parse_numeric(rows[y]).replace([math.inf, -math.inf], float("nan")).dropna()
        fn = widget.get("aggregation") or "sum"
        grouped = values.groupby(labels, sort=False).agg({"avg": "mean", "unique": "nunique"}.get(fn, fn))
    else:
        grouped = labels.value_counts(sort=False)
    if kind in ("line", "area"):
        grouped = grouped.sort_index(key=lambda index: index if pd.api.types.is_numeric_dtype(index) else index.astype(str))
        grouped = grouped.tail(30)
    else:
        grouped = grouped.sort_values(ascending=False, kind="stable").head(10)
    return [{"name": str(label), "value": float(value)} for label, value in grouped.items() if math.isfinite(value)]


def calculate_dashboard_metrics(df, widgets: list[dict], *, search: str, category_column: str, category_value: str, row_filter: dict | None = None) -> dict:
    rows = df
    if row_filter:
        rows = rows.loc[matching_rows(rows, **row_filter)]
    if category_column in df.columns and category_value:
        rows = rows[rows[category_column].astype("string").eq(category_value).fillna(False)]
    if query := search.strip():
        matches = pd.Series(False, index=rows.index)
        for column in rows.columns:
            matches |= rows[column].astype("string").str.contains(query, case=False, regex=False, na=False)
        rows = rows[matches]

    kpis, charts = {}, {}
    for widget in widgets:
        if widget["type"] == "kpi":
            kpis[widget["id"]] = _kpi_value(rows, widget["column"], widget["aggregation"])
        elif widget["type"] == "chart":
            chart_rows = rows
            if condition := widget.get("row_filter"):
                if condition["column"] not in rows.columns:
                    charts[widget["id"]] = []
                    continue
                chart_rows = rows.loc[matching_rows(rows, **condition)]
            charts[widget["id"]] = _chart_values(chart_rows, widget)
    return {"matched_rows": len(rows), "kpis": kpis, "charts": charts}
