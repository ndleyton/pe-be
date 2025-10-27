import pytest
from httpx import AsyncClient

from src.main import app
from src.users.models import User
from src.users.router import current_active_user


@pytest.mark.asyncio
async def test_auth_session_unauthorized(async_client: AsyncClient):
    resp = await async_client.get("/api/v1/auth/session")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_auth_session_authorized(async_client: AsyncClient, db_session):
    # Seed user
    user = User(
        email="session@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Override auth dependency to simulate authenticated request
    async def _override_user():
        return user

    app.dependency_overrides[current_active_user] = _override_user
    try:
        resp = await async_client.get("/api/v1/auth/session")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["id"] == user.id
        assert data["email"] == user.email
        assert data["is_active"] is True
    finally:
        app.dependency_overrides.pop(current_active_user, None)
