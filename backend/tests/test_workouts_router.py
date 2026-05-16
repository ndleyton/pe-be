from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select

from src.core.config import settings
from src.main import app
from src.users.models import User
from src.users.router import current_active_user
from src.workouts.models import Workout, WorkoutPhoto, WorkoutType


pytestmark = pytest.mark.asyncio(loop_scope="session")


def _assert_versioned_workout_photo_url(
    url: str, *, workout_id: int, photo_id: int | None = None
) -> None:
    parsed = urlparse(url)
    assert parsed.path == f"/api/v1/workouts/{workout_id}/photo/file"
    version = parse_qs(parsed.query).get("v")
    assert version is not None
    assert len(version) == 1
    if photo_id is not None:
        assert version[0].startswith(f"{photo_id}-")
    else:
        assert "-" in version[0]


def _workout_payload(workout_id: int, owner_id: int = 123) -> dict:
    now = datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc).isoformat()
    return {
        "id": workout_id,
        "name": f"Workout {workout_id}",
        "notes": "notes",
        "start_time": now,
        "end_time": None,
        "workout_type_id": 4,
        "owner_id": owner_id,
        "created_at": now,
        "updated_at": now,
        "visibility": "private",
    }


def _exercise_payload(exercise_id: int, workout_id: int) -> dict:
    now = datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc).isoformat()
    return {
        "id": exercise_id,
        "timestamp": now,
        "notes": "exercise notes",
        "exercise_type_id": 9,
        "workout_id": workout_id,
        "created_at": now,
        "updated_at": now,
        "exercise_type": {
            "id": 9,
            "name": "Bench Press",
            "description": "Pressing movement",
            "default_intensity_unit": None,
            "times_used": 0,
            "muscles": [],
            "owner_id": None,
            "status": "released",
            "review_requested_at": None,
            "released_at": now,
            "reviewed_by": None,
            "review_notes": None,
            "images_url": None,
            "reference_images_url": None,
            "instructions": None,
            "equipment": None,
            "category": None,
            "created_at": now,
            "updated_at": now,
            "images": [],
            "reference_images": [],
        },
        "exercise_sets": [],
    }


@pytest.fixture
def override_workout_user():
    async def _override_user():
        return SimpleNamespace(id=123)

    app.dependency_overrides[current_active_user] = _override_user
    try:
        yield
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest_asyncio.fixture
async def authenticated_workout_user(db_session):
    user = User(
        email="workout-router@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    async def _override_user():
        return user

    app.dependency_overrides[current_active_user] = _override_user
    try:
        yield user
    finally:
        app.dependency_overrides.pop(current_active_user, None)


async def test_get_my_workouts_returns_next_cursor(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    fake_get_my_workouts = AsyncMock(
        return_value=[
            SimpleNamespace(**_workout_payload(3)),
            SimpleNamespace(**_workout_payload(2)),
        ]
    )
    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.get_my_workouts", fake_get_my_workouts
    )

    response = await async_client.get(
        f"{settings.API_PREFIX}/workouts/mine?limit=2&cursor=5"
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["data"]] == [3, 2]
    assert body["next_cursor"] == 2
    fake_get_my_workouts.assert_awaited_once()


async def test_get_my_workouts_returns_no_cursor_for_partial_page(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    fake_get_my_workouts = AsyncMock(return_value=[_workout_payload(1)])
    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.get_my_workouts", fake_get_my_workouts
    )

    response = await async_client.get(f"{settings.API_PREFIX}/workouts/mine?limit=2")

    assert response.status_code == 200
    assert response.json()["next_cursor"] is None


async def test_get_my_workouts_defaults_to_25_and_includes_photo_metadata(
    async_client: AsyncClient,
    authenticated_workout_user,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        "src.workouts.photo_service.settings.WORKOUT_PHOTO_STORAGE_DIR",
        str(tmp_path),
        raising=False,
    )

    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add(workout_type)
    await db_session.flush()

    workout = Workout(
        name="Photo List Workout",
        workout_type_id=workout_type.id,
        owner_id=authenticated_workout_user.id,
    )
    db_session.add(workout)
    await db_session.commit()
    await db_session.refresh(workout)

    buffer = BytesIO()
    Image.new("RGB", (8, 6), color="blue").save(buffer, format="PNG")
    upload_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/{workout.id}/photo",
        files={"file": ("progress.png", buffer.getvalue(), "image/png")},
    )
    assert upload_response.status_code == 200, upload_response.text

    response = await async_client.get(f"{settings.API_PREFIX}/workouts/mine")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["next_cursor"] is None
    returned_workout = next(item for item in body["data"] if item["id"] == workout.id)
    _assert_versioned_workout_photo_url(
        returned_workout["photo"]["url"],
        workout_id=workout.id,
        photo_id=upload_response.json()["id"],
    )


