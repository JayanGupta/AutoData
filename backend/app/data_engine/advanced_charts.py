"""Advanced chart specs for the Visualizations experience.

Produces declarative chart specifications (consumed by the frontend) for chart
types beyond the basic bar/line/histogram set: box plots, distributions with
KDE overlays, area charts, stacked bars, multi-series lines, radar, bubble,
treemap, sunburst, pair plots and a correlation heatmap. Also builds
intelligent chart recommendations with human-readable reasons derived from the
actual schema and data.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from . import analysis

_NUMERIC_TYPES = ("integer", "float")
_CAT_TYPES = ("categorical", "boolean")

MAX_POINTS = 500


def _numeric_profiles(engine) -> list[dict]:
    return [c for c in engine.columns if c["inferred_type"] in _NUMERIC_TYPES]


def _categorical_profiles(engine) -> list[dict]:
    """Meaningful categoricals: excludes identifier-like and high-cardinality columns."""
    def _is_meaningful(col: dict) -> bool:
        if col.get("semantic") == "identifier":
            return False
        if col.get("sensitive"):
            return False
        if col["cardinality"] == "high":
            return False
        return True

    return [c for c in engine.columns
            if c["inferred_type"] in _CAT_TYPES and _is_meaningful(c)]


def _datetime_profiles(engine) -> list[dict]:
    return [c for c in engine.columns if c["inferred_type"] == "datetime"]


def _sample(df: pd.DataFrame, n: int = MAX_POINTS) -> pd.DataFrame:
    return df.sample(n=n, random_state=11) if len(df) > n else df


def _round(v, digits: int = 4):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(f):
        return None
    return round(f, digits)


def box_spec(engine) -> dict | None:
    cols = _numeric_profiles(engine)
    if not cols:
        return None
    data = []
    for col in cols[:6]:
        stats = col.get("stats") or {}
        vals = engine.df[col["name"]].dropna()
        try:
            lo, hi = vals.quantile(0.05), vals.quantile(0.95)
        except TypeError:
            lo = hi = None
        outliers = int(((vals < lo) | (vals > hi)).sum()) if lo is not None and hi is not None else 0
        data.append({
            "name": col["name"],
            "min": _round(stats.get("min")),
            "q1": _round(stats.get("q1")),
            "median": _round(stats.get("median")),
            "q3": _round(stats.get("q3")),
            "max": _round(stats.get("max")),
            "p05": _round(lo),
            "p95": _round(hi),
            "outliers": outliers,
        })
    return {
        "chart_type": "box",
        "title": "Distribution comparison across numeric columns",
        "description": "Whiskers span the 5th–95th percentiles; the box marks quartiles.",
        "data": data,
    }


def _kde_points(values: pd.Series, n: int = 80) -> list[dict]:
    vals = pd.to_numeric(values, errors="coerce").dropna()
    if len(vals) < 3:
        return []
    lo, hi = float(vals.min()), float(vals.max())
    span = hi - lo
    lo -= span * 0.05
    hi += span * 0.05
    grid = np.linspace(lo, hi, n)
    std = float(vals.std())
    h = 1.06 * std * len(vals) ** (-1 / 5)
    h = max(h, span / max(len(vals), 10) * 2, 1e-9)
    kde = np.zeros_like(grid)
    data = vals.to_numpy()
    for x in data:
        kde += np.exp(-0.5 * ((grid - x) / h) ** 2)
    kde /= h * math.sqrt(2 * math.pi) * len(data)
    peak = float(kde.max()) if kde.max() > 0 else 1.0
    return [{"x": _round(float(g), 4), "y": _round(float(k) / peak, 4)} for g, k in zip(grid, kde)]


def distribution_specs(engine) -> list[dict]:
    specs = []
    for col in _numeric_profiles(engine)[:3]:
        hist = col.get("histogram") or []
        density = _kde_points(engine.df[col["name"]])
        stats = col.get("stats") or {}
        specs.append({
            "chart_type": "distribution",
            "title": f"Distribution of {col['name']}",
            "description": (
                f"mean {_round(stats.get('mean'))}, median {_round(stats.get('median'))}, "
                f"skew {_round(stats.get('skewness'))}"
            ),
            "column": col["name"],
            "data": {
                "bins": [
                    {"bin": f"{_round(b['bin_start'], 2)}–{_round(b['bin_end'], 2)}",
                     "start": b["bin_start"], "end": b["bin_end"], "count": b["count"]}
                    for b in hist
                ],
                "density": density,
            },
        })
    return specs


def area_specs(engine) -> list[dict]:
    specs = []
    dt_cols = _datetime_profiles(engine)
    numerics = _numeric_profiles(engine)
    if not dt_cols or not numerics:
        return specs
    for num in numerics[:3]:
        ts = analysis.time_series(engine.df, dt_cols[0]["name"], num["name"], agg="mean")
        specs.append({
            "chart_type": "area",
            "title": f"{num['name']} over time",
            "description": f"Daily mean of {num['name']} across {dt_cols[0]['name']}.",
            "data": ts[:200],
            "x": "date",
            "y": "value",
        })
    return specs


def stacked_bar_specs(engine) -> list[dict]:
    specs = []
    cats = _categorical_profiles(engine)
    if len(cats) < 2:
        return specs
    a, b = cats[0]["name"], cats[1]["name"]
    tmp = engine.df[[a, b]].astype(str)
    counts = tmp.groupby([a, b]).size().reset_index(name="count")
    top_b = counts.groupby(b)["count"].sum().sort_values(ascending=False).head(6).index.tolist()
    series_b = [x for x in top_b if x != "nan"][:5]
    rows = []
    for group, sub in counts.groupby(a):
        total = int(sub["count"].sum())
        if total == 0:
            continue
        row = {"group": str(group)}
        for s in series_b:
            row[s] = int(sub.loc[sub[b] == s, "count"].sum())
        row["other"] = int(sub.loc[~sub[b].isin(series_b), "count"].sum())
        rows.append(row)
    rows.sort(key=lambda r: -sum(v for k, v in r.items() if k != "group"))
    specs.append({
        "chart_type": "stacked_bar",
        "title": f"{b} composition by {a}",
        "description": "Stacked segments show how each category is composed.",
        "x": "group",
        "series": series_b + ["other"],
        "data": rows[:12],
    })
    return specs


def multi_line_specs(engine) -> list[dict]:
    dt_cols = _datetime_profiles(engine)
    numerics = _numeric_profiles(engine)
    if not dt_cols or len(numerics) < 2:
        return []
    date_col = dt_cols[0]["name"]
    df = engine.df[engine.df[date_col].notna()].copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col])
    for col in numerics[:4]:
        df[col["name"]] = pd.to_numeric(df[col["name"]], errors="coerce")
    df["_day"] = df[date_col].dt.date
    agg = df.groupby("_day")[[c["name"] for c in numerics[:4]]].mean(numeric_only=True).reset_index()
    agg["date"] = agg["_day"].astype(str)
    series = [c["name"] for c in numerics[:4]]
    data = agg[["date"] + series].dropna(subset=["date"]).to_dict("records")
    return [{
        "chart_type": "multi_line",
        "title": "Numeric columns over time",
        "description": f"Daily means for {', '.join(series)}.",
        "x": "date",
        "series": series,
        "data": data[:200],
    }]


def radar_specs(engine) -> list[dict]:
    specs = []
    cats = _categorical_profiles(engine)
    numerics = _numeric_profiles(engine)
    if not cats or not numerics:
        return specs
    for num in numerics[:2]:
        grouped = analysis.grouped_aggregate(engine.df, cats[0]["name"], num["name"], agg="mean", limit=8)
        specs.append({
            "chart_type": "radar",
            "title": f"Mean {num['name']} by {cats[0]['name']}",
            "description": "Each axis is a category; the ring shows relative magnitude.",
            "data": grouped,
        })
    return specs


def bubble_spec(engine) -> dict | None:
    numerics = _numeric_profiles(engine)
    if len(numerics) < 3:
        return None
    x, y, size = numerics[0]["name"], numerics[1]["name"], numerics[2]["name"]
    df = _sample(engine.df)
    rows = []
    for _, row in df[[x, y, size]].dropna().iterrows():
        rows.append({
            "x": _round(row[x]), "y": _round(row[y]),
            "size": abs(_round(row[size], 2)) or 1,
        })
    return {
        "chart_type": "bubble",
        "title": f"{x} vs {y} (sized by {size})",
        "description": "Bubble area encodes the third numeric dimension.",
        "x": x, "y": y, "size": size,
        "data": rows[:MAX_POINTS],
    }


def treemap_spec(engine) -> dict | None:
    cats = _categorical_profiles(engine)
    if not cats:
        return None
    counts = analysis.count_by_category(engine.df, cats[0]["name"], limit=10)
    data = [{"name": c["group"], "value": c["value"]} for c in counts]
    return {
        "chart_type": "treemap",
        "title": f"Share of {cats[0]['name']}",
        "description": "Area encodes each category's share of rows.",
        "data": data,
    }


def sunburst_spec(engine) -> dict | None:
    cats = _categorical_profiles(engine)
    if len(cats) < 2:
        return None
    a, b = cats[0]["name"], cats[1]["name"]
    tmp = engine.df[[a, b]].astype(str).replace("nan", "Other")
    counts = tmp.groupby([a, b]).size().reset_index(name="value")
    children = {}
    for _, row in counts.iterrows():
        children.setdefault(row[a], []).append({"name": row[b], "value": int(row["value"])})
    top_a = sorted(children, key=lambda k: sum(c["value"] for c in children[k]), reverse=True)[:8]
    data = [{"name": k, "children": sorted(children[k], key=lambda c: -c["value"])[:6]} for k in top_a]
    return {
        "chart_type": "sunburst",
        "title": f"{b} breakdown of {a}",
        "description": "Inner ring is the primary category; outer segments its composition.",
        "data": data,
    }


def pair_plot_spec(engine) -> dict | None:
    numerics = _numeric_profiles(engine)
    if len(numerics) < 2:
        return None
    cols = [c["name"] for c in numerics[:4]]
    df = _sample(engine.df)[cols].dropna()
    rows = df.head(MAX_POINTS).to_dict("records")
    return {
        "chart_type": "pair_plot",
        "title": "Scatter matrix of numeric columns",
        "description": "Every pair of numeric columns, side by side, reveals joint structure.",
        "columns": cols,
        "data": rows,
    }


def correlation_spec(engine) -> dict | None:
    if not engine.correlations or not engine.correlations.get("matrix"):
        return None
    return {
        "chart_type": "correlation",
        "title": "Correlation matrix",
        "description": "Pearson correlation between every pair of numeric columns.",
        "columns": engine.correlations["columns"],
        "matrix": engine.correlations["matrix"],
    }


def violin_specs(engine) -> list[dict]:
    """Violin plots: mirrored KDE for up to 3 numeric columns."""
    specs = []
    for col in _numeric_profiles(engine)[:3]:
        vals = pd.to_numeric(engine.df[col["name"]], errors="coerce").dropna()
        if len(vals) < 5:
            continue
        density = _kde_points(vals, n=60)
        if not density:
            continue
        stats = col.get("stats") or {}
        specs.append({
            "chart_type": "violin",
            "title": f"Distribution of {col['name']}",
            "description": (
                f"median {_round(stats.get('median'))}, IQR "
                f"{_round(stats.get('q1'))}–{_round(stats.get('q3'))}"
            ),
            "column": col["name"],
            "data": {
                "median": _round(stats.get("median")),
                "q1": _round(stats.get("q1")),
                "q3": _round(stats.get("q3")),
                "min": _round(float(vals.min())),
                "max": _round(float(vals.max())),
                "density": density,
            },
        })
    return specs


def _normal_ppf(q: np.ndarray) -> np.ndarray:
    """Acklam's approximation of the standard normal inverse CDF (vectorised)."""
    q = np.clip(np.asarray(q, dtype=float), 1e-12, 1 - 1e-12)
    a = [-39.69683028665376, 220.9460984245205, -275.9285104469687,
         138.3577518672690, -30.66479806614716, 2.506628277459239]
    b = [-54.47609879822406, 161.5858368580409, -155.6989798598866,
         66.80131188771972, -13.28068155288572]
    c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838,
         -2.549732539343734, 4.374664141464968, 2.938163982698783]
    d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996,
         3.754408661907416]
    p_low = 0.02425
    x = np.zeros_like(q)
    low = q < p_low
    high = q > 1 - p_low
    mid = ~(low | high)
    qq = q[low]
    r = np.sqrt(-2 * np.log(qq))
    x[low] = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / \
             ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1)
    qq = q[high]
    r = np.sqrt(-2 * np.log(1 - qq))
    x[high] = -(((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / \
              ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1)
    qq = q[mid]
    r = qq - 0.5
    r2 = r * r
    x[mid] = (((((a[0] * r2 + a[1]) * r2 + a[2]) * r2 + a[3]) * r2 + a[4]) * r2 + a[5]) * r / \
             (((((b[0] * r2 + b[1]) * r2 + b[2]) * r2 + b[3]) * r2 + b[4]) * r2 + 1)
    return x


def qq_specs(engine) -> list[dict]:
    """QQ plots vs the normal distribution for numeric columns."""
    specs = []
    for col in _numeric_profiles(engine)[:3]:
        vals = pd.to_numeric(engine.df[col["name"]], errors="coerce").dropna()
        if len(vals) < 10:
            continue
        sorted_vals = np.sort(vals.to_numpy())
        n = len(sorted_vals)
        probs = (np.arange(1, n + 1) - 0.5) / n
        theoretical = _normal_ppf(probs)
        data = [
            {"x": _round(float(t), 4), "y": _round(float(v), 4)}
            for t, v in zip(theoretical, sorted_vals)
        ]
        stats = col.get("stats") or {}
        specs.append({
            "chart_type": "qq",
            "title": f"Q-Q plot of {col['name']}",
            "description": (
                f"Points near the diagonal suggest normality (skew {_round(stats.get('skewness'))})."
            ),
            "column": col["name"],
            "data": data,
        })
    return specs


def parallel_specs(engine) -> list[dict]:
    """Parallel coordinates for up to 6 numeric columns."""
    numerics = _numeric_profiles(engine)
    if len(numerics) < 3:
        return []
    cols = [c["name"] for c in numerics[:6]]
    df = _sample(engine.df)
    frame = df[cols].apply(pd.to_numeric, errors="coerce")
    frame = frame.dropna().head(MAX_POINTS)
    if len(frame) < 5:
        return []
    mins, maxs = frame.min(), frame.max()
    spans = (maxs - mins).replace(0, 1)
    rows = []
    for _, r in frame.iterrows():
        row = {}
        for c in cols:
            row[c] = _round(float((r[c] - mins[c]) / spans[c]), 4)
        rows.append(row)
    return [{
        "chart_type": "parallel",
        "title": "Parallel coordinates of numeric columns",
        "description": "Each line is a row; crossing lines reveal anti-correlated columns.",
        "columns": cols,
        "data": rows[:250],
    }]


def seasonal_specs(engine) -> list[dict]:
    """Simple trend / seasonal / residual decomposition for a datetime + numeric pair."""
    dts = _datetime_profiles(engine)
    numerics = _numeric_profiles(engine)
    if not dts or not numerics:
        return []
    date_col = dts[0]["name"]
    value_col = numerics[0]["name"]
    dates = pd.to_datetime(engine.df[date_col], errors="coerce")
    values = pd.to_numeric(engine.df[value_col], errors="coerce")
    frame = pd.DataFrame({"date": dates, "value": values}).dropna().sort_values("date")
    if len(frame) < 14:
        return []
    frame = frame.set_index("date")["value"].resample("D").mean()
    frame = frame.dropna()
    if len(frame) < 14:
        return []
    trend = frame.rolling(7, min_periods=3).mean()
    detrended = frame - trend
    weekday = pd.Series(detrended.index.dayofweek, index=detrended.index)
    seasonal = detrended.groupby(weekday).transform("mean")
    residual = detrended - seasonal
    data = [
        {
            "date": str(idx.date()),
            "actual": _round(float(a), 4),
            "trend": _round(float(t), 4) if not pd.isna(t) else None,
            "seasonal": _round(float(s), 4),
            "residual": _round(float(r), 4),
        }
        for idx, a, t, s, r in zip(frame.index, frame, trend, seasonal, residual)
    ][:: max(1, len(frame) // 180)]
    return [{
        "chart_type": "seasonal",
        "title": f"Trend & seasonality of {value_col}",
        "description": "Additive decomposition: trend (7-day rolling mean), weekly seasonal pattern and residuals.",
        "x": "date",
        "y": value_col,
        "data": data,
    }]


def build_advanced_charts(engine) -> list[dict]:
    specs = []
    for builder in (
        correlation_spec, box_spec, pair_plot_spec, bubble_spec,
        distribution_specs, violin_specs, qq_specs, area_specs, seasonal_specs,
        stacked_bar_specs, multi_line_specs, parallel_specs,
        radar_specs, treemap_spec, sunburst_spec,
    ):
        result = builder(engine)
        if result is None:
            continue
        if isinstance(result, list):
            specs.extend(result)
        else:
            specs.append(result)
    return specs


def build_chart_recommendations(engine) -> list[dict]:
    """Intelligent next-analysis suggestions with reasons (rule-based)."""
    recs = []
    numerics = _numeric_profiles(engine)
    cats = _categorical_profiles(engine)
    dts = _datetime_profiles(engine)

    if dts and numerics:
        recs.append({
            "chart_type": "area",
            "title": f"Trend of {numerics[0]['name']} over time",
            "reason": f"{dts[0]['name']} is a date column and {numerics[0]['name']} is numeric — "
                      "a time series is the most natural way to see direction and seasonality.",
        })
    if len(numerics) >= 2:
        a, b = numerics[0]["name"], numerics[1]["name"]
        recs.append({
            "chart_type": "scatter",
            "title": f"{a} vs {b}",
            "reason": "Two numeric columns invite a scatter plot to spot correlation and outliers.",
        })
        if len(numerics) >= 3:
            recs.append({
                "chart_type": "bubble",
                "title": f"{a} vs {b} sized by {numerics[2]['name']}",
                "reason": "A third numeric column adds a dimension a scatter plot can't show.",
            })
    if numerics:
        recs.append({
            "chart_type": "box",
            "title": "Compare numeric distributions",
            "reason": "Box plots summarise spread, quartiles and outliers across all numeric columns at once.",
        })
        recs.append({
            "chart_type": "distribution",
            "title": f"Distribution of {numerics[0]['name']}",
            "reason": "A histogram with density overlay reveals skew, modality and central tendency.",
        })
    if cats and numerics:
        recs.append({
            "chart_type": "bar",
            "title": f"{numerics[0]['name']} by {cats[0]['name']}",
            "reason": "A categorical column plus a numeric one calls for a ranked comparison.",
        })
        if len(numerics) >= 2:
            recs.append({
                "chart_type": "radar",
                "title": f"Profile of {cats[0]['name']} across {numerics[1]['name']}",
                "reason": "Radar renders multi-axis comparison of category performance compactly.",
            })
    if len(cats) >= 2:
        recs.append({
            "chart_type": "treemap",
            "title": f"{cats[1]['name']} within {cats[0]['name']}",
            "reason": "Two categorical columns make a hierarchy visible with a treemap.",
        })
    if len(numerics) >= 2:
        recs.append({
            "chart_type": "pair_plot",
            "title": "Full scatter matrix",
            "reason": "Pair plots expose every pairwise relationship in one glance.",
        })
    return recs[:8]
