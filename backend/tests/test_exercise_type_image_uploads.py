import base64
import json

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercises.image_candidate_repository import sum_active_upload_bytes_for_user
from src.exercises.models import ExerciseImageCandidate, ExerciseType
from src.main import app
from src.users.models import User
from src.users.router import current_active_user, current_optional_user


TINY_PNG_RED = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8DwnwEPYMInOXwUAAASWwIOH0pJXQAAAABJRU5ErkJggg=="
)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_owner_uploads_candidate_image_and_private_asset_is_authorized(
    async_client: AsyncClient,
    db_session: AsyncSession,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(
        "src.core.config.settings.EXERCISE_IMAGE_STORAGE_DIR",
        str(tmp_path),
    )
    user = User(
        email="candidate-image-owner@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    exercise_type = ExerciseType(
        name="Candidate Curl",
        description="Custom exercise",
        owner_id=user.id,
        status=ExerciseType.ExerciseTypeStatus.candidate,
    )
    db_session.add(exercise_type)
    await db_session.commit()
    await db_session.refresh(exercise_type)

    async def override_user():
        return user

    app.dependency_overrides[current_active_user] = override_user
    try:
        response = await async_client.post(
            f"/api/v1/exercises/exercise-types/{exercise_type.id}/images/",
            files={"file": ("reference.png", TINY_PNG_RED, "image/png")},
        )
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["asset_kind"] == "uploaded_reference"
    assert payload["status"] == "active"
    assert payload["mime_type"] == "image/png"
    assert payload["url"].startswith("/api/v1/exercises/assets/uploads/")

    row = (
        (
            await db_session.execute(
                select(ExerciseImageCandidate).where(
                    ExerciseImageCandidate.id == payload["id"]
                )
            )
        )
        .scalars()
        .one()
    )
    assert row.storage_path.startswith(
        f"uploads/exercise-type-candidates/user-{user.id}/"
        f"exercise-type-{exercise_type.id}/"
    )
    assert (tmp_path / row.storage_path).is_file()

    await db_session.refresh(exercise_type)
    assert json.loads(exercise_type.reference_images_url) == [row.storage_path]

    public_asset = await async_client.get(
        f"/api/v1/exercises/assets/{row.storage_path}"
    )
    assert public_asset.status_code == 401

    app.dependency_overrides[current_optional_user] = override_user
    try:
        owner_asset = await async_client.get(
            f"/api/v1/exercises/assets/{row.storage_path}"
        )
        exercise_response = await async_client.get(
            f"/api/v1/exercises/exercise-types/{exercise_type.id}"
        )
    finally:
        app.dependency_overrides.pop(current_optional_user, None)
    assert owner_asset.status_code == 200
    assert owner_asset.headers["x-content-type-options"] == "nosniff"
    assert exercise_response.status_code == 200
    assert exercise_response.json()["reference_images_url"] is None
    assert exercise_response.json()["reference_images"] == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_upload_duplicate_file_reuses_active_candidate_row(
    async_client: AsyncClient,
    db_session: AsyncSession,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(
        "src.core.config.settings.EXERCISE_IMAGE_STORAGE_DIR",
        str(tmp_path),
    )
    user = User(
        email="candidate-image-duplicate@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    exercise_type = ExerciseType(
        name="Duplicate Curl",
        owner_id=user.id,
        status=ExerciseType.ExerciseTypeStatus.candidate,
    )
    db_session.add(exercise_type)
    await db_session.commit()
    await db_session.refresh(exercise_type)

    async def override_user():
        return user

    app.dependency_overrides[current_active_user] = override_user
    try:
        first = await async_client.post(
            f"/api/v1/exercises/exercise-types/{exercise_type.id}/images/",
            files={"file": ("reference.png", TINY_PNG_RED, "image/png")},
        )
        second = await async_client.post(
            f"/api/v1/exercises/exercise-types/{exercise_type.id}/images/",
            files={"file": ("reference.png", TINY_PNG_RED, "image/png")},
        )
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["id"] == second.json()["id"]

    rows = (
        (
            await db_session.execute(
                select(ExerciseImageCandidate).where(
                    ExerciseImageCandidate.exercise_type_id == exercise_type.id
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_uploaded_candidate_image_marks_deleted_and_removes_reference(
    async_client: AsyncClient,
    db_session: AsyncSession,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(
        "src.core.config.settings.EXERCISE_IMAGE_STORAGE_DIR",
        str(tmp_path),
    )
    user = User(
        email="candidate-image-delete@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    exercise_type = ExerciseType(
        name="Delete Curl",
        owner_id=user.id,
        status=ExerciseType.ExerciseTypeStatus.candidate,
    )
    db_session.add(exercise_type)
    await db_session.commit()
    await db_session.refresh(exercise_type)

    async def override_user():
        return user

    app.dependency_overrides[current_active_user] = override_user
    try:
        upload = await async_client.post(
            f"/api/v1/exercises/exercise-types/{exercise_type.id}/images/",
            files={"file": ("reference.png", TINY_PNG_RED, "image/png")},
        )
        assert upload.status_code == 201, upload.text
        upload_payload = upload.json()
        assert "id" in upload_payload
        asset_id = upload_payload["id"]
        delete_response = await async_client.delete(
            f"/api/v1/exercises/exercise-types/{exercise_type.id}/images/{asset_id}"
        )
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    assert delete_response.status_code == 204, delete_response.text
    row = (
        (
            await db_session.execute(
                select(ExerciseImageCandidate).where(
                    ExerciseImageCandidate.id == asset_id
                )
            )
        )
        .scalars()
        .one()
    )
    assert row.status == "deleted"
    assert row.deleted_at is not None
    await db_session.refresh(exercise_type)
    assert json.loads(exercise_type.reference_images_url) == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_reupload_after_delete_revives_existing_generation_key(
    async_client: AsyncClient,
    db_session: AsyncSession,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(
        "src.core.config.settings.EXERCISE_IMAGE_STORAGE_DIR",
        str(tmp_path),
    )
    user = User(
        email="candidate-image-reupload@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    exercise_type = ExerciseType(
        name="Reupload Curl",
        owner_id=user.id,
        status=ExerciseType.ExerciseTypeStatus.candidate,
    )
    db_session.add(exercise_type)
    await db_session.commit()
    await db_session.refresh(exercise_type)

    async def override_user():
        return user

    app.dependency_overrides[current_active_user] = override_user
    try:
        upload = await async_client.post(
            f"/api/v1/exercises/exercise-types/{exercise_type.id}/images/",
            files={"file": ("reference.png", TINY_PNG_RED, "image/png")},
        )
        assert upload.status_code == 201, upload.text
        upload_payload = upload.json()
        assert "id" in upload_payload
        asset_id = upload_payload["id"]
        delete_response = await async_client.delete(
            f"/api/v1/exercises/exercise-types/{exercise_type.id}/images/{asset_id}"
        )
        reupload = await async_client.post(
            f"/api/v1/exercises/exercise-types/{exercise_type.id}/images/",
            files={"file": ("reference-again.png", TINY_PNG_RED, "image/png")},
        )
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    assert upload.status_code == 201, upload.text
    assert delete_response.status_code == 204, delete_response.text
    assert reupload.status_code == 201, reupload.text
    assert reupload.json()["id"] == asset_id

    row = (
        (
            await db_session.execute(
                select(ExerciseImageCandidate).where(
                    ExerciseImageCandidate.id == asset_id
                )
            )
        )
        .scalars()
        .one()
    )
    assert row.status == "active"
    assert row.deleted_at is None
    assert row.original_filename == "reference-again.png"
    assert (tmp_path / row.storage_path).is_file()

    await db_session.refresh(exercise_type)
    assert json.loads(exercise_type.reference_images_url) == [row.storage_path]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_user_upload_byte_sum_counts_promoted_uploads(
    db_session: AsyncSession,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(
        "src.core.config.settings.EXERCISE_IMAGE_STORAGE_DIR",
        str(tmp_path),
    )
    user = User(
        email="candidate-image-quota@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    exercise_type = ExerciseType(
        name="Quota Curl",
        owner_id=user.id,
        status=ExerciseType.ExerciseTypeStatus.candidate,
    )
    db_session.add(exercise_type)
    await db_session.flush()

    active_path = (
        "uploads/exercise-type-candidates/"
        f"user-{user.id}/exercise-type-{exercise_type.id}/active.png"
    )
    promoted_path = (
        "uploads/exercise-type-candidates/"
        f"user-{user.id}/exercise-type-{exercise_type.id}/promoted.png"
    )
    deleted_path = (
        "uploads/exercise-type-candidates/"
        f"user-{user.id}/exercise-type-{exercise_type.id}/deleted.png"
    )
    for storage_path, contents in (
        (active_path, b"active"),
        (promoted_path, b"promoted"),
        (deleted_path, b"deleted"),
    ):
        file_path = tmp_path / storage_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(contents)

    db_session.add_all(
        [
            ExerciseImageCandidate(
                exercise_type_id=exercise_type.id,
                generation_key="active-upload",
                pipeline_key="user_upload_v1",
                option_key="uploaded-reference",
                option_label="Uploaded Reference",
                source_image_index=0,
                source_image_url=active_path,
                model_name="user-upload",
                prompt_version="n/a",
                mime_type="image/png",
                storage_path=active_path,
                asset_kind="uploaded_reference",
                status="active",
                sha256="a" * 64,
            ),
            ExerciseImageCandidate(
                exercise_type_id=exercise_type.id,
                generation_key="promoted-upload",
                pipeline_key="user_upload_v1",
                option_key="uploaded-reference",
                option_label="Uploaded Reference",
                source_image_index=1,
                source_image_url=promoted_path,
                model_name="user-upload",
                prompt_version="n/a",
                mime_type="image/png",
                storage_path=promoted_path,
                asset_kind="uploaded_reference",
                status="promoted",
                sha256="b" * 64,
            ),
            ExerciseImageCandidate(
                exercise_type_id=exercise_type.id,
                generation_key="deleted-upload",
                pipeline_key="user_upload_v1",
                option_key="uploaded-reference",
                option_label="Uploaded Reference",
                source_image_index=2,
                source_image_url=deleted_path,
                model_name="user-upload",
                prompt_version="n/a",
                mime_type="image/png",
                storage_path=deleted_path,
                asset_kind="uploaded_reference",
                status="deleted",
                sha256="c" * 64,
            ),
        ]
    )
    await db_session.commit()

    assert await sum_active_upload_bytes_for_user(db_session, owner_id=user.id) == len(
        b"active"
    ) + len(b"promoted")
