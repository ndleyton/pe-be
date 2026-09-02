from __future__ import annotations

import argparse
import os
from contextlib import asynccontextmanager

import uvicorn
from starlette.applications import Starlette
from starlette.routing import Mount

from src.core.config import settings
from src.core.model_registry import ensure_model_registry_loaded
from src.mcp.server_catalog import catalog_server
from src.mcp.server_trainer import trainer_server
from src.mcp.auth import PATBearerMiddleware
from src.mcp.router import transport_security


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a PE-BE MCP server")
    parser.add_argument("server", choices=("catalog", "trainer"))
    parser.add_argument(
        "--transport", choices=("stdio", "http"), default="stdio"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    ensure_model_registry_loaded()
    server = catalog_server if args.server == "catalog" else trainer_server

    if args.server == "trainer" and args.transport == "stdio":
        if not os.getenv("PE_BE_USER_ID"):
            raise SystemExit(
                "PE_BE_USER_ID is required for trusted local trainer stdio"
            )
        settings.MCP_ALLOW_TRUSTED_STDIO_USER = True

    if args.transport == "stdio":
        server.run(transport="stdio")
    else:
        mcp_app = server.streamable_http_app(
            streamable_http_path="/",
            stateless_http=True,
            json_response=True,
            transport_security=transport_security,
        )
        if args.server == "trainer":
            mcp_app = PATBearerMiddleware(mcp_app)

        @asynccontextmanager
        async def lifespan(_app):
            async with server.session_manager.run():
                yield

        http_app = Starlette(routes=[Mount("/", app=mcp_app)], lifespan=lifespan)
        uvicorn.run(http_app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
