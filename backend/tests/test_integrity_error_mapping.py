from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.errors import DomainValidationError, ValidationErrorCode
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
        body = response.json()
        assert body["code"] == "invalid_reference"
        assert body["field"] == "workout_type_id"
        assert "workout_type_id" in body["detail"]
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_patch_workout_end_time_before_start_returns_422(
    db_session: AsyncSession, async_client: AsyncClient
):
    user = await _override_authenticated_user(db_session)
    workout_type = WorkoutType(name="Conditioning", description="Conditioning training")
    db_session.add(workout_type)
    await db_session.flush()

    start_time = datetime.now(timezone.utc)
    workout = Workout(
        name="Workout for end time validation",
        start_time=start_time,
        workout_type_id=workout_type.id,
        owner_id=user.id,
    )
    db_session.add(workout)
    await db_session.flush()

    try:
        response = await async_client.patch(
            f"{settings.API_PREFIX}/workouts/{workout.id}",
            json={"end_time": (start_time - timedelta(minutes=10)).isoformat()},
        )
        assert response.status_code == 422
        body = response.json()
        assert body["code"] == "invalid_range"
        assert body["field"] == "end_time"
        assert body["detail"] == "end_time must be greater than or equal to start_time"
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
        response = await async_client.post(
            f"{settings.API_PREFIX}/routines/", json=payload
        )
        assert response.status_code == 422
        body = response.json()
        assert body["code"] == "invalid_reference"
        assert body["field"] == "workout_type_id"
        assert "workout_type_id" in body["detail"]
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_routine_invalid_exercise_type_returns_422(
    db_session: AsyncSession, async_client: AsyncClient
):
    await _override_authenticated_user(db_session)
    workout_type = WorkoutType(name="Routine Type", description="Used in routine tests")
    db_session.add(workout_type)
    await db_session.flush()

    try:
        payload = {
            "name": "Invalid Exercise Type Routine",
            "description": "Should fail with 422",
            "workout_type_id": workout_type.id,
            "exercise_templates": [
                {"exercise_type_id": 999999, "set_templates": []},
            ],
        }
        response = await async_client.post(
            f"{settings.API_PREFIX}/routines/", json=payload
        )
        assert response.status_code == 422
        body = response.json()
        assert body["code"] == "invalid_reference"
        assert body["field"] == "exercise_templates.exercise_type_id"
        assert "exercise_templates.exercise_type_id" in body["detail"]
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_routine_invalid_set_template_intensity_unit_returns_422(
    db_session: AsyncSession, async_client: AsyncClient
):
    await _override_authenticated_user(db_session)
    workout_type = WorkoutType(
        name="Routine Type for SetTemplate",
        description="Used in routine tests",
    )
    db_session.add(workout_type)
    await db_session.flush()

    exercise_type = ExerciseType(
        name="Routine Exercise Type",
        description="Used in routine tests",
        default_intensity_unit=None,
    )
    db_session.add(exercise_type)
    await db_session.flush()

    try:
        payload = {
            "name": "Invalid Set Template Unit Routine",
            "description": "Should fail with 422",
            "workout_type_id": workout_type.id,
            "exercise_templates": [
                {
                    "exercise_type_id": exercise_type.id,
                    "set_templates": [
                        {
                            "reps": 10,
                            "intensity": 50.0,
                            "intensity_unit_id": 999999,
                        }
                    ],
                }
            ],
        }
        response = await async_client.post(
            f"{settings.API_PREFIX}/routines/", json=payload
        )
        assert response.status_code == 422
        body = response.json()
        assert body["code"] == "invalid_reference"
        assert body["field"] == "exercise_templates.set_templates.intensity_unit_id"
        assert "exercise_templates.set_templates.intensity_unit_id" in body["detail"]
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
        response = await async_client.post(
            f"{settings.API_PREFIX}/exercises/", json=payload
        )
        assert response.status_code == 422
        body = response.json()
        assert body["code"] == "invalid_reference"
        assert body["field"] == "workout_id"
        assert "workout_id" in body["detail"]
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_exercise_invalid_exercise_type_returns_422(
    db_session: AsyncSession, async_client: AsyncClient
):
    user = await _override_authenticated_user(db_session)
    workout_type = WorkoutType(name="Workout Type", description="Used in exercise tests")
    db_session.add(workout_type)
    await db_session.flush()

    workout = Workout(
        name="Workout for invalid exercise_type_id",
        start_time=datetime.now(timezone.utc),
        workout_type_id=workout_type.id,
        owner_id=user.id,
    )
    db_session.add(workout)
    await db_session.flush()

    try:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "exercise_type_id": 999999,
            "workout_id": workout.id,
        }
        response = await async_client.post(
            f"{settings.API_PREFIX}/exercises/", json=payload
        )
        assert response.status_code == 422
        body = response.json()
        assert body["code"] == "invalid_reference"
        assert body["field"] == "exercise_type_id"
        assert "exercise_type_id" in body["detail"]
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
        body = response.json()
        assert body["code"] == "invalid_reference"
        assert body["field"] == "intensity_unit_id"
        assert "intensity_unit_id" in body["detail"]
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_domain_validation_error_without_field_omits_field_key(
    db_session: AsyncSession,
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    await _override_authenticated_user(db_session)

    async def _raise_domain_error(session, workout_in, user_id):
        raise DomainValidationError(
            code=ValidationErrorCode.INVALID_REFERENCE,
            message="Domain validation failed without field",
        )

    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.create_new_workout",
        _raise_domain_error,
    )

    try:
        response = await async_client.post(
            f"{settings.API_PREFIX}/workouts/",
            json={
                "name": "Will fail through monkeypatched service",
                "start_time": datetime.now(timezone.utc).isoformat(),
                "workout_type_id": 1,
            },
        )
        assert response.status_code == 422
        body = response.json()
        assert body["code"] == "invalid_reference"
        assert body["detail"] == "Domain validation failed without field"
        assert "field" not in body
    finally:
        app.dependency_overrides.pop(current_active_user, None)
