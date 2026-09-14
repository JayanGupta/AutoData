"""Dataset cleaning operations.

Each operation is a pure function `DataFrame -> (DataFrame, description)` so it
can be unit tested in isolation. Operations are applied to the session's working
dataframe and the analysis is recomputed afterwards, keeping every derived
artefact (summary, profiles, quality, charts) consistent with the cleaned data.
"""

from __future__ import annotations

import pandas as pd


def _require_column(df: pd.DataFrame, column: str) -> None:
    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist.")


def _coerce_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(
        series.astype(object).map(
            lambda v: None if v is None or (isinstance(v, float) and pd.isna(v)) else str(v).replace(",", "").strip()
        ),
        errors="coerce",
    )


def drop_column(df: pd.DataFrame, column: str) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    cleaned = df.drop(columns=[column]).reset_index(drop=True)
    return cleaned, f"Dropped column '{column}'"


def rename_column(df: pd.DataFrame, column: str, value: str) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    new_name = str(value).strip()
    if not new_name:
        raise ValueError("New column name cannot be empty.")
    if new_name in df.columns and new_name != column:
        raise ValueError(f"Column '{new_name}' already exists.")
    cleaned = df.rename(columns={column: new_name})
    return cleaned, f"Renamed column '{column}' to '{new_name}'"


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


def drop_missing_in_column(df: pd.DataFrame, column: str) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    before = len(df)
    cleaned = df.dropna(subset=[column]).reset_index(drop=True)
    removed = before - len(cleaned)
    return cleaned, f"Removed {removed:,} row{'s' if removed != 1 else ''} with missing '{column}'"


def fill_missing(df: pd.DataFrame, column: str, value) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    cleaned = df.copy()
    cleaned[column] = cleaned[column].fillna(value)
    return cleaned, f"Filled missing values in '{column}' with {value!r}"


def fill_missing_numeric(df: pd.DataFrame, column: str, value) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    cleaned = df.copy()
    vals = _coerce_numeric(cleaned[column])
    cleaned[column] = cleaned[column].astype(object).where(vals.notna(), None)
    if value in ("mean", "median"):
        stat = vals.mean() if value == "mean" else vals.median()
        if pd.isna(stat):
            raise ValueError(f"Cannot compute {value} for '{column}' (no valid numbers).")
        cleaned[column] = cleaned[column].fillna(stat)
        return cleaned, f"Filled missing values in '{column}' with the {value} ({stat:,.2f})"
    try:
        replacement = float(value)
    except (TypeError, ValueError):
        raise ValueError("value must be a number, 'mean' or 'median'.")
    cleaned[column] = cleaned[column].fillna(replacement)
    return cleaned, f"Filled missing values in '{column}' with {replacement:,.2f}"


def convert_numeric(df: pd.DataFrame, column: str) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    cleaned = df.copy()
    coerced = _coerce_numeric(cleaned[column])
    before_bad = int(coerced.isna().sum() - cleaned[column].isna().sum())
    cleaned[column] = coerced
    return cleaned, f"Converted '{column}' to numbers ({before_bad:,} non-numeric value{'s' if before_bad != 1 else ''} removed)"


def trim_whitespace(df: pd.DataFrame, column: str) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    cleaned = df.copy()
    cleaned[column] = cleaned[column].map(
        lambda v: v.strip() if isinstance(v, str) else v
    )
    return cleaned, f"Trimmed whitespace in '{column}'"


def lowercase_column(df: pd.DataFrame, column: str) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    cleaned = df.copy()
    cleaned[column] = cleaned[column].map(
        lambda v: v.lower() if isinstance(v, str) else v
    )
    return cleaned, f"Lowercased values in '{column}'"


def standardize_dates(df: pd.DataFrame, column: str) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    cleaned = df.copy()
    parsed = pd.to_datetime(cleaned[column], errors="coerce", format="mixed")
    before_bad = int(parsed.isna().sum() - cleaned[column].isna().sum())
    cleaned[column] = parsed
    return cleaned, f"Parsed '{column}' as dates ({before_bad:,} unparseable value{'s' if before_bad != 1 else ''} removed)"


