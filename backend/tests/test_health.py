import asyncio
import importlib
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app

health = importlib.import_module("src.health.router")


@pytest.fixture
def connection(monkeypatch):
    connection = AsyncMock()
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=connection)
    context.__aexit__ = AsyncMock(return_value=False)
    engine = MagicMock()
    engine.connect.return_value = context
    monkeypatch.setattr(health, "engine", engine)
    return connection


@pytest.mark.parametrize("path", ["/health/ready", "/api/v1/health/ready"])
async def test_readiness_success(connection, path):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(path)
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["cache-control"] == "no-store"
    assert str(connection.execute.call_args.args[0]) == "SELECT 1"


async def test_readiness_database_failure_is_generic(connection):
    connection.execute.side_effect = RuntimeError("sensitive connection details")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health/ready")
        live = await client.get("/health")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
    assert response.headers["cache-control"] == "no-store"
    assert live.status_code == 200
    assert live.json() == {"status": "ok"}
    connection.execute.assert_awaited_once()


async def test_readiness_timeout_includes_pool_checkout(connection, monkeypatch):
    async def stalled_checkout():
        await asyncio.Event().wait()

    health.engine.connect.return_value.__aenter__.side_effect = stalled_checkout
    monkeypatch.setattr(health, "READINESS_TIMEOUT_SECONDS", 0.01)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health/ready")
    assert response.status_code == 503
    connection.execute.assert_not_awaited()


async def test_readiness_head(connection):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.head("/health/ready")
    assert response.status_code == 200
    assert response.content == b""
    connection.execute.assert_awaited_once()
