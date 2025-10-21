import pytest
from datetime import datetime, timezone, date
from httpx import AsyncClient

from src.main import app
from src.users.models import User
from src.workouts.models import WorkoutType, Workout
from src.exercises.models import IntensityUnit, ExerciseType
from src.users.router import current_active_user


@pytest.mark.asyncio
async def test_add_exercise_creates_new_workout_for_new_utc_day(
    async_client: AsyncClient, db_session
):
    """Ensure 'Add to current workout' uses UTC day boundaries.

    If the latest workout is from the previous UTC day, adding an exercise
    should create a new workout for today (UTC), not attach to the previous one.
    """
    # Seed minimal data
    # 1) User
    user = User(
        email="utc-test@example.com",
        hashed_password="not-important-for-test",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)

    # 2) Intensity unit and exercise type
    unit = IntensityUnit(name="kg", abbreviation="kg")
    db_session.add(unit)
    await db_session.flush()

    ex_type = ExerciseType(
        name="Bench Press", description="", default_intensity_unit=unit.id
    )
    db_session.add(ex_type)

    # 3) Workout type with ID 4 (default used by service)
    wt = WorkoutType(id=4, name="Strength Training", description="Default type")
    db_session.add(wt)

    await db_session.commit()

    # 4) Existing workout from the PREVIOUS UTC day
    prev_day = date(2024, 1, 1)
    prev_start = datetime(2024, 1, 1, 23, 59, tzinfo=timezone.utc)
    old_w = Workout(
        owner_id=user.id,
        name=f"Workout {prev_day.isoformat()}",
        start_time=prev_start,
        workout_type_id=wt.id,
    )
    db_session.add(old_w)
    await db_session.commit()
    await db_session.refresh(old_w)

    # Patch current user dependency
    async def _override_user():
        return user

    app.dependency_overrides[current_active_user] = _override_user

    # Freeze service datetime to a fixed time in the NEXT UTC day
    fixed_now = datetime(2024, 1, 2, 12, 0, 0, tzinfo=timezone.utc)

    class FixedDateTime:
        @staticmethod
        def now(tz=None):
            return fixed_now

    # Apply monkeypatch to the service module's datetime
    # Note: Use monkeypatch fixture via context manager style
    # (pytest passes it when declared as arg; here we inline monkeypatching)
    import src.workouts.service as workout_service_module

    original_datetime = workout_service_module.datetime
    workout_service_module.datetime = FixedDateTime  # type: ignore

    try:
        # Call the endpoint: should create a NEW workout for 2024-01-02 UTC
        payload = {
            "exercise_type_id": ex_type.id,
            "initial_set": {
                "reps": 10,
                "intensity": 50.0,
                "intensity_unit_id": unit.id,
                "rest_time_seconds": 60,
            },
        }

        resp = await async_client.post("/api/v1/workouts/add-exercise", json=payload)
        assert resp.status_code == 201, resp.text
        data = resp.json()

        # Should not be the previous workout
        assert data["id"] != old_w.id

        # Name should reflect the fixed UTC date
        assert data["name"].startswith("Workout 2024-01-02")

        # start_time should be on the fixed UTC date
        start_ts = datetime.fromisoformat(data["start_time"].replace("Z", "+00:00"))
        assert start_ts.date() == date(2024, 1, 2)

        # And the DB should now have two workouts for this user
        from sqlalchemy import select
        result = await db_session.execute(
            select(Workout).where(Workout.owner_id == user.id)
        )
        all_ws = result.scalars().all()
        assert len(all_ws) == 2

    finally:
        # Restore patched datetime and clear overrides
        workout_service_module.datetime = original_datetime
        app.dependency_overrides.pop(current_active_user, None)
