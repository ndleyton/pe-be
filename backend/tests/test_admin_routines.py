import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.main import app
from src.users.models import User
from src.users.router import current_active_user
from src.exercises.models import ExerciseType, IntensityUnit
from src.workouts.models import WorkoutType


@pytest.mark.integration
@pytest.mark.asyncio
async def test_admin_create_routine_requires_superuser(
    db_session: AsyncSession, async_client: AsyncClient
):
    """POST /api/v1/admin/routines should return 403 for non-admins."""

    # Non-admin user
    user = User(
        email="nonadmin@example.com",
        hashed_password="not-used",
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
        payload = {
            "name": "Should Fail",
            "description": "Attempt by non-admin",
            "workout_type_id": 1,
            "exercise_templates": [],
        }

        resp = await async_client.post("/api/v1/admin/routines", json=payload)
        assert resp.status_code == 403, resp.text
        body = resp.json()
        assert body.get("detail") == "Admin only"
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_admin_create_routine_success_sets_flags(
    db_session: AsyncSession, async_client: AsyncClient
):
    """
    POST /api/v1/admin/routines creates a routine and honors visibility and is_readonly.
    """

    # Seed reference data required by FKs
    intensity_unit = IntensityUnit(name="Pounds", abbreviation="lb")
    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add_all([intensity_unit, workout_type])
    await db_session.flush()

    exercise_type = ExerciseType(
        name="Admin Integration Exercise",
        description="Used for admin routines integration test",
        default_intensity_unit=intensity_unit.id,
    )
    db_session.add(exercise_type)
    await db_session.flush()

    # Admin user
    admin_user = User(
        email="admin@example.com",
        hashed_password="not-used",
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(admin_user)
    await db_session.flush()

    async def override_user():
        return admin_user

    app.dependency_overrides[current_active_user] = override_user

    try:
        payload = {
            "name": "Admin Routine",
            "description": "Created by admin with flags",
            "workout_type_id": workout_type.id,
            "visibility": "public",
            "is_readonly": True,
            "exercise_templates": [
                {
                    "exercise_type_id": exercise_type.id,
                    "set_templates": [
                        {
                            "reps": 12,
                            "intensity": 40.0,
                            "intensity_unit_id": intensity_unit.id,
                        }
                    ],
                }
            ],
        }

        resp = await async_client.post("/api/v1/admin/routines", json=payload)
        assert resp.status_code == 201, resp.text
        data = resp.json()

        # Basic shape
        assert data["name"] == payload["name"]
        assert data["workout_type_id"] == workout_type.id
        assert isinstance(data.get("id"), int)

        # Admin flags honored
        assert data["visibility"] == "public"
        assert data["is_readonly"] is True

        # Nested content present
        assert len(data.get("exercise_templates", [])) == 1
        tpl = data["exercise_templates"][0]
        assert tpl["exercise_type_id"] == exercise_type.id
        assert len(tpl.get("set_templates", [])) == 1
        first_set = tpl["set_templates"][0]
        assert first_set["reps"] == 12
        assert first_set["intensity_unit_id"] == intensity_unit.id
        assert first_set.get("intensity_unit", {}).get("id") == intensity_unit.id
    finally:
        app.dependency_overrides.pop(current_active_user, None)
