"""Dataset cleaning operations.

Each operation is a pure function `DataFrame -> (DataFrame, description)` so it
can be unit tested in isolation. Operations are applied to the session's working
dataframe and the analysis is recomputed afterwards, keeping every derived
artefact (summary, profiles, quality, charts) consistent with the cleaned data.
"""

from __future__ import annotations

import math

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


def blank_cells(series: pd.Series) -> pd.Series:
    return series.isna() | series.map(lambda v: isinstance(v, str) and not v.strip())


def drop_duplicates(df: pd.DataFrame, columns: list[str] | None = None,
                    keep: str = "first") -> tuple[pd.DataFrame, str]:
    if keep not in ("first", "last"):
        raise ValueError("Choose the first or last row to keep.")
    eligible = df
    if columns is not None:
        if not columns or len(columns) != len(set(columns)):
            raise ValueError("Select one or more distinct matching columns.")
        for column in columns:
            _require_column(df, column)
        incomplete = df[columns].apply(blank_cells).any(axis=1)
        eligible = df.loc[~incomplete]
    remove = eligible.index[eligible.duplicated(subset=columns, keep=keep)]
    cleaned = df.drop(index=remove)
    scope = ", ".join(columns) if columns else "all columns"
    noun = "row" if len(remove) == 1 else "rows"
    return cleaned, f"Removed {len(remove):,} duplicate {noun} matching {scope} (kept {keep})"


def drop_missing_rows(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    before = len(df)
    cleaned = df.loc[~df.apply(blank_cells).any(axis=1)]
    removed = before - len(cleaned)
    return cleaned, f"Removed {removed:,} row{'s' if removed != 1 else ''} with missing values"


def drop_missing_in_column(df: pd.DataFrame, column: str) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    before = len(df)
    cleaned = df.loc[~blank_cells(df[column])]
    removed = before - len(cleaned)
    return cleaned, f"Removed {removed:,} row{'s' if removed != 1 else ''} with missing '{column}'"


def fill_missing(df: pd.DataFrame, column: str, value) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    cleaned = df.copy()
    if isinstance(value, str) and not value.strip():
        raise ValueError("Enter a replacement for blank cells.")
    if pd.api.types.is_numeric_dtype(df[column]) and not pd.api.types.is_bool_dtype(df[column]):
        try:
            value = pd.to_numeric(value, errors="raise")
        except ValueError:
            raise ValueError("Enter a number to fill this numeric column.") from None
        if not math.isfinite(value):
            raise ValueError("Enter a finite number.")
    cleaned[column] = cleaned[column].astype(object).mask(blank_cells(df[column]), value).infer_objects()
    return cleaned, f"Filled missing values in '{column}' with {value!r}"


def fill_missing_numeric(df: pd.DataFrame, column: str, value) -> tuple[pd.DataFrame, str]:
    _require_column(df, column)
    cleaned = df.copy()
    vals = _coerce_numeric(cleaned[column])
    blanks = blank_cells(cleaned[column])
    if value in ("mean", "median"):
        stat = vals.mean() if value == "mean" else vals.median()
        if pd.isna(stat):
            raise ValueError(f"Cannot compute {value} for '{column}' (no valid numbers).")
        cleaned[column] = cleaned[column].astype(object).mask(blanks, stat).infer_objects()
        return cleaned, f"Filled missing values in '{column}' with the {value} ({stat:,.2f})"
    try:
        replacement = float(value)
    except (TypeError, ValueError):
        raise ValueError("value must be a number, 'mean' or 'median'.")
    if not math.isfinite(replacement):
        raise ValueError("Enter a finite number.")
    cleaned[column] = cleaned[column].astype(object).mask(blanks, replacement).infer_objects()
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
        mask = df[column].astype(str).str.contains(target, case=False, na=False, regex=False)
        desc = f"Kept rows where '{column}' contains '{target}'"
    else:
        target = val_str.removeprefix("==").strip()
        mask = df[column].astype(str).str.strip().str.lower() == target.lower()
        desc = f"Kept rows where '{column}' == '{target}'"

    cleaned = df[mask]
    if len(cleaned) == 0:
        raise ValueError(f"Filter matched 0 rows. No changes were applied.")
    removed = before - len(cleaned)
    return cleaned, f"{desc} ({removed:,} rows filtered out)"


def matching_rows(df: pd.DataFrame, column: str, operator: str,
                  value: str | int | float = "") -> pd.Series:
    _require_column(df, column)
    series = df[column]
    if operator == "blank":
        return blank_cells(series)
    target = str(value).strip()
    if not target:
        raise ValueError("Enter a comparison value.")
    if operator in ("gt", "lt"):
        try:
            number = float(target)
        except ValueError:
            raise ValueError("Enter a number for this comparison.") from None
        if not math.isfinite(number):
            raise ValueError("Enter a finite number for this comparison.")
        numbers = _coerce_numeric(series)
        return numbers.gt(number) if operator == "gt" else numbers.lt(number)
    if operator == "equals" and pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
        try:
            return series.eq(pd.to_numeric(target, errors="raise")).fillna(False)
        except ValueError:
            return pd.Series(False, index=series.index)
    strings = series.astype("string").str.strip().str.casefold()
    if operator == "equals":
        return strings.eq(target.casefold()).fillna(False)
    if operator == "contains":
        return strings.str.contains(target.casefold(), regex=False, na=False)
    raise ValueError("Unknown filter condition.")


def keep_matching_rows(df: pd.DataFrame, column: str, operator: str,
                       value: str | int | float = "") -> tuple[pd.DataFrame, str]:
    mask = matching_rows(df, column, operator, value)
    labels = {"gt": "greater than", "lt": "less than", "equals": "equals",
              "contains": "contains", "blank": "is blank"}
    condition = f"{column} {labels[operator]}"
    if operator != "blank":
        condition += f" {value}"
    return df.loc[mask], f"Kept {int(mask.sum()):,} rows where {condition}"


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
    "keep_matching_rows": keep_matching_rows,
}