async def test_workout_router_create_and_types_endpoints(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    created_workout = _workout_payload(10)
    workout_types = [
        {
            "id": 1,
            "name": "Strength",
            "description": "Heavy",
            "created_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc).isoformat(),
            "updated_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc).isoformat(),
        }
    ]
    created_workout_type = workout_types[0]
    add_exercise_result = _workout_payload(11)

    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.create_new_workout",
        AsyncMock(return_value=created_workout),
    )
    monkeypatch.setattr(
        "src.workouts.router.WorkoutTypeService.get_all_workout_types",
        AsyncMock(return_value=workout_types),
    )
    monkeypatch.setattr(
        "src.workouts.router.WorkoutTypeService.create_new_workout_type",
        AsyncMock(return_value=created_workout_type),
    )
    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.add_exercise_to_current_workout",
        AsyncMock(return_value=add_exercise_result),
    )

    create_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/",
        json={"name": "Push Day", "workout_type_id": 4},
    )
    assert create_response.status_code == 201
    assert create_response.json()["id"] == 10

    types_response = await async_client.get(
        f"{settings.API_PREFIX}/workouts/workout-types/"
    )
    assert types_response.status_code == 200
    assert types_response.json()[0]["name"] == "Strength"

    create_type_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/workout-types/",
        json={"name": "Conditioning", "description": "Mixed"},
    )
    assert create_type_response.status_code == 201
    assert create_type_response.json()["id"] == 1

    add_exercise_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/add-exercise",
        json={"exercise_type_id": 9},
    )
    assert add_exercise_response.status_code == 201
    assert add_exercise_response.json()["id"] == 11


async def test_get_workout_and_update_workout_handle_not_found(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    fake_get_workout = AsyncMock(side_effect=[None, _workout_payload(7)])
    fake_update_workout = AsyncMock(side_effect=[None, _workout_payload(7)])

    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.get_workout", fake_get_workout
    )
    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.update_workout_data", fake_update_workout
    )

    missing_get = await async_client.get(f"{settings.API_PREFIX}/workouts/7")
    assert missing_get.status_code == 404
    assert missing_get.json()["detail"] == "Workout not found"

    found_get = await async_client.get(f"{settings.API_PREFIX}/workouts/7")
    assert found_get.status_code == 200
    assert found_get.json()["id"] == 7

    missing_patch = await async_client.patch(
        f"{settings.API_PREFIX}/workouts/7",
        json={"name": "Updated"},
    )
    assert missing_patch.status_code == 404
    assert missing_patch.json()["detail"] == "Workout not found"

    found_patch = await async_client.patch(
        f"{settings.API_PREFIX}/workouts/7",
        json={"name": "Updated"},
    )
    assert found_patch.status_code == 200
    assert found_patch.json()["id"] == 7


async def test_delete_workout_returns_204(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    fake_remove_workout = AsyncMock(return_value=True)
    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.remove_workout", fake_remove_workout
    )

    response = await async_client.delete(f"{settings.API_PREFIX}/workouts/12")

    assert response.status_code == 204
    fake_remove_workout.assert_awaited_once()


