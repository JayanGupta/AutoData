"""File loading, validation and parsing for the data engine.

Responsible for turning raw uploaded files (CSV / TSV / Excel) into a
normalised pandas DataFrame, with sensible validation errors for bad input.
"""

from __future__ import annotations

import io
import os
import re

import httpx
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


def extract_google_sheet_details(url_or_id: str) -> tuple[str, str | None]:
    """Extract spreadsheet ID and optional sheet gid from a Google Sheets URL or raw ID."""
    clean = url_or_id.strip()
    match_id = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", clean)
    sheet_id = match_id.group(1) if match_id else clean.split("/")[0].split("?")[0]
    if not sheet_id or len(sheet_id) < 5:
        raise DataLoadError(f"Invalid Google Sheets link or ID: '{url_or_id}'.")
    match_gid = re.search(r"[#&?]gid=([0-9]+)", clean)
    gid = match_gid.group(1) if match_gid else None
    return sheet_id, gid


def fetch_google_sheet_tabs(
    url_or_id: str,
    target_sheet_name: str | None = None,
) -> list[tuple[str, pd.DataFrame]]:
    """Fetch one or all tabs of a public Google Sheet without requiring cloud credentials.

    Returns a list of tuples: [(tab_name, parsed_clean_dataframe), ...].
    """
    sheet_id, gid = extract_google_sheet_details(url_or_id)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }

    # 1. Try downloading as multi-sheet XLSX to retrieve all tabs at once
    xlsx_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"
    tabs_data: list[tuple[str, pd.DataFrame]] = []

    try:
        with httpx.Client(follow_redirects=True, timeout=30.0) as client:
            resp = client.get(xlsx_url, headers=headers)
            if resp.status_code == 200 and resp.content.startswith(b"PK\x03\x04"):
                xl = pd.ExcelFile(io.BytesIO(resp.content))
                sheet_names = xl.sheet_names
                sheets_to_load = [target_sheet_name] if target_sheet_name and target_sheet_name in sheet_names else sheet_names
                for name in sheets_to_load:
                    try:
                        df = pd.read_excel(io.BytesIO(resp.content), sheet_name=name)
                        df = _normalise_columns(df).dropna(how="all").dropna(axis=1, how="all").reset_index(drop=True)
                        if not df.empty:
                            tabs_data.append((name, df))
                    except Exception:
                        continue
                if tabs_data:
                    return tabs_data
    except Exception:
        pass

    # 2. Fallback to CSV export (works for single sheet or specific gid)
    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    if gid:
        csv_url += f"&gid={gid}"

    try:
        with httpx.Client(follow_redirects=True, timeout=30.0) as client:
            resp = client.get(csv_url, headers=headers)
            if resp.status_code == 200:
                content = resp.content
                # Check if it was redirected to Google login HTML
                if b"<html" in content[:300].lower() or b"accounts.google.com" in content:
                    raise DataLoadError(
                        "This Google Sheet is private. In Google Sheets, click 'Share' (top right) "
                        "and set General access to 'Anyone with the link can view'."
                    )
                df = parse_csv(content, f"{sheet_id}.csv")
                df = _normalise_columns(df).dropna(how="all").dropna(axis=1, how="all").reset_index(drop=True)
                if not df.empty:
                    tab_name = target_sheet_name or f"Sheet_{gid or '1'}"
                    return [(tab_name, df)]
            elif resp.status_code in (401, 403):
                raise DataLoadError(
                    "Google Sheet access denied. Please open the sheet, click 'Share', and choose 'Anyone with the link can view'."
                )
            elif resp.status_code == 404:
                raise DataLoadError(f"Google Sheet '{sheet_id}' was not found. Please verify the URL.")
            else:
                raise DataLoadError(f"Failed to fetch Google Sheet: HTTP {resp.status_code}")
    except DataLoadError:
        raise
    except Exception as exc:
        raise DataLoadError(f"Could not connect to Google Sheets: {exc}") from exc

    if not tabs_data:
        raise DataLoadError("The Google Sheet contains no data rows or could not be loaded.")
    return tabs_data


def merge_dataframes(
    left_df: pd.DataFrame,
    right_df: pd.DataFrame,
    how: str = "inner",
    left_on: str | None = None,
    right_on: str | None = None,
) -> pd.DataFrame:
    """Combine or merge two DataFrames with clean column naming."""
    how_clean = (how or "inner").strip().lower()
    if how_clean == "concat":
        combined = pd.concat([left_df, right_df], ignore_index=True, sort=False)
        return _normalise_columns(combined).reset_index(drop=True)

    if not left_on or left_on not in left_df.columns:
        raise ValueError(f"Key column '{left_on}' not found in the first dataset.")
    if not right_on or right_on not in right_df.columns:
        raise ValueError(f"Key column '{right_on}' not found in the second dataset.")

    valid_hows = {"inner", "left", "right", "outer"}
    if how_clean not in valid_hows:
        raise ValueError(f"Invalid merge type '{how}'. Allowed: {', '.join(sorted(valid_hows))} or 'concat'.")

    merged = pd.merge(
        left_df,
        right_df,
        how=how_clean,
        left_on=left_on,
        right_on=right_on,
        suffixes=("", "_right"),
    )
    merged = _normalise_columns(merged).dropna(how="all").dropna(axis=1, how="all").reset_index(drop=True)
    if merged.empty:
        raise ValueError("The merge resulted in 0 rows. Check that your selected key columns have matching values.")
    return merged