def prepare_clean(df: pd.DataFrame, action: str, params: dict) -> tuple[pd.DataFrame, str]:
    operation = OPERATIONS.get(action)
    if operation is None:
        raise ValueError(f"Unknown cleaning action '{action}'.")
    try:
        result, description = operation(df, **params)
    except TypeError as exc:
        raise ValueError(f"Invalid parameters for '{action}': {exc}") from exc
    if result.empty:
        raise ValueError("That cleaning step would leave the dataset empty.")
    return result, description


def review_clean(df: pd.DataFrame, result: pd.DataFrame, description: str,
                 action: str, params: dict) -> dict:
    """Compare against source row indexes before the applied result is reindexed."""
    from .engine import preview_rows

    removed = df.index.difference(result.index, sort=False)
    dropped = df.columns.difference(result.columns, sort=False).tolist()
    changed_cells = 0
    new_blanks = 0
    changed_rows = pd.Series(False, index=result.index)
    examples = []
    if len(removed):
        sample = df.loc[removed[:5]]
        examples = [{"row": int(idx) + 1, "before": record}
                    for idx, record in zip(sample.index, preview_rows(sample))]
        keys = params.get("columns")
        if action == "drop_duplicates" and keys:
            complete = result.loc[~result[keys].apply(blank_cells).any(axis=1)]
            lookup = pd.MultiIndex.from_frame(complete[keys])
            kept = complete.iloc[lookup.get_indexer(pd.MultiIndex.from_frame(sample[keys]))]
            for example, idx, record in zip(examples, kept.index, preview_rows(kept)):
                example.update(kept_row=int(idx) + 1, kept=record)
    elif not dropped:
        for col in result.columns:
            before, after = df[col], result[col]
            changed = ~(before.eq(after).fillna(False) | (before.isna() & after.isna()))
            changed_cells += int(changed.sum())
            new_blanks += int((before.notna() & after.isna()).sum())
            changed_rows |= changed
            for idx in changed[changed].index[:5 - len(examples)]:
                examples.append({"row": int(idx) + 1, "column": col,
                                 "before": preview_rows(df.loc[[idx], [col]])[0],
                                 "after": preview_rows(result.loc[[idx], [col]])[0]})
    return {"description": description, "rows_before": len(df), "rows_after": len(result),
            "rows_removed": len(removed), "columns_removed": dropped,
            "columns_added": result.columns.difference(df.columns, sort=False).tolist(),
            "cells_changed": changed_cells, "new_blanks": new_blanks, "rows_edited": int(changed_rows.sum()),
            "changed": bool(len(removed) or dropped or changed_cells or not df.dtypes.equals(result.dtypes)),
            "examples": examples}
