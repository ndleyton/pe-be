from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient

from src.core.config import settings
from src.exercise_sets.models import ExerciseSet
from src.exercises.models import Exercise, ExerciseType, IntensityUnit
from src.main import app
from src.users.models import User
from src.users.router import current_active_user
from src.workouts.models import Workout, WorkoutType


pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _seed_public_workout(db_session):
    source_user = User(
        email="source@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
        username="jane",
        name="Jane Lifter",
        bio="Strength training",
        is_profile_public=True,
    )
    viewer = User(
        email="viewer@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
        username="viewer",
        is_profile_public=False,
    )
    workout_type = WorkoutType(name="Strength", description="Heavy work")
    unit = IntensityUnit(name="Kilograms", abbreviation="kg")
    exercise_type = ExerciseType(
        name="Bench Press",
        description="Press",
        default_intensity_unit=None,
        times_used=0,
    )
    db_session.add_all([source_user, viewer, workout_type, unit, exercise_type])
    await db_session.flush()

    start = datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc)
    workout = Workout(
        name="Public Push Day",
        notes="private notes",
        recap="private recap",
        start_time=start,
        end_time=start + timedelta(minutes=45),
        workout_type_id=workout_type.id,
        owner_id=source_user.id,
        visibility=Workout.WorkoutVisibility.public,
    )
    private_workout = Workout(
        name="Private Pull Day",
        start_time=start - timedelta(days=1),
        end_time=start - timedelta(days=1) + timedelta(minutes=30),
        workout_type_id=workout_type.id,
        owner_id=source_user.id,
        visibility=Workout.WorkoutVisibility.private,
    )
    db_session.add_all([workout, private_workout])
    await db_session.flush()

    exercise = Exercise(
        timestamp=start,
        notes="private exercise note",
        exercise_type_id=exercise_type.id,
        workout_id=workout.id,
    )
    db_session.add(exercise)
    await db_session.flush()

    db_session.add(
        ExerciseSet(
            reps=5,
            intensity=Decimal("100.000"),
            rpe=Decimal("8.0"),
            intensity_unit_id=unit.id,
            exercise_id=exercise.id,
            done=True,
            notes="private set note",
            rest_time_seconds=120,
            type="working",
        )
    )
    await db_session.commit()
    return source_user, viewer, workout


async def test_public_profile_activity_read_path_omits_private_fields(
    async_client: AsyncClient, db_session
):
    _, _, workout = await _seed_public_workout(db_session)

    profile_response = await async_client.get(f"{settings.API_PREFIX}/profiles/jane")
    assert profile_response.status_code == 200
    profile_body = profile_response.json()
    assert profile_body["username"] == "jane"
    assert profile_body["display_name"] == "Jane Lifter"
    assert profile_body["public_workout_count"] == 1
    assert "email" not in profile_body

    activities_response = await async_client.get(
        f"{settings.API_PREFIX}/profiles/jane/activities"
    )
    assert activities_response.status_code == 200
    activities_body = activities_response.json()
    assert [item["id"] for item in activities_body["data"]] == [workout.id]
    assert activities_body["data"][0]["exercise_names_preview"] == ["Bench Press"]

    detail_response = await async_client.get(
        f"{settings.API_PREFIX}/profiles/jane/activities/{workout.id}"
    )
    assert detail_response.status_code == 200
    detail_body = detail_response.json()
    assert detail_body["id"] == workout.id
    assert detail_body["exercises"][0]["exercise_type"]["name"] == "Bench Press"
    assert detail_body["exercises"][0]["sets"][0]["reps"] == 5
    assert "notes" not in detail_body
    assert "recap" not in detail_body
    assert "owner_id" not in detail_body
    assert "rest_time_seconds" not in detail_body["exercises"][0]["sets"][0]


async def test_save_public_activity_as_private_routine(
    async_client: AsyncClient, db_session
):
    _, viewer, workout = await _seed_public_workout(db_session)

    async def _override_user():
        return viewer

    app.dependency_overrides[current_active_user] = _override_user
    try:
        response = await async_client.post(
            f"{settings.API_PREFIX}/profiles/jane/activities/{workout.id}/save-as-routine",
            json={"name": "Jane Push Template"},
        )
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Jane Push Template"
    assert body["creator_id"] == viewer.id
    assert body["visibility"] == "private"
    assert body["exercise_templates"][0]["notes"] is None
    assert body["exercise_templates"][0]["set_templates"][0]["notes"] is None
    assert body["exercise_templates"][0]["set_templates"][0]["reps"] == 5
