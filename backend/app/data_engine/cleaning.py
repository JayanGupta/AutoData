"""Dataset cleaning operations.

Each operation is a pure function `DataFrame -> (DataFrame, description)` so it
can be unit tested in isolation. Operations are applied to the session's working
dataframe and the analysis is recomputed afterwards, keeping every derived
artefact (summary, profiles, quality, charts) consistent with the cleaned data.
"""

from __future__ import annotations

import pandas as pd


def drop_column(df: pd.DataFrame, column: str) -> tuple[pd.DataFrame, str]:
    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist.")
    cleaned = df.drop(columns=[column]).reset_index(drop=True)
    return cleaned, f"Dropped column '{column}'"


def drop_duplicates(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    before = len(df)
    cleaned = df.drop_duplicates().reset_index(drop=True)
    removed = before - len(cleaned)
    return cleaned, f"Removed {removed:,} duplicate row{'s' if removed != 1 else ''}"


def drop_missing_rows(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    before = len(df)
    cleaned = df.dropna().reset_index(drop=True)
    removed = before - len(cleaned)
    return cleaned, f"Removed {removed:,} row{'s' if removed != 1 else ''} with missing values"


def fill_missing(df: pd.DataFrame, column: str, value) -> tuple[pd.DataFrame, str]:
    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist.")
    cleaned = df.copy()
    cleaned[column] = cleaned[column].fillna(value)
    return cleaned, f"Filled missing values in '{column}' with {value!r}"


OPERATIONS: dict[str, object] = {
    "drop_column": drop_column,
    "drop_duplicates": drop_duplicates,
    "drop_missing_rows": drop_missing_rows,
    "fill_missing": fill_missing,
}
