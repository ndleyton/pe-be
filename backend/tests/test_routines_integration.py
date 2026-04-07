import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from types import SimpleNamespace

from src.main import app
from src.users.models import User
from src.users.router import current_active_user, current_optional_user
from src.exercises.models import ExerciseType, IntensityUnit
from src.workouts.models import WorkoutType
from src.routines.models import Routine


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
        return SimpleNamespace(id=user_id, is_superuser=False)

    app.dependency_overrides[current_active_user] = override_user
    app.dependency_overrides[current_optional_user] = override_user

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
        app.dependency_overrides.pop(current_optional_user, None)


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
        return SimpleNamespace(id=user_id, is_superuser=False)

    app.dependency_overrides[current_active_user] = override_user
    app.dependency_overrides[current_optional_user] = override_user

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
            "visibility": "link_only",
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
        assert updated["visibility"] == "link_only"
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
        assert fetched["visibility"] == "link_only"
        assert len(fetched["exercise_templates"]) == 1
        assert (
            fetched["exercise_templates"][0]["exercise_type_id"] == exercise_type_b.id
        )
        assert len(fetched["exercise_templates"][0]["set_templates"]) == 2
    finally:
        app.dependency_overrides.pop(current_active_user, None)
        app.dependency_overrides.pop(current_optional_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_superuser_can_update_and_delete_other_users_routine(
    db_session: AsyncSession, async_client: AsyncClient
):
    """Superusers can mutate routines they do not own."""

    intensity_unit = IntensityUnit(name="Kilograms", abbreviation="kg")
    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add_all([intensity_unit, workout_type])
    await db_session.flush()

    exercise_type = ExerciseType(
        name="Front Squat",
        description="Leg strength",
        default_intensity_unit=intensity_unit.id,
    )
    db_session.add(exercise_type)
    await db_session.flush()

    owner = User(
        email="routine-owner@example.com",
        hashed_password="not-used-in-tests",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    admin = User(
        email="routine-admin@example.com",
        hashed_password="not-used-in-tests",
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add_all([owner, admin])
    await db_session.flush()

    async def override_owner():
        return SimpleNamespace(id=owner.id, is_superuser=False)

    app.dependency_overrides[current_active_user] = override_owner

    try:
        create_resp = await async_client.post(
            "/api/v1/routines/",
            json={
                "name": "Owner Routine",
                "description": "Created by owner",
                "workout_type_id": workout_type.id,
                "exercise_templates": [
                    {
                        "exercise_type_id": exercise_type.id,
                        "set_templates": [
                            {
                                "reps": 5,
                                "intensity": 80.0,
                                "intensity_unit_id": intensity_unit.id,
                            }
                        ],
                    }
                ],
            },
        )
        assert create_resp.status_code == 201, create_resp.text
        routine_id = create_resp.json()["id"]
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    async def override_admin():
        return SimpleNamespace(id=admin.id, is_superuser=True)

    app.dependency_overrides[current_active_user] = override_admin

    try:
        update_resp = await async_client.put(
            f"/api/v1/routines/{routine_id}",
            json={"name": "Admin Updated Routine"},
        )
        assert update_resp.status_code == 200, update_resp.text
        assert update_resp.json()["name"] == "Admin Updated Routine"

        delete_resp = await async_client.delete(f"/api/v1/routines/{routine_id}")
        assert delete_resp.status_code == 204, delete_resp.text
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_unauthenticated_users_can_view_shareable_routine_only(
    db_session: AsyncSession, async_client: AsyncClient
):
    """Unauthenticated users can fetch public/link-only detail but not private ones."""

    intensity_unit = IntensityUnit(name="Pounds", abbreviation="lb")
    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add_all([intensity_unit, workout_type])
    await db_session.flush()

    exercise_type = ExerciseType(
        name="Bench Press",
        description="Chest press",
        default_intensity_unit=intensity_unit.id,
    )
    db_session.add(exercise_type)
    await db_session.flush()

    owner = User(
        email="public-routine-owner@example.com",
        hashed_password="not-used-in-tests",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(owner)
    await db_session.flush()

    public_routine = Routine(
        name="Public Routine",
        description="Visible to signed-out visitors",
        workout_type_id=workout_type.id,
        creator_id=owner.id,
        visibility=Routine.RoutineVisibility.public,
        is_readonly=False,
    )
    private_routine = Routine(
        name="Private Routine",
        description="Hidden from signed-out visitors",
        workout_type_id=workout_type.id,
        creator_id=owner.id,
        visibility=Routine.RoutineVisibility.private,
        is_readonly=False,
    )
    link_only_routine = Routine(
        name="Link-Only Routine",
        description="Visible only when opened via direct link",
        workout_type_id=workout_type.id,
        creator_id=owner.id,
        visibility=Routine.RoutineVisibility.link_only,
        is_readonly=False,
    )

    db_session.add_all([public_routine, private_routine, link_only_routine])
    await db_session.flush()
    public_routine_id = public_routine.id
    private_routine_id = private_routine.id
    link_only_routine_id = link_only_routine.id
    await db_session.commit()

    public_resp = await async_client.get(f"/api/v1/routines/{public_routine_id}")
    assert public_resp.status_code == 200, public_resp.text
    assert public_resp.json()["name"] == "Public Routine"

    link_only_resp = await async_client.get(f"/api/v1/routines/{link_only_routine_id}")
    assert link_only_resp.status_code == 200, link_only_resp.text
    assert link_only_resp.json()["name"] == "Link-Only Routine"

    private_resp = await async_client.get(f"/api/v1/routines/{private_routine_id}")
    assert private_resp.status_code == 404, private_resp.text


@pytest.mark.integration
@pytest.mark.asyncio
async def test_unauthenticated_users_list_only_public_routines(
    db_session: AsyncSession,
    async_client: AsyncClient,
):
    """Unauthenticated users can list public routines but not private/link-only ones."""

    workout_type = WorkoutType(name="Strength", description="Strength training")
    owner = User(
        email="routine-public-list-owner@example.com",
        hashed_password="not-used-in-tests",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add_all([workout_type, owner])
    await db_session.flush()

    db_session.add_all(
        [
            Routine(
                name="Public Routine",
                description="Visible to signed-out visitors",
                workout_type_id=workout_type.id,
                creator_id=owner.id,
                visibility=Routine.RoutineVisibility.public,
                is_readonly=True,
            ),
            Routine(
                name="Private Routine",
                description="Hidden from signed-out visitors",
                workout_type_id=workout_type.id,
                creator_id=owner.id,
                visibility=Routine.RoutineVisibility.private,
                is_readonly=False,
            ),
            Routine(
                name="Link Only Routine",
                description="Not listed publicly",
                workout_type_id=workout_type.id,
                creator_id=owner.id,
                visibility=Routine.RoutineVisibility.link_only,
                is_readonly=True,
            ),
        ]
    )
    await db_session.commit()

    resp = await async_client.get("/api/v1/routines/?offset=0&limit=10")
    assert resp.status_code == 200, resp.text

    names = {item["name"] for item in resp.json()}
    assert names == {"Public Routine"}
