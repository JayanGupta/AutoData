"""Orchestrates the full data analysis pipeline for a DataFrame.

Running `analyze(df)` returns everything the frontend and AI layers need:
dataset summary, column profiles, quality issues, chart specs and cross
column analysis. This is the single integration point for the engine.

The full dataframe is always kept on `EngineResult.df` (used for previews,
row browsing and SQL queries). Expensive profiling/quality/chart computations
run on a deterministic sample when the dataset exceeds `MAX_ANALYZED_ROWS` so
analysis stays fast; row/column counts reported in the summary always reflect
the real dataset size.
"""

from __future__ import annotations

import pandas as pd

from . import analysis, charts as chart_builder, profiler, quality
from ..config import MAX_ANALYZED_ROWS, PREVIEW_ROWS


class EngineResult:
    """Container holding every derived artefact for one dataset."""

    def __init__(
        self,
        df: pd.DataFrame,
        columns: list[dict],
        summary: dict,
        quality: dict,
        chart_suggestions: list[dict],
        correlations: dict,
        strong_correlations: list[dict],
    ):
        self.df = df
        self.columns = columns
        self.summary = summary
        self.quality = quality
        self.chart_suggestions = chart_suggestions
        self.correlations = correlations
        self.strong_correlations = strong_correlations
        self._insights_cache: list[dict] | None = None

    def cached_insights(self, limit: int = 12) -> list[dict]:
        from ..ai.insights import generate_insights

        if self._insights_cache is None:
            self._insights_cache = generate_insights(self, limit=limit)
        return self._insights_cache[:limit]

    def invalidate(self):
        """Invalidate derived caches (called after cleaning operations)."""
        self._insights_cache = None


def analyze(df: pd.DataFrame) -> EngineResult:
    full_df = df
    work_df = df
    # Cap the number of rows used for expensive computations while keeping
    # row counts truthful (we report the actual dataset size in the summary).
    if len(work_df) > MAX_ANALYZED_ROWS:
        work_df = work_df.sample(n=MAX_ANALYZED_ROWS, random_state=7)

    columns = profiler.profile_dataframe(work_df)
    summary = profiler.overview_summary(full_df, columns)
    quality_result = quality.analyze_quality(work_df, columns)
    chart_suggestions = chart_builder.build_chart_suggestions(work_df, columns)
    corr = analysis.correlation_matrix(work_df, columns)
    strong_corr = analysis.strong_correlations(work_df, columns, threshold=0.6)

    return EngineResult(
        df=full_df,
        columns=columns,
        summary=summary,
        quality=quality_result,
        chart_suggestions=chart_suggestions,
        correlations=corr,
        strong_correlations=strong_corr,
    )


def preview_rows(df: pd.DataFrame, n: int = PREVIEW_ROWS) -> list[dict]:
    head = df.head(n)
    preview = head.astype(object).where(pd.notna(head), None)
    return preview.to_dict("records")


def rows_slice(df: pd.DataFrame, offset: int = 0, limit: int = PREVIEW_ROWS) -> list[dict]:
    """Return a JSON-safe window of rows (offset, limit) from the dataframe."""
    window = df.iloc[offset : offset + limit]
    converted = window.astype(object).where(pd.notna(window), None)
    return converted.to_dict("records")
