import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.config import settings

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_sync_endpoint_requires_auth(async_client: AsyncClient):
    response = await async_client.post(f"{settings.API_PREFIX}/sync/")
    assert response.status_code == 401


async def test_sync_endpoint_success(
    async_client: AsyncClient, db_session: AsyncSession
):
    # Create a real user in the DB to satisfy FK constraints
    from src.users.models import User

    user = User(
        email="test@example.com",
        hashed_password="fake",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # We need to bypass the auth dependency
    from src.users.router import current_active_user
    from src.main import app

    app.dependency_overrides[current_active_user] = lambda: user

    # Payload
    payload = {
        "workouts": [
            {
                "id": "g-w1",
                "name": "Sync Test",
                "start_time": "2024-04-13T10:00:00Z",
                "workout_type_id": "g-wt1",
                "exercises": [],
            }
        ],
        "exerciseTypes": [],
        "workoutTypes": [{"id": "g-wt1", "name": "General"}],
    }

    response = await async_client.post(f"{settings.API_PREFIX}/sync/", json=payload)

    # Clean up override
    del app.dependency_overrides[current_active_user]

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["syncedWorkouts"] == 1
