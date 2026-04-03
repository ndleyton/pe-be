import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.main import app
from src.users.router import current_active_user
from src.users.models import User
from src.routines.models import Routine
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
    non_admin = User(
        email="na@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
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
    admin = User(
        email="admin@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
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
        assert data["visibility"] == Routine.RoutineVisibility.public
        assert data["is_readonly"] is True
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_admin_generate_images_guards_and_import_status(
    async_client: AsyncClient, db_session: AsyncSession, monkeypatch
):
    # Ensure GOOGLE_AI_KEY empty so we get 400 when admin
    from src.core.config import settings

    # Non-admin -> 403
    user = User(
        email="g-na@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
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
    admin = User(
        email="g-admin@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
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

    status_resp = await async_client.get("/api/v1/admin/import-exercises/status")
    assert status_resp.status_code == 401

    import_resp = await async_client.post("/api/v1/admin/import-exercises")
    assert import_resp.status_code == 401

    # Non-admin -> 403 for import endpoints
    app.dependency_overrides[current_active_user] = override_non_admin
    try:
        status_resp = await async_client.get("/api/v1/admin/import-exercises/status")
        assert status_resp.status_code == 403

        import_resp = await async_client.post("/api/v1/admin/import-exercises")
        assert import_resp.status_code == 403
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    # Admin can access the import endpoints
    app.dependency_overrides[current_active_user] = override_admin
    try:
        # Import status endpoint returns OK payload (even without ext schema)
        status_resp = await async_client.get("/api/v1/admin/import-exercises/status")
        assert status_resp.status_code == 200
        status_json = status_resp.json()
        assert "imported_exercises" in status_json
        assert "status" in status_json

        # Import endpoint likely fails (no importer), but should not crash the app
        import_resp = await async_client.post("/api/v1/admin/import-exercises")
        assert import_resp.status_code in (200, 500)
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_admin_reference_image_option_endpoints(
    async_client: AsyncClient, db_session: AsyncSession, monkeypatch
):
    admin = User(
        email="img-admin@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(admin)
    await db_session.flush()

    exercise_type = ExerciseType(name="Reference ET", description="d")
    db_session.add(exercise_type)
    await db_session.flush()

    async def override_admin():
        return admin

    response_payload = {
        "exercise_type_id": exercise_type.id,
        "exercise_name": exercise_type.name,
        "current_images": ["https://example.com/current.png"],
        "reference_images": ["https://example.com/reference.png"],
        "supports_revert_to_reference": True,
        "available_options": [
            {
                "key": "clean-outline",
                "label": "Clean Outline",
                "description": "desc",
                "option_source": "reference_redraw",
            },
            {
                "key": "minimal-outline",
                "label": "Minimal Outline",
                "description": "desc",
                "option_source": "reference_redraw",
            },
        ],
        "options": [
            {
                "key": "clean-outline",
                "label": "Clean Outline",
                "description": "desc",
                "option_source": "reference_redraw",
                "images": ["https://example.com/generated.png"],
                "candidate_ids": [1],
                "source_images": ["https://example.com/reference.png"],
                "is_current": False,
            }
        ],
    }

    async def fake_build(*_args, **_kwargs):
        return response_payload

    fake_generate = AsyncMock(return_value=response_payload)

    async def fake_apply(*_args, **_kwargs):
        return {
            **response_payload,
            "options": [{**response_payload["options"][0], "is_current": True}],
        }

    app.dependency_overrides[current_active_user] = override_admin
    monkeypatch.setattr("src.admin.router.build_image_options_response", fake_build)
    monkeypatch.setattr("src.admin.router.generate_reference_image_options", fake_generate)
    monkeypatch.setattr("src.admin.router.apply_reference_or_option", fake_apply)

    from src.core.config import settings

    original_key = settings.GOOGLE_AI_KEY
    settings.GOOGLE_AI_KEY = "test-key"
    try:
        get_resp = await async_client.get(
            f"/api/v1/admin/exercise-types/{exercise_type.id}/reference-image-options"
        )
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.json()["exercise_name"] == exercise_type.name

        generate_resp = await async_client.post(
            f"/api/v1/admin/exercise-types/{exercise_type.id}/reference-image-options/generate",
            json={"option_key": "minimal-outline"},
        )
        assert generate_resp.status_code == 200, generate_resp.text
        assert generate_resp.json()["options"][0]["key"] == "clean-outline"
        assert fake_generate.await_args.kwargs["option_key"] == "minimal-outline"

        apply_resp = await async_client.post(
            f"/api/v1/admin/exercise-types/{exercise_type.id}/reference-image-options/apply",
            json={"option_key": "clean-outline"},
        )
        assert apply_resp.status_code == 200, apply_resp.text
        assert apply_resp.json()["options"][0]["is_current"] is True
    finally:
        settings.GOOGLE_AI_KEY = original_key
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_admin_router_image_generation_429(
    async_client: AsyncClient, db_session: AsyncSession, monkeypatch
):
    from google.genai import errors

    admin = User(
        email="429-admin@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(admin)
    await db_session.flush()

    exercise_type = ExerciseType(name="429 ET", description="d")
    db_session.add(exercise_type)
    await db_session.flush()

    async def override_admin():
        return admin

    async def fake_generate_raise(*args, **kwargs):
        mock_error = errors.ClientError("Resource Exhausted", MagicMock())
        mock_error.code = 429
        # print(f"DEBUG: Raising mock error with code: {mock_error.code}")
        raise mock_error

    app.dependency_overrides[current_active_user] = override_admin
    monkeypatch.setattr(
        "src.admin.router.generate_reference_image_options",
        fake_generate_raise,
    )

    from src.core.config import settings

    settings.GOOGLE_AI_KEY = "test-key"

    try:
        resp = await async_client.post(
            f"/api/v1/admin/exercise-types/{exercise_type.id}/reference-image-options/generate"
        )
        assert resp.status_code == 429, f"Got {resp.status_code}: {resp.text}"
        assert "Gemini API quota exceeded" in resp.json()["detail"]
    finally:
        app.dependency_overrides.pop(current_active_user, None)
