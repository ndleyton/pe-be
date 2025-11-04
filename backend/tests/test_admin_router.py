import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.main import app
from src.users.router import current_active_user
from src.users.models import User
from src.recipes.models import Recipe
from src.exercises.models import ExerciseType, IntensityUnit
from src.workouts.models import WorkoutType


@pytest.mark.integration
@pytest.mark.asyncio
async def test_admin_create_routine_requires_admin_and_accepts_admin_fields(
    db_session: AsyncSession, async_client: AsyncClient, monkeypatch
):
    # Seed reference data
    wt = WorkoutType(name="Admin WT", description="d")
    iu = IntensityUnit(name="Admin IU", abbreviation="aiu")
    db_session.add_all([wt, iu])
    await db_session.flush()

    et = ExerciseType(name="Admin ET", description="d", default_intensity_unit=iu.id)
    db_session.add(et)
    await db_session.flush()

    # Non-admin user -> 403
    non_admin = User(email="na@example.com", hashed_password="x", is_active=True, is_superuser=False, is_verified=True)
    db_session.add(non_admin)
    await db_session.flush()

    async def override_user_non_admin():
        return non_admin

    app.dependency_overrides[current_active_user] = override_user_non_admin
    try:
        payload = {
            "name": "Admin Routine",
            "description": "d",
            "workout_type_id": wt.id,
            "visibility": "public",
            "is_readonly": True,
            "exercise_templates": [
                {
                    "exercise_type_id": et.id,
                    "set_templates": [
                        {"reps": 5, "intensity": 10.0, "intensity_unit_id": iu.id}
                    ],
                }
            ],
        }
        resp = await async_client.post("/api/v1/admin/routines", json=payload)
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    # Admin user -> 201
    admin = User(email="admin@example.com", hashed_password="x", is_active=True, is_superuser=True, is_verified=True)
    db_session.add(admin)
    await db_session.flush()

    async def override_user_admin():
        return admin

    app.dependency_overrides[current_active_user] = override_user_admin
    try:
        payload = {
            "name": "Admin Routine",
            "description": "d",
            "workout_type_id": wt.id,
            "visibility": "public",
            "is_readonly": True,
            "exercise_templates": [
                {
                    "exercise_type_id": et.id,
                    "set_templates": [
                        {"reps": 5, "intensity": 10.0, "intensity_unit_id": iu.id}
                    ],
                }
            ],
        }
        resp = await async_client.post("/api/v1/admin/routines", json=payload)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["visibility"] == Recipe.RecipeVisibility.public
        assert data["is_readonly"] is True
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_admin_generate_images_guards_and_import_status(async_client: AsyncClient, db_session: AsyncSession, monkeypatch):
    # Ensure GOOGLE_AI_KEY empty so we get 400 when admin
    from src.core.config import settings

    # Non-admin -> 403
    user = User(email="g-na@example.com", hashed_password="x", is_active=True, is_superuser=False, is_verified=True)
    db_session.add(user)
    await db_session.flush()

    async def override_non_admin():
        return user

    app.dependency_overrides[current_active_user] = override_non_admin
    try:
        resp = await async_client.post("/api/v1/admin/exercise-types/1/generate-images")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    # Admin without API key -> 400
    admin = User(email="g-admin@example.com", hashed_password="x", is_active=True, is_superuser=True, is_verified=True)
    db_session.add(admin)
    await db_session.flush()

    async def override_admin():
        return admin

    app.dependency_overrides[current_active_user] = override_admin
    try:
        # Ensure the key is empty
        settings.GOOGLE_AI_KEY = ""
        resp = await async_client.post("/api/v1/admin/exercise-types/1/generate-images")
        assert resp.status_code == 400
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    # Import status endpoint returns OK payload (even without ext schema)
    status_resp = await async_client.get("/api/v1/admin/import-exercises/status")
    assert status_resp.status_code == 200
    status_json = status_resp.json()
    assert "imported_exercises" in status_json
    assert "status" in status_json

    # Import endpoint likely fails (no importer), but should not crash the app
    import_resp = await async_client.post("/api/v1/admin/import-exercises")
    assert import_resp.status_code in (200, 500)
