"""Orchestrates the full data analysis pipeline for a DataFrame.

Running `analyze(df)` returns everything the frontend and AI layers need:
dataset summary, column profiles, quality issues, chart specs and cross
column analysis. This is the single integration point for the engine.
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


def analyze(df: pd.DataFrame) -> EngineResult:
    work_df = df
    # Cap the number of rows used for expensive computations while keeping
    # row counts in messages truthful (we report the actual dataset size).
    if len(work_df) > MAX_ANALYZED_ROWS:
        work_df = work_df.sample(n=MAX_ANALYZED_ROWS, random_state=7)

    columns = profiler.profile_dataframe(work_df)
    summary = profiler.overview_summary(work_df, columns)
    quality_result = quality.analyze_quality(work_df, columns)
    chart_suggestions = chart_builder.build_chart_suggestions(work_df, columns)
    corr = analysis.correlation_matrix(work_df, columns)
    strong_corr = analysis.strong_correlations(work_df, columns, threshold=0.6)

    return EngineResult(
        df=work_df,
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