async def test_get_exercises_in_workout_handles_not_found_and_success(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    fake_get_workout = AsyncMock(side_effect=[None, _workout_payload(8)])
    fake_get_workout_exercises = AsyncMock(return_value=[_exercise_payload(1, 8)])

    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.get_workout", fake_get_workout
    )
    monkeypatch.setattr(
        "src.workouts.router.ExerciseService.get_workout_exercises",
        fake_get_workout_exercises,
    )

    missing = await async_client.get(f"{settings.API_PREFIX}/workouts/8/exercises")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Workout not found"

    found = await async_client.get(f"{settings.API_PREFIX}/workouts/8/exercises")
    assert found.status_code == 200
    assert found.json()[0]["id"] == 1


async def test_save_public_workout_as_routine_returns_created_routine(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    now = datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc).isoformat()
    created_routine = {
        "id": 21,
        "name": "Copied Routine",
        "description": "Reusable copy",
        "workout_type_id": 4,
        "creator_id": 123,
        "visibility": "private",
        "is_readonly": False,
        "author": None,
        "category": None,
        "created_at": now,
        "updated_at": now,
        "times_used": 0,
        "exercise_templates": [],
    }

    fake_clone = AsyncMock(return_value=created_routine)
    monkeypatch.setattr(
        "src.workouts.router.routine_service.clone_public_workout_to_private_routine",
        fake_clone,
    )

    response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/14/save-as-routine",
        json={"name": "Copied Routine", "description": "Reusable copy"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 21
    assert body["visibility"] == "private"
    fake_clone.assert_awaited_once()


async def test_save_public_workout_as_routine_returns_404_for_missing_source(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    monkeypatch.setattr(
        "src.workouts.router.routine_service.clone_public_workout_to_private_routine",
        AsyncMock(side_effect=LookupError("Workout not found")),
    )

    response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/404/save-as-routine"
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Workout not found"


async def test_workout_photo_upload_download_and_detail(
    async_client: AsyncClient,
    authenticated_workout_user,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        "src.workouts.photo_service.settings.WORKOUT_PHOTO_STORAGE_DIR",
        str(tmp_path),
        raising=False,
    )

    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add(workout_type)
    await db_session.flush()

    workout = Workout(
        name="Photo Workout",
        workout_type_id=workout_type.id,
        owner_id=authenticated_workout_user.id,
    )
    db_session.add(workout)
    await db_session.commit()
    await db_session.refresh(workout)

    buffer = BytesIO()
    Image.new("RGB", (8, 6), color="blue").save(buffer, format="PNG")
    buffer.seek(0)

    upload_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/{workout.id}/photo",
        files={"file": ("progress.png", buffer.getvalue(), "image/png")},
    )
    assert upload_response.status_code == 200, upload_response.text
    upload_payload = upload_response.json()
    assert upload_payload["workout_id"] == workout.id
    assert upload_payload["mime_type"] == "image/webp"
    assert upload_payload["width"] == 8
    assert upload_payload["height"] == 6
    _assert_versioned_workout_photo_url(
        upload_payload["url"], workout_id=workout.id, photo_id=upload_payload["id"]
    )

    detail_response = await async_client.get(
        f"{settings.API_PREFIX}/workouts/{workout.id}"
    )
    assert detail_response.status_code == 200, detail_response.text
    assert detail_response.json()["photo"]["url"] == upload_payload["url"]

    file_response = await async_client.get(
        f"{settings.API_PREFIX}/workouts/{workout.id}/photo/file"
    )
    assert file_response.status_code == 200, file_response.text
    assert file_response.headers["content-type"] == "image/webp"
    assert file_response.headers["cache-control"] == "private, max-age=3600"
    assert file_response.headers["x-content-type-options"] == "nosniff"
    assert file_response.content


async def test_workout_photo_upload_replacement_keeps_one_active_primary(
    async_client: AsyncClient,
    authenticated_workout_user,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        "src.workouts.photo_service.settings.WORKOUT_PHOTO_STORAGE_DIR",
        str(tmp_path),
        raising=False,
    )

    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add(workout_type)
    await db_session.flush()

    workout = Workout(
        name="Replacement Workout",
        workout_type_id=workout_type.id,
        owner_id=authenticated_workout_user.id,
    )
    db_session.add(workout)
    await db_session.commit()
    await db_session.refresh(workout)

    def _png_bytes(color: str) -> bytes:
        buffer = BytesIO()
        Image.new("RGB", (8, 6), color=color).save(buffer, format="PNG")
        return buffer.getvalue()

    first_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/{workout.id}/photo",
        files={"file": ("first.png", _png_bytes("blue"), "image/png")},
    )
    assert first_response.status_code == 200, first_response.text

    second_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/{workout.id}/photo",
        files={"file": ("second.png", _png_bytes("green"), "image/png")},
    )
    assert second_response.status_code == 200, second_response.text

    rows = (
        (
            await db_session.execute(
                select(WorkoutPhoto)
                .where(WorkoutPhoto.workout_id == workout.id)
                .order_by(WorkoutPhoto.id.asc())
            )
        )
        .scalars()
        .all()
    )
    active_rows = [row for row in rows if row.deleted_at is None]

    assert len(rows) == 2
    assert len(active_rows) == 1
    assert active_rows[0].original_filename == "second.png"


