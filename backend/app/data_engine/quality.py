"""Data quality issue detection.

Produces a list of quality issues with severity levels, plus an overall
quality score. Every issue references actual counts from the dataset.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .. import config
from .profiler import NUMERIC_TYPES, _is_missing

MISSING = "missing_values"
DUPLICATES = "duplicates"
OUTLIERS = "outliers"
TYPE_ANOMALY = "type_anomaly"
CONSTANT = "constant_column"
HIGH_CARDINALITY = "high_cardinality"
EMPTY_COLUMN = "empty_column"
SKEW = "skew"

SEVERITY_ORDER = {"high": 3, "medium": 2, "low": 1}


def _mk(issue_id: str, severity: str, category: str, column: str, title: str, detail: str, count: int) -> dict:
    return {
        "id": issue_id,
        "severity": severity,
        "category": category,
        "column": column,
        "title": title,
        "detail": detail,
        "count": count,
    }


def _parse_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(
        series.astype(object).map(lambda v: None if _is_missing(v) else str(v).replace(",", "").strip()),
        errors="coerce",
    )


def detect_missing(df: pd.DataFrame, profiles: list[dict]) -> list[dict]:
    issues = []
    for idx, prof in enumerate(profiles):
        col = prof["name"]
        n = prof["null_count"]
        pct = prof["null_pct"]
        if pct >= 50:
            issues.append(_mk(
                f"miss-{idx}", "high", MISSING, col,
                f"{col} is mostly empty",
                f"{n:,} of {len(df):,} rows ({pct:.1f}%) are missing.",
                n,
            ))
        elif pct >= 20:
            issues.append(_mk(
                f"miss-{idx}", "medium", MISSING, col,
                f"Significant missing values in {col}",
                f"{n:,} of {len(df):,} rows ({pct:.1f}%) have no value.",
                n,
            ))
        elif pct >= 5:
            issues.append(_mk(
                f"miss-{idx}", "low", MISSING, col,
                f"Some missing values in {col}",
                f"{n:,} of {len(df):,} rows ({pct:.1f}%) are missing.",
                n,
            ))
    return issues


def detect_duplicates(df: pd.DataFrame) -> list[dict]:
    if len(df) == 0:
        return []
    dup_mask = df.duplicated(keep=False)
    count = int(dup_mask.sum())
    if count == 0:
        return []
    severity = "high" if count / len(df) >= 0.2 else ("medium" if count / len(df) >= 0.05 else "low")
    return [_mk(
        "dup-0", severity, DUPLICATES, "", "Duplicate rows detected",
        f"{count:,} of {len(df):,} rows ({count / len(df) * 100:.1f}%) are exact duplicates.",
        count,
    )]


def detect_outliers(df: pd.DataFrame, profiles: list[dict]) -> list[dict]:
    issues = []
    for idx, prof in enumerate(profiles):
        if prof["inferred_type"] not in NUMERIC_TYPES or prof["null_pct"] >= 50:
            continue
        col = prof["name"]
        vals = _parse_numeric(df[col]).dropna()
        if len(vals) < 6:
            continue
        q1, q3 = vals.quantile([0.25, 0.75])
        iqr = q3 - q1
        if iqr == 0 or np.isnan(iqr):
            continue
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        outlier_mask = (vals < lower) | (vals > upper)
        count = int(outlier_mask.sum())
        pct = count / max(len(vals), 1) * 100
        if count == 0:
            continue
        severity = "high" if pct >= 10 else ("medium" if pct >= 5 else "low")
        issues.append(_mk(
            f"out-{idx}", severity, OUTLIERS, col,
            f"Outliers detected in {col}",
            f"{count:,} values ({pct:.1f}%) fall outside the expected range "
            f"[{lower:,.2f} .. {upper:,.2f}] (IQR rule).",
            count,
        ))
    return issues


def detect_type_anomalies(df: pd.DataFrame, profiles: list[dict]) -> list[dict]:
    issues = []
    for idx, prof in enumerate(profiles):
        if prof["inferred_type"] not in NUMERIC_TYPES:
            continue
        col = prof["name"]
        parsed = _parse_numeric(df[col])
        bad_mask = df[col].map(_is_missing) == False  # noqa: E712
        bad_mask &= parsed.isna()
        bad_mask &= ~df[col].astype(str).str.strip().isin({"", "nan", "NaN", "None", "null", "N/A", "-", "?"})
        count = int(bad_mask.sum())
        if count == 0:
            continue
        examples = df.loc[bad_mask, col].astype(str).head(5).tolist()
        issues.append(_mk(
            f"type-{idx}", "medium", TYPE_ANOMALY, col,
            f"Non-numeric values in {col}",
            f"{count:,} values cannot be interpreted as numbers, e.g. "
            + ", ".join(repr(v)[:40] for v in examples) + ".",
            count,
        ))
    return issues


def detect_structure(df: pd.DataFrame, profiles: list[dict]) -> list[dict]:
    issues = []
    for idx, prof in enumerate(profiles):
        col = prof["name"]
        if prof["distinct_count"] == 0 and prof["null_pct"] >= 99:
            issues.append(_mk(
                f"empty-{idx}", "high", EMPTY_COLUMN, col,
                f"{col} is empty",
                "This column contains no usable values.",
                0,
            ))
        elif prof["distinct_count"] == 1:
            issues.append(_mk(
                f"const-{idx}", "low", CONSTANT, col,
                f"{col} is constant",
                "Every value in this column is identical, so it adds no analytical value.",
                int(len(df)),
            ))
        elif prof["cardinality"] == "high" and prof["inferred_type"] in ("categorical", "text") and len(df) > 50:
            issues.append(_mk(
                f"card-{idx}", "low", HIGH_CARDINALITY, col,
                f"{col} has very high cardinality",
                f"{prof['distinct_count']:,} unique values out of {len(df):,} rows "
                "may be more of an identifier than a category.",
                int(prof["distinct_count"]),
            ))
    return issues


def detect_skew(df: pd.DataFrame, profiles: list[dict]) -> list[dict]:
    issues = []
    for idx, prof in enumerate(profiles):
        if prof["inferred_type"] not in NUMERIC_TYPES:
            continue
        col = prof["name"]
        vals = _parse_numeric(df[col]).dropna()
        if len(vals) < 20:
            continue
        mean, median = vals.mean(), vals.median()
        if mean == 0 or pd.isna(mean):
            continue
        ratio = abs((mean - median) / mean)
        if ratio >= 0.5 and vals.std() > 0:
            direction = "higher" if mean > median else "lower"
            issues.append(_mk(
                f"skew-{idx}", "low", SKEW, col,
                f"{col} is heavily skewed",
                f"The mean ({mean:,.2f}) is noticeably {direction} than the median "
                f"({median:,.2f}), suggesting a lopsided distribution.",
                int(len(vals)),
            ))
    return issues


def quality_score(issues: list[dict]) -> int:
    if not issues:
        return 100
    deductions = {"high": 25, "medium": 10, "low": 3}
    score = 100
    for issue in issues:
        score -= deductions.get(issue["severity"], 3)
    return max(0, min(100, score))


def analyze_quality(df: pd.DataFrame, profiles: list[dict]) -> dict:
    issues = []
    issues += detect_missing(df, profiles)
    issues += detect_duplicates(df)
    issues += detect_outliers(df, profiles)
    issues += detect_type_anomalies(df, profiles)
    issues += detect_structure(df, profiles)
    issues += detect_skew(df, profiles)

    summary = {
        "total_issues": len(issues),
        "high": sum(1 for i in issues if i["severity"] == "high"),
        "medium": sum(1 for i in issues if i["severity"] == "medium"),
        "low": sum(1 for i in issues if i["severity"] == "low"),
        "quality_score": quality_score(issues),
        "categories": {
            "missing_values": sum(1 for i in issues if i["category"] == MISSING),
            "duplicates": sum(1 for i in issues if i["category"] == DUPLICATES),
            "outliers": sum(1 for i in issues if i["category"] == OUTLIERS),
            "type_anomalies": sum(1 for i in issues if i["category"] == TYPE_ANOMALY),
            "structure": sum(1 for i in issues if i["category"] in (CONSTANT, EMPTY_COLUMN, HIGH_CARDINALITY, SKEW)),
        },
    }
    return {"issues": issues, "summary": summary}
