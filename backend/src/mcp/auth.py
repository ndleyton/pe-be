from __future__ import annotations

import os
from contextvars import ContextVar, Token

from starlette.responses import JSONResponse

from src.core.config import settings
from src.core.database import async_session_maker
from src.users.models import User
from src.users.pat_schemas import PATPrincipal
from src.users.pat_service import PATAuthenticationError, verify_personal_access_token

_principal: ContextVar[PATPrincipal | None] = ContextVar(
    "mcp_principal", default=None
)


class MCPAuthorizationError(PermissionError):
    pass


def require_scope(principal: PATPrincipal, scope: str) -> None:
    if scope not in principal.scopes:
        raise MCPAuthorizationError(f"Missing required scope: {scope}")


async def current_principal() -> PATPrincipal:
    principal = _principal.get()
    if principal is not None:
        return principal

    if settings.MCP_ALLOW_TRUSTED_STDIO_USER:
        raw_user_id = os.getenv("PE_BE_USER_ID")
        if raw_user_id:
            try:
                user_id = int(raw_user_id)
            except ValueError as exc:
                raise MCPAuthorizationError("PE_BE_USER_ID must be an integer") from exc
            async with async_session_maker() as session:
                user = await session.get(User, user_id)
                if user is not None and user.is_active:
                    return PATPrincipal(
                        user_id=user_id,
                        credential_id=0,
                        scopes=frozenset({"trainer:read", "trainer:write"}),
                    )
    raise MCPAuthorizationError("No authenticated MCP principal")


class PATBearerMiddleware:
    """Authenticate each protected MCP HTTP request with a scoped opaque PAT."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return

        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }
        authorization = headers.get("authorization", "")
        scheme, _, token_value = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token_value:
            await JSONResponse(
                {"detail": "A Bearer personal access token is required"},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )(scope, receive, send)
            return

        try:
            async with async_session_maker() as session:
                principal = await verify_personal_access_token(
                    session, token_value.strip()
                )
        except PATAuthenticationError:
            await JSONResponse(
                {"detail": "Invalid or expired personal access token"},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )(scope, receive, send)
            return

        if "trainer:read" not in principal.scopes:
            await JSONResponse(
                {"detail": "Missing required scope: trainer:read"}, status_code=403
            )(scope, receive, send)
            return

        context_token: Token = _principal.set(principal)
        try:
            await self.app(scope, receive, send)
        finally:
            _principal.reset(context_token)
