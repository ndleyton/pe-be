from __future__ import annotations

from contextlib import AsyncExitStack, asynccontextmanager

from mcp.server.transport_security import TransportSecuritySettings

from src.core.config import settings
from src.mcp.auth import PATBearerMiddleware
from src.mcp.server_catalog import catalog_server
from src.mcp.server_trainer import trainer_server


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


transport_security = TransportSecuritySettings(
    enable_dns_rebinding_protection=True,
    allowed_hosts=_csv(settings.MCP_ALLOWED_HOSTS),
    allowed_origins=_csv(settings.MCP_ALLOWED_ORIGINS),
)


class RestartableMCPApp:
    """Create a fresh SDK session manager for each ASGI lifespan."""

    def __init__(self, server, *, protected: bool = False):
        self.server = server
        self.protected = protected
        self.app = None

    async def start(self, stack: AsyncExitStack) -> None:
        app = self.server.streamable_http_app(
            streamable_http_path="/",
            stateless_http=True,
            json_response=True,
            transport_security=transport_security,
        )
        self.app = PATBearerMiddleware(app) if self.protected else app
        await stack.enter_async_context(self.server.session_manager.run())

    async def __call__(self, scope, receive, send):
        if self.app is None:
            raise RuntimeError("MCP application lifespan has not started")
        await self.app(scope, receive, send)


catalog_http_app = RestartableMCPApp(catalog_server)
trainer_http_app = RestartableMCPApp(trainer_server, protected=True)


@asynccontextmanager
async def mcp_lifespan(_app):
    """Run each mounted SDK session manager for the FastAPI app lifetime."""
    async with AsyncExitStack() as stack:
        if settings.MCP_ENABLED and settings.MCP_CATALOG_ENABLED:
            await catalog_http_app.start(stack)
        if settings.MCP_ENABLED and settings.MCP_TRAINER_ENABLED:
            await trainer_http_app.start(stack)
        yield