def trim_all_whitespace(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    cleaned = df.copy()
    count = 0
    for col in cleaned.columns:
        if cleaned[col].dtype == object or pd.api.types.is_string_dtype(cleaned[col]):
            cleaned[col] = cleaned[col].map(lambda v: v.strip() if isinstance(v, str) else v)
            count += 1
    return cleaned, f"Trimmed whitespace across all {count} text columns"


def drop_empty_columns(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    before = len(df.columns)
    # Drop columns where missing percentage > 90% or all null
    threshold = 0.90
    cols_to_drop = [col for col in df.columns if df[col].isna().mean() >= threshold]
    if not cols_to_drop:
        return df.copy(), "No predominantly empty columns found"
    cleaned = df.drop(columns=cols_to_drop).reset_index(drop=True)
    return cleaned, f"Dropped {len(cols_to_drop)} empty or >90% missing column{'s' if len(cols_to_drop) != 1 else ''} ({', '.join(cols_to_drop)})"


def drop_constant_columns(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    cols_to_drop = [col for col in df.columns if df[col].nunique(dropna=False) <= 1]
    if not cols_to_drop:
        return df.copy(), "No constant columns found"
    cleaned = df.drop(columns=cols_to_drop).reset_index(drop=True)
    return cleaned, f"Dropped {len(cols_to_drop)} constant column{'s' if len(cols_to_drop) != 1 else ''} ({', '.join(cols_to_drop)})"


def fill_all_numeric_median(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    cleaned = df.copy()
    filled_cols = 0
    for col in cleaned.columns:
        if pd.api.types.is_numeric_dtype(cleaned[col]):
            med = cleaned[col].median()
            if not pd.isna(med) and cleaned[col].isna().any():
                cleaned[col] = cleaned[col].fillna(med)
                filled_cols += 1
    return cleaned, f"Filled missing values with column median across {filled_cols} numeric column{'s' if filled_cols != 1 else ''}"


def fill_all_numeric_zero(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    cleaned = df.copy()
    filled_cols = 0
    for col in cleaned.columns:
        if pd.api.types.is_numeric_dtype(cleaned[col]):
            if cleaned[col].isna().any():
                cleaned[col] = cleaned[col].fillna(0)
                filled_cols += 1
    return cleaned, f"Filled missing values with 0 across {filled_cols} numeric column{'s' if filled_cols != 1 else ''}"


def filter_rows(df: pd.DataFrame, column: str, value: str | int | float) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    val_str = str(value).strip()
    before = len(df)
    # Check operator prefixes: >10, <5, >=100, <=50, !=active, ==US, contains:xyz
    if val_str.startswith(">="):
        target = float(val_str[2:].strip())
        mask = pd.to_numeric(df[column], errors="coerce") >= target
        desc = f"Kept rows where '{column}' >= {target}"
    elif val_str.startswith("<="):
        target = float(val_str[2:].strip())
        mask = pd.to_numeric(df[column], errors="coerce") <= target
        desc = f"Kept rows where '{column}' <= {target}"
    elif val_str.startswith(">"):
        target = float(val_str[1:].strip())
        mask = pd.to_numeric(df[column], errors="coerce") > target
        desc = f"Kept rows where '{column}' > {target}"
    elif val_str.startswith("<"):
        target = float(val_str[1:].strip())
        mask = pd.to_numeric(df[column], errors="coerce") < target
        desc = f"Kept rows where '{column}' < {target}"
    elif val_str.startswith("!="):
        target = val_str[2:].strip()
        mask = df[column].astype(str).str.strip().str.lower() != target.lower()
        desc = f"Kept rows where '{column}' != '{target}'"
    elif val_str.lower().startswith("contains:"):
        target = val_str[9:].strip()
        mask = df[column].astype(str).str.contains(target, case=False, na=False)
        desc = f"Kept rows where '{column}' contains '{target}'"
    else:
        target = val_str.removeprefix("==").strip()
        mask = df[column].astype(str).str.strip().str.lower() == target.lower()
        desc = f"Kept rows where '{column}' == '{target}'"

    cleaned = df[mask].reset_index(drop=True)
    if len(cleaned) == 0:
        raise ValueError(f"Filter matched 0 rows. No changes were applied.")
    removed = before - len(cleaned)
    return cleaned, f"{desc} ({removed:,} rows filtered out)"


OPERATIONS: dict[str, object] = {
    "drop_column": drop_column,
    "rename_column": rename_column,
    "drop_duplicates": drop_duplicates,
    "drop_missing_rows": drop_missing_rows,
    "drop_missing_in_column": drop_missing_in_column,
    "fill_missing": fill_missing,
    "fill_missing_numeric": fill_missing_numeric,
    "convert_numeric": convert_numeric,
    "trim_whitespace": trim_whitespace,
    "lowercase_column": lowercase_column,
    "standardize_dates": standardize_dates,
    "trim_all_whitespace": trim_all_whitespace,
    "drop_empty_columns": drop_empty_columns,
    "drop_constant_columns": drop_constant_columns,
    "fill_all_numeric_median": fill_all_numeric_median,
    "fill_all_numeric_zero": fill_all_numeric_zero,
    "filter_rows": filter_rows,
}

