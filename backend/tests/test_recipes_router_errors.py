import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.main import app
from src.users.models import User
from src.users.router import current_active_user


@pytest.mark.integration
@pytest.mark.asyncio
async def test_routines_router_error_branches(
    db_session: AsyncSession, async_client: AsyncClient
):
    """Exercise 404 branches for get/update/start and 204 for delete."""
    # Create a test user and override dependency
    user = User(
        email="router-errors@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    async def override_user():
        return user

    app.dependency_overrides[current_active_user] = override_user

    try:
        # GET non-existent -> 404
        r1 = await async_client.get("/api/v1/routines/999999")
        assert r1.status_code == 404

        # PUT non-existent -> 404
        r2 = await async_client.put("/api/v1/routines/999999", json={})
        assert r2.status_code == 404

        # POST start non-existent -> 404
        r3 = await async_client.post("/api/v1/routines/999999/start")
        assert r3.status_code == 404

        # DELETE non-existent -> 204 (idempotent)
        r4 = await async_client.delete("/api/v1/routines/999999")
        assert r4.status_code == 204
    finally:
        app.dependency_overrides.pop(current_active_user, None)