async def test_workout_photo_upload_requires_workout_ownership(
    async_client: AsyncClient,
    authenticated_workout_user,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        "src.workouts.photo_service.settings.WORKOUT_PHOTO_STORAGE_DIR",
        str(tmp_path),
        raising=False,
    )

    other_user = User(
        email="workout-photo-other@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(other_user)
    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add(workout_type)
    await db_session.flush()

    workout = Workout(
        name="Private Workout",
        workout_type_id=workout_type.id,
        owner_id=authenticated_workout_user.id,
    )
    db_session.add(workout)
    await db_session.commit()

    async def _other_override():
        return other_user

    async def _owner_override():
        return authenticated_workout_user

    app.dependency_overrides[current_active_user] = _other_override
    try:
        buffer = BytesIO()
        Image.new("RGB", (8, 6), color="blue").save(buffer, format="PNG")
        response = await async_client.post(
            f"{settings.API_PREFIX}/workouts/{workout.id}/photo",
            files={"file": ("progress.png", buffer.getvalue(), "image/png")},
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Workout not found"
    finally:
        app.dependency_overrides[current_active_user] = _owner_override


async def test_workout_photo_file_requires_workout_ownership(
    async_client: AsyncClient,
    authenticated_workout_user,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        "src.workouts.photo_service.settings.WORKOUT_PHOTO_STORAGE_DIR",
        str(tmp_path),
        raising=False,
    )

    other_user = User(
        email="workout-photo-reader@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(other_user)
    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add(workout_type)
    await db_session.flush()

    workout = Workout(
        name="Photo Workout",
        workout_type_id=workout_type.id,
        owner_id=authenticated_workout_user.id,
    )
    db_session.add(workout)
    await db_session.commit()
    await db_session.refresh(workout)

    buffer = BytesIO()
    Image.new("RGB", (8, 6), color="blue").save(buffer, format="PNG")
    upload_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/{workout.id}/photo",
        files={"file": ("progress.png", buffer.getvalue(), "image/png")},
    )
    assert upload_response.status_code == 200, upload_response.text

    async def _other_override():
        return other_user

    async def _owner_override():
        return authenticated_workout_user

    app.dependency_overrides[current_active_user] = _other_override
    try:
        response = await async_client.get(
            f"{settings.API_PREFIX}/workouts/{workout.id}/photo/file"
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Workout photo not found"
    finally:
        app.dependency_overrides[current_active_user] = _owner_override


async def test_workout_photo_upload_rejects_invalid_mime_type(
    async_client: AsyncClient,
    authenticated_workout_user,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        "src.workouts.photo_service.settings.WORKOUT_PHOTO_STORAGE_DIR",
        str(tmp_path),
        raising=False,
    )

    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add(workout_type)
    await db_session.flush()
    workout = Workout(
        name="Invalid Mime Workout",
        workout_type_id=workout_type.id,
        owner_id=authenticated_workout_user.id,
    )
    db_session.add(workout)
    await db_session.commit()
    await db_session.refresh(workout)

    buffer = BytesIO()
    Image.new("RGB", (8, 6), color="blue").save(buffer, format="GIF")
    response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/{workout.id}/photo",
        files={"file": ("progress.gif", buffer.getvalue(), "image/gif")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported image type"


async def test_workout_photo_upload_rejects_oversize_files(
    async_client: AsyncClient,
    authenticated_workout_user,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        "src.workouts.photo_service.settings.WORKOUT_PHOTO_STORAGE_DIR",
        str(tmp_path),
        raising=False,
    )
    monkeypatch.setattr(
        "src.workouts.router.settings.WORKOUT_PHOTO_MAX_BYTES",
        32,
        raising=False,
    )

    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add(workout_type)
    await db_session.flush()
    workout = Workout(
        name="Oversize Workout",
        workout_type_id=workout_type.id,
        owner_id=authenticated_workout_user.id,
    )
    db_session.add(workout)
    await db_session.commit()
    await db_session.refresh(workout)

    buffer = BytesIO()
    Image.new("RGB", (8, 6), color="blue").save(buffer, format="PNG")
    response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/{workout.id}/photo",
        files={"file": ("progress.png", buffer.getvalue(), "image/png")},
    )

    assert response.status_code == 413
    assert "Image upload exceeds maximum size of 32 bytes" in response.json()["detail"]


async def test_workout_photo_upload_requires_file_field(
    async_client: AsyncClient,
    authenticated_workout_user,
    db_session,
):
    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add(workout_type)
    await db_session.flush()
    workout = Workout(
        name="Missing File Workout",
        workout_type_id=workout_type.id,
        owner_id=authenticated_workout_user.id,
    )
    db_session.add(workout)
    await db_session.commit()
    await db_session.refresh(workout)

    response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/{workout.id}/photo"
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "file"]


async def test_workout_photo_file_returns_404_when_stored_file_is_missing(
    async_client: AsyncClient,
    authenticated_workout_user,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        "src.workouts.photo_service.settings.WORKOUT_PHOTO_STORAGE_DIR",
        str(tmp_path),
        raising=False,
    )

    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add(workout_type)
    await db_session.flush()

    workout = Workout(
        name="Missing Stored Photo Workout",
        workout_type_id=workout_type.id,
        owner_id=authenticated_workout_user.id,
    )
    db_session.add(workout)
    await db_session.commit()
    await db_session.refresh(workout)

    buffer = BytesIO()
    Image.new("RGB", (8, 6), color="blue").save(buffer, format="PNG")
    upload_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/{workout.id}/photo",
        files={"file": ("progress.png", buffer.getvalue(), "image/png")},
    )
    assert upload_response.status_code == 200, upload_response.text

    photo_row = (
        await db_session.execute(
            select(WorkoutPhoto).where(
                WorkoutPhoto.workout_id == workout.id,
                WorkoutPhoto.deleted_at.is_(None),
            )
        )
    ).scalar_one()
    stored_file = tmp_path / photo_row.storage_key
    stored_file.unlink()

    file_response = await async_client.get(
        f"{settings.API_PREFIX}/workouts/{workout.id}/photo/file"
    )
    assert file_response.status_code == 404
    assert file_response.json()["detail"] == "Workout photo file not found"
