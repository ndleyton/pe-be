from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.exercises.models import Exercise, ExerciseType
from src.main import app
from src.users.models import User
from src.users.router import current_active_user
from src.workouts.models import Workout, WorkoutType


async def _override_authenticated_user(db_session: AsyncSession) -> User:
    user = User(
        email="validation-errors@example.com",
        hashed_password="not-used-in-tests",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    async def override_user():
        return user

    app.dependency_overrides[current_active_user] = override_user
    return user


@pytest.mark.integration
@pytest.mark.asyncio
async def test_patch_workout_invalid_workout_type_returns_422(
    db_session: AsyncSession, async_client: AsyncClient
):
    user = await _override_authenticated_user(db_session)
    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add(workout_type)
    await db_session.flush()

    workout = Workout(
        name="Workout with valid type",
        start_time=datetime.now(timezone.utc),
        workout_type_id=workout_type.id,
        owner_id=user.id,
    )
    db_session.add(workout)
    await db_session.flush()

    try:
        response = await async_client.patch(
            f"{settings.API_PREFIX}/workouts/{workout.id}",
            json={"workout_type_id": 999999},
        )
        assert response.status_code == 422
        assert "workout_type_id" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_routine_invalid_workout_type_returns_422(
    db_session: AsyncSession, async_client: AsyncClient
):
    await _override_authenticated_user(db_session)

    try:
        payload = {
            "name": "Invalid Routine",
            "description": "Should fail with 422",
            "workout_type_id": 999999,
            "exercise_templates": [],
        }
        response = await async_client.post(f"{settings.API_PREFIX}/routines/", json=payload)
        assert response.status_code == 422
        assert "workout_type_id" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_exercise_invalid_workout_id_returns_422(
    db_session: AsyncSession, async_client: AsyncClient
):
    await _override_authenticated_user(db_session)
    exercise_type = ExerciseType(
        name="FK Validation Exercise",
        description="Used for validation tests",
        default_intensity_unit=None,
    )
    db_session.add(exercise_type)
    await db_session.flush()

    try:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "exercise_type_id": exercise_type.id,
            "workout_id": 999999,
        }
        response = await async_client.post(f"{settings.API_PREFIX}/exercises/", json=payload)
        assert response.status_code == 422
        assert "workout_id" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_exercise_set_invalid_intensity_unit_returns_422(
    db_session: AsyncSession, async_client: AsyncClient
):
    user = await _override_authenticated_user(db_session)
    workout_type = WorkoutType(name="Hypertrophy", description="Hypertrophy training")
    db_session.add(workout_type)
    await db_session.flush()

    workout = Workout(
        name="Exercise set validation workout",
        start_time=datetime.now(timezone.utc),
        workout_type_id=workout_type.id,
        owner_id=user.id,
    )
    db_session.add(workout)
    await db_session.flush()

    exercise_type = ExerciseType(
        name="Exercise Set Validation Type",
        description="Used for validation tests",
        default_intensity_unit=None,
    )
    db_session.add(exercise_type)
    await db_session.flush()

    exercise = Exercise(
        timestamp=datetime.now(timezone.utc),
        exercise_type_id=exercise_type.id,
        workout_id=workout.id,
    )
    db_session.add(exercise)
    await db_session.flush()

    try:
        payload = {
            "reps": 10,
            "intensity": 50.0,
            "intensity_unit_id": 999999,
            "exercise_id": exercise.id,
            "done": False,
        }
        response = await async_client.post(
            f"{settings.API_PREFIX}/exercise-sets/",
            json=payload,
        )
        assert response.status_code == 422
        assert "intensity_unit_id" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(current_active_user, None)
