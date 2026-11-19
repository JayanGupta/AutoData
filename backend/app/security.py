"""Lightweight request throttling for the API.

An in-memory sliding window per client IP. Sufficient for a single-process
local app; documented clearly so operators know the default budget.
"""

from __future__ import annotations

import logging
import math
import threading
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from . import config
from .workspace import workspace_owner

logger = logging.getLogger(__name__)
_UPLOAD_PATHS = {"/api/jobs/upload", "/api/datasets", "/api/datasets/google-sheets", "/api/datasets/merge"}


def _budget(path: str) -> str:
    if path in _UPLOAD_PATHS:
        return "import"
    if path.startswith("/api/datasets/"):
        action = path.rsplit("/", 1)[-1]
        if action in {"ask", "sql", "sample", "dashboard-metrics"}:
            return action
        if path.endswith("/insights/generate"):
            return "insights"
    return "workspace"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[tuple[str, str], list[float]] = {}
        self._last_sweep = time.monotonic()
        self._lock = threading.Lock()

    async def dispatch(self, request: Request, call_next):
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            client = request.client.host if request.client else "unknown"
            bucket = _budget(request.url.path.rstrip("/"))
            owner = workspace_owner.get()
            if owner is None:
                retry_after = self._retry_after(f"ip:{client}", bucket)
            else:
                retry_after = self._retry_after(f"workspace:{owner}", bucket)
                if retry_after is None:
                    retry_after = self._retry_after(f"proxy-ip:{client}", bucket, multiplier=10)
            if retry_after is not None:
                logger.info("Rate limit reached method=%s bucket=%s retry_after=%s", request.method, bucket, retry_after)
                return JSONResponse(
                    status_code=429,
                    headers={"Retry-After": str(retry_after)},
                    content={
                        "detail": (
                            f"Too many {bucket} requests. Try again in {retry_after} seconds."
                        )
                    },
                )
        return await call_next(request)

    def _retry_after(self, client: str, bucket: str, *, multiplier: int = 1) -> int | None:
        now = time.monotonic()
        window = max(1, config.RATE_LIMIT_WINDOW_SECONDS)
        limit = max(1, config.RATE_LIMIT_REQUESTS) * multiplier
        key = (client, bucket)
        cutoff = now - window
        with self._lock:
            if self._last_sweep <= cutoff:
                self._hits = {
                    key: hits for key, hits in self._hits.items() if hits[-1] > cutoff
                }
                self._last_sweep = now
            hits = [t for t in self._hits.get(key, []) if t > cutoff]
            if len(hits) >= limit:
                self._hits[key] = hits
                return max(1, math.ceil(hits[0] + window - now))
            hits.append(now)
            self._hits[key] = hits
            return None
