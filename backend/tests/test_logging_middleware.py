from uuid import UUID
import logging

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_logging_middleware_sets_request_id_and_logs_request(
    async_client: AsyncClient,
    caplog,
):
    caplog.set_level(logging.INFO, logger="src.request")

    response = await async_client.get(
        "/health",
        headers={"X-Request-ID": "req-123"},
    )

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "req-123"

    request_logs = [record for record in caplog.records if record.name == "src.request"]
    assert request_logs
    assert any(
        record.request_id == "req-123"
        and "GET /health -> 200" in record.getMessage()
        for record in request_logs
    )


@pytest.mark.asyncio
async def test_logging_middleware_generates_request_id_when_missing(
    async_client: AsyncClient,
):
    response = await async_client.get("/health")

    assert response.status_code == 200
    request_id = response.headers.get("X-Request-ID")
    assert request_id
    UUID(request_id)
