import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from types import SimpleNamespace

from src.main import app
from src.users.models import User
from src.users.router import current_active_user
from src.exercises.models import ExerciseType, IntensityUnit
from src.workouts.models import WorkoutType


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_routine_endpoint_success(
    db_session: AsyncSession, async_client: AsyncClient
):
    """End-to-end test for POST /api/v1/routines/ creating a routine with nested templates.

    Seeds minimal reference data (user, intensity unit, exercise type, workout type),
    overrides auth dependency to return our test user, then asserts 201 and response shape.
    """

    # Seed required reference data
    intensity_unit = IntensityUnit(name="Pounds", abbreviation="lb")
    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add_all([intensity_unit, workout_type])
    await db_session.flush()

    exercise_type = ExerciseType(
        name="Integration Exercise",
        description="Used for routines integration test",
        default_intensity_unit=intensity_unit.id,
    )
    db_session.add(exercise_type)
    await db_session.flush()

    # Create a test user and override current_active_user to return it
    user = User(
        email="routines-test@example.com",
        hashed_password="not-used-in-tests",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    user_id = user.id

    async def override_user():
        return SimpleNamespace(id=user_id)

    app.dependency_overrides[current_active_user] = override_user

    try:
        payload = {
            "name": "Integration Routine",
            "description": "Created via integration test",
            "workout_type_id": workout_type.id,
            "exercise_templates": [
                {
                    "exercise_type_id": exercise_type.id,
                    "set_templates": [
                        {
                            "reps": 10,
                            "intensity": 50.0,
                            "intensity_unit_id": intensity_unit.id,
                        },
                        {
                            "reps": 8,
                            "intensity": 60.0,
                            "intensity_unit_id": intensity_unit.id,
                        },
                    ],
                }
            ],
        }

        # Create the routine (recipe)
        resp = await async_client.post("/api/v1/routines/", json=payload)
        assert resp.status_code == 201, resp.text

        data = resp.json()
        assert data["name"] == payload["name"]
        assert data["workout_type_id"] == workout_type.id
        assert isinstance(data.get("id"), int)

        # Validate nested structure
        assert len(data["exercise_templates"]) == 1
        tpl = data["exercise_templates"][0]
        assert tpl["exercise_type_id"] == exercise_type.id
        assert len(tpl["set_templates"]) == 2

        first_set = tpl["set_templates"][0]
        assert first_set["reps"] == 10
        assert first_set["intensity_unit_id"] == intensity_unit.id
        # Ensure joined intensity unit is present in read model
        assert first_set.get("intensity_unit", {}).get("id") == intensity_unit.id

        # Verify GET list includes the created routine
        list_resp = await async_client.get("/api/v1/routines/?offset=0&limit=10")
        assert list_resp.status_code == 200, list_resp.text
        items = list_resp.json()
        assert any(item["id"] == data["id"] for item in items)

    finally:
        # Clean up dependency override and dispose engine/session
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_routine_endpoint_replaces_nested_templates(
    db_session: AsyncSession, async_client: AsyncClient
):
    """PUT /api/v1/routines/{id} replaces the full nested template tree."""

    intensity_unit_lb = IntensityUnit(name="Pounds", abbreviation="lb")
    intensity_unit_bw = IntensityUnit(name="Bodyweight", abbreviation="bw")
    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add_all([intensity_unit_lb, intensity_unit_bw, workout_type])
    await db_session.flush()

    exercise_type_a = ExerciseType(
        name="Bench Press",
        description="Chest press",
        default_intensity_unit=intensity_unit_lb.id,
    )
    exercise_type_b = ExerciseType(
        name="Pull Up",
        description="Vertical pull",
        default_intensity_unit=intensity_unit_bw.id,
    )
    db_session.add_all([exercise_type_a, exercise_type_b])
    await db_session.flush()

    user = User(
        email="routines-update-test@example.com",
        hashed_password="not-used-in-tests",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    user_id = user.id

    async def override_user():
        return SimpleNamespace(id=user_id)

    app.dependency_overrides[current_active_user] = override_user

    try:
        create_payload = {
            "name": "Original Routine",
            "description": "Before replace",
            "workout_type_id": workout_type.id,
            "exercise_templates": [
                {
                    "exercise_type_id": exercise_type_a.id,
                    "set_templates": [
                        {
                            "reps": 10,
                            "intensity": 135.0,
                            "intensity_unit_id": intensity_unit_lb.id,
                        }
                    ],
                }
            ],
        }

        create_resp = await async_client.post("/api/v1/routines/", json=create_payload)
        assert create_resp.status_code == 201, create_resp.text
        created = create_resp.json()

        update_payload = {
            "name": "Updated Routine",
            "description": "After replace",
            "workout_type_id": workout_type.id,
            "exercise_templates": [
                {
                    "exercise_type_id": exercise_type_b.id,
                    "set_templates": [
                        {
                            "reps": 8,
                            "intensity": None,
                            "intensity_unit_id": intensity_unit_bw.id,
                        },
                        {
                            "reps": 6,
                            "intensity": None,
                            "intensity_unit_id": intensity_unit_bw.id,
                        },
                    ],
                }
            ],
        }

        update_resp = await async_client.put(
            f"/api/v1/routines/{created['id']}",
            json=update_payload,
        )
        assert update_resp.status_code == 200, update_resp.text
        updated = update_resp.json()

        assert updated["name"] == "Updated Routine"
        assert updated["description"] == "After replace"
        assert len(updated["exercise_templates"]) == 1

        updated_template = updated["exercise_templates"][0]
        assert updated_template["exercise_type_id"] == exercise_type_b.id
        assert len(updated_template["set_templates"]) == 2
        assert updated_template["set_templates"][0]["reps"] == 8
        assert updated_template["set_templates"][0]["intensity"] is None

        get_resp = await async_client.get(f"/api/v1/routines/{created['id']}")
        assert get_resp.status_code == 200, get_resp.text
        fetched = get_resp.json()
        assert fetched["name"] == "Updated Routine"
        assert len(fetched["exercise_templates"]) == 1
        assert (
            fetched["exercise_templates"][0]["exercise_type_id"] == exercise_type_b.id
        )
        assert len(fetched["exercise_templates"][0]["set_templates"]) == 2
    finally:
        app.dependency_overrides.pop(current_active_user, None)
