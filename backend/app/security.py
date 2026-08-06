"""Lightweight request throttling for the API.

An in-memory sliding window per client IP. Sufficient for a single-process
local app; documented clearly so operators know the default budget.
"""

from __future__ import annotations

import threading
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from . import config


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    async def dispatch(self, request: Request, call_next):
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            client = request.client.host if request.client else "unknown"
            if not self._allow(client):
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": (
                            f"Rate limit exceeded: max {config.RATE_LIMIT_REQUESTS} "
                            f"requests per {config.RATE_LIMIT_WINDOW_SECONDS}s."
                        )
                    },
                )
        return await call_next(request)

    def _allow(self, client: str) -> bool:
        now = time.time()
        window = config.RATE_LIMIT_WINDOW_SECONDS
        limit = config.RATE_LIMIT_REQUESTS
        with self._lock:
            hits = [t for t in self._hits.get(client, []) if now - t < window]
            if len(hits) >= limit:
                self._hits[client] = hits
                return False
            hits.append(now)
            self._hits[client] = hits
            return True
