"""File loading, validation and parsing for the data engine.

Responsible for turning raw uploaded files (CSV / TSV / Excel) into a
normalised pandas DataFrame, with sensible validation errors for bad input.
"""

from __future__ import annotations

import io
import os
import re

import pandas as pd

from .. import config


class DataLoadError(Exception):
    """Raised when an uploaded file cannot be parsed into a dataset."""


def validate_extension(filename: str) -> None:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in config.ALLOWED_EXTENSIONS:
        raise DataLoadError(
            f"Unsupported file type '{ext or 'unknown'}'. "
            f"Please upload a CSV, TSV or Excel (.xlsx / .xls) file."
        )


def validate_size(data: bytes) -> None:
    if len(data) > config.MAX_UPLOAD_BYTES:
        raise DataLoadError(
            f"File is too large ({len(data) / (1024 * 1024):.1f} MB). "
            f"Maximum allowed size is {config.MAX_UPLOAD_MB} MB."
        )


def _sniff_delimiter(header_line: str) -> str:
    candidates = {"\t": 0, ";": 0, ",": 0}
    for delim in candidates:
        candidates[delim] = header_line.count(delim)
    best = max(candidates, key=candidates.get)
    return best


def _detect_encoding(raw: bytes) -> str:
    try:
        raw.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        return "latin-1"


def parse_csv(data: bytes, filename: str) -> pd.DataFrame:
    encoding = _detect_encoding(data)
    text = data.decode(encoding, errors="replace")

    first_line = text.splitlines()[0] if text.strip() else ""
    delimiter = _sniff_delimiter(first_line)

    try:
        df = pd.read_csv(
            io.StringIO(text),
            sep=delimiter,
            encoding="utf-8",
            on_bad_lines="warn",
        )
    except Exception as exc:  # noqa: BLE001 - surface any parse failure as a clean error
        raise DataLoadError(f"Could not parse CSV file: {exc}") from exc

    if df.empty:
        raise DataLoadError("The uploaded CSV file contains no data rows.")
    return df


def parse_excel(data: bytes, filename: str, sheet_name: str | None = None) -> pd.DataFrame:
    try:
        xl = pd.ExcelFile(io.BytesIO(data))
        sheets = xl.sheet_names
        chosen = sheet_name if sheet_name and sheet_name in sheets else (sheets[0] if sheets else None)
        if chosen is None:
            raise DataLoadError("The uploaded Excel file contains no sheets.")
        df = pd.read_excel(io.BytesIO(data), sheet_name=chosen)
    except DataLoadError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise DataLoadError(f"Could not parse Excel file: {exc}") from exc

    if df.empty:
        raise DataLoadError("The selected sheet contains no data rows.")
    return df


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Sanitise column names so they are usable in SQL and UI layers."""
    seen = set()
    new_names = []
    for col in df.columns:
        name = str(col).strip()
        if not name or name in seen:
            counter = 1
            base = name or "column"
            while name in seen:
                name = f"{base}_{counter}"
                counter += 1
        seen.add(name)
        new_names.append(name)
    df.columns = new_names
    return df


def load_dataframe(data: bytes, filename: str, sheet_name: str | None = None) -> pd.DataFrame:
    """Parse raw file bytes into a validated, normalised DataFrame."""
    validate_extension(filename)
    validate_size(data)

    ext = os.path.splitext(filename)[1].lower()
    if ext == ".csv" or ext == ".tsv":
        df = parse_csv(data, filename)
    else:
        df = parse_excel(data, filename, sheet_name)

    df = _normalise_columns(df)
    # Drop fully empty rows / columns which parsing artifacts often produce.
    df = df.dropna(how="all").dropna(axis=1, how="all")
    if df.empty:
        raise DataLoadError("The uploaded file contains no usable data.")

    # Preserve a stable integer index used by the rest of the engine.
    df = df.reset_index(drop=True)
    return df
