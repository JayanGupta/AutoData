"""Data engine public API."""

from .engine import EngineResult, analyze, preview_rows, rows_slice

__all__ = ["EngineResult", "analyze", "preview_rows", "rows_slice"]
