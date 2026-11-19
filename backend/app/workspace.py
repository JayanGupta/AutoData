"""Browser-scoped workspaces for public deployments."""

from contextvars import ContextVar
from hashlib import sha256
import re
from secrets import token_urlsafe

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from . import config

workspace_owner: ContextVar[str | None] = ContextVar("workspace_owner", default=None)
_COOKIE = "__Host-autodata-workspace"
_PUBLIC_ROUTES = {"/api/health", "/api/llm/status", "/api/samples", "/api/workspace"}
_TOKEN = re.compile(r"[A-Za-z0-9_-]{43}")


def can_access(owner: str | None) -> bool:
    return not config.WORKSPACE_ISOLATION or (
        owner is not None and owner == workspace_owner.get()
    )


class WorkspaceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path.rstrip("/")
        if not config.WORKSPACE_ISOLATION or not path.startswith("/api/") or request.method == "OPTIONS":
            return await call_next(request)

        token = request.cookies.get(_COOKIE, "")
        new_cookie = request.method == "GET" and path == "/api/workspace" and not _TOKEN.fullmatch(token)
        if new_cookie:
            token = token_urlsafe(32)
        valid = bool(_TOKEN.fullmatch(token))
        if not valid and path not in _PUBLIC_ROUTES:
            return JSONResponse(
                {"detail": "Open or refresh your workspace before trying again."},
                status_code=401,
                headers={"Cache-Control": "private, no-store"},
            )

        context = workspace_owner.set(sha256(token.encode()).hexdigest() if valid else None)
        try:
            response = await call_next(request)
        finally:
            workspace_owner.reset(context)
        if new_cookie:
            response.set_cookie(
                _COOKIE, token, secure=True, httponly=True, samesite="lax",
                max_age=30 * 24 * 3600, path="/",
            )
        response.headers["Cache-Control"] = "private, no-store"
        return response
