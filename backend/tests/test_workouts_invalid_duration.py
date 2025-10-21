import pytest
from datetime import datetime, timezone
from httpx import AsyncClient

from src.main import app
from src.users.models import User
from src.workouts.models import WorkoutType, Workout
from src.users.router import current_active_user


@pytest.mark.asyncio
async def test_update_workout_with_invalid_duration_returns_400(async_client: AsyncClient, db_session):
    # Seed a user and a workout type
    user = User(
        email="dur-test@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)

    wt = WorkoutType(id=4, name="Strength Training", description="Default")
    db_session.add(wt)
    await db_session.commit()

    # Create an existing workout with a start_time
    start_ts = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    w = Workout(
        owner_id=user.id,
        name="Test",
        start_time=start_ts,
        workout_type_id=wt.id,
    )
    db_session.add(w)
    await db_session.commit()
    await db_session.refresh(w)

    # Override auth
    async def _override_user():
        return user

    app.dependency_overrides[current_active_user] = _override_user

    try:
        # Attempt to set end_time before start_time
        bad_end = datetime(2025, 1, 1, 11, 59, tzinfo=timezone.utc).isoformat()
        resp = await async_client.patch(
            f"/api/v1/workouts/{w.id}", json={"end_time": bad_end}
        )
        assert resp.status_code == 400, resp.text
        assert "end_time" in resp.json().get("detail", "")
    finally:
        app.dependency_overrides.pop(current_active_user, None)
