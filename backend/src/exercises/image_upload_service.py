from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.exercises.image_assets import (
    exercise_image_storage_dir,
    parse_image_url_list,
    resolve_exercise_image_url,
    storage_path_for_relative_url,
)
from src.exercises.image_candidate_repository import (
    count_active_uploaded_references,
    get_active_uploaded_reference_by_hash,
    get_active_uploaded_references,
    get_all_upload_storage_paths,
    get_cleanup_eligible_candidates,
    get_image_candidate_by_generation_key,
    get_uploaded_reference_by_id,
    sum_active_upload_bytes_for_user,
)
from src.exercises.models import ExerciseImageCandidate, ExerciseType
from src.exercises.schemas import ExerciseTypeImageRead, ExerciseTypeImagesResponse
from src.shared.image_uploads import ImageUploadValidationError, sanitize_image_upload
from src.users.models import User

UPLOAD_PIPELINE_KEY = "user_upload_v1"
UPLOAD_OPTION_KEY = "uploaded-reference"
UPLOAD_OPTION_LABEL = "Uploaded Reference"
UPLOAD_MODEL_NAME = "user-upload"
UPLOAD_PROMPT_VERSION = "n/a"


def _image_json(image_urls: list[str]) -> str:
    return json.dumps(image_urls)


def _assert_can_manage_uploads(exercise_type: ExerciseType, user: User) -> None:
    if user.is_superuser:
        if exercise_type.status == ExerciseType.ExerciseTypeStatus.released:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot upload images to a released exercise type",
            )
        return

    if exercise_type.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if exercise_type.status != ExerciseType.ExerciseTypeStatus.candidate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Images can only be uploaded before review is requested",
        )


def _build_upload_generation_key(
    *,
    exercise_type_id: int,
    user_id: int,
    sha256: str,
) -> str:
    payload = {
        "exercise_type_id": exercise_type_id,
        "user_id": user_id,
        "sha256": sha256,
        "pipeline_key": UPLOAD_PIPELINE_KEY,
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode("utf-8")
    ).hexdigest()


def _storage_path_for_upload(
    *,
    user_id: int,
    exercise_type_id: int,
    asset_id: int,
    extension: str,
) -> str:
    return (
        "uploads/exercise-type-candidates/"
        f"user-{user_id}/exercise-type-{exercise_type_id}/{asset_id}.{extension}"
    )


def _append_reference_image(exercise_type: ExerciseType, storage_path: str) -> None:
    reference_images = parse_image_url_list(exercise_type.reference_images_url)
    if storage_path not in reference_images:
        reference_images.append(storage_path)
        exercise_type.reference_images_url = _image_json(reference_images)


def _remove_reference_image(exercise_type: ExerciseType, storage_path: str) -> None:
    reference_images = [
        image
        for image in parse_image_url_list(exercise_type.reference_images_url)
        if image != storage_path
    ]
    exercise_type.reference_images_url = _image_json(reference_images)


def _candidate_to_read(candidate: ExerciseImageCandidate) -> ExerciseTypeImageRead:
    return ExerciseTypeImageRead(
        id=candidate.id,
        asset_kind=candidate.asset_kind,
        status=candidate.status,
        url=resolve_exercise_image_url(candidate.storage_path),
        mime_type=candidate.mime_type,
        original_filename=candidate.original_filename,
        created_at=candidate.created_at,
        deleted_at=candidate.deleted_at,
    )


async def upload_candidate_image(
    session: AsyncSession,
    exercise_type: ExerciseType,
    *,
    user: User,
    filename: str,
    content_type: str,
    data: bytes,
) -> ExerciseImageCandidate:
    _assert_can_manage_uploads(exercise_type, user)
    try:
        sanitized = sanitize_image_upload(
            data,
            declared_mime_type=content_type,
            allowed_mime_types=settings.EXERCISE_IMAGE_UPLOAD_ALLOWED_MIME_TYPES,
            max_bytes=settings.EXERCISE_IMAGE_UPLOAD_MAX_BYTES,
            max_pixels=settings.EXERCISE_IMAGE_UPLOAD_MAX_PIXELS,
        )
    except ImageUploadValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    sha256 = hashlib.sha256(sanitized.data).hexdigest()
    existing = await get_active_uploaded_reference_by_hash(
        session,
        exercise_type_id=exercise_type.id,
        sha256=sha256,
    )
    if existing:
        _append_reference_image(exercise_type, existing.storage_path)
        await session.commit()
        await session.refresh(existing)
        return existing

    active_count = await count_active_uploaded_references(
        session, exercise_type_id=exercise_type.id
    )
    if active_count >= settings.EXERCISE_IMAGE_UPLOAD_MAX_COUNT_PER_TYPE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercise type image limit reached",
        )

    owner_id = exercise_type.owner_id or user.id
    current_bytes = await sum_active_upload_bytes_for_user(session, owner_id=owner_id)
    if (
        current_bytes + len(sanitized.data)
        > settings.EXERCISE_IMAGE_UPLOAD_MAX_BYTES_PER_USER
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercise image upload storage quota exceeded",
        )

    generation_key = _build_upload_generation_key(
        exercise_type_id=exercise_type.id,
        user_id=owner_id,
        sha256=sha256,
    )
    candidate = await get_image_candidate_by_generation_key(
        session,
        generation_key=generation_key,
    )
    if candidate is None:
        candidate = ExerciseImageCandidate(
            generation_key=generation_key,
            storage_path=f"pending/{generation_key}.{sanitized.extension}",
        )
        session.add(candidate)

    candidate.exercise_type_id = exercise_type.id
    candidate.pipeline_key = UPLOAD_PIPELINE_KEY
    candidate.option_key = UPLOAD_OPTION_KEY
    candidate.option_label = UPLOAD_OPTION_LABEL
    candidate.option_description = "User uploaded reference image."
    candidate.source_image_index = active_count
    candidate.source_image_url = ""
    candidate.model_name = UPLOAD_MODEL_NAME
    candidate.prompt_version = UPLOAD_PROMPT_VERSION
    candidate.prompt_summary = None
    candidate.mime_type = sanitized.mime_type
    candidate.asset_kind = ExerciseImageCandidate.AssetKind.uploaded_reference.value
    candidate.status = ExerciseImageCandidate.AssetStatus.active.value
    candidate.deleted_at = None
    candidate.original_filename = (filename or "upload")[:255]
    candidate.sha256 = sha256
    await session.flush()

    storage_path = _storage_path_for_upload(
        user_id=owner_id,
        exercise_type_id=exercise_type.id,
        asset_id=candidate.id,
        extension=sanitized.extension,
    )
    file_path = storage_path_for_relative_url(storage_path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(sanitized.data)

    try:
        candidate.storage_path = storage_path
        candidate.source_image_url = storage_path
        _append_reference_image(exercise_type, storage_path)
        await session.commit()
    except Exception:
        file_path.unlink(missing_ok=True)
        await session.rollback()
        raise

    await session.refresh(candidate)
    return candidate


async def list_exercise_type_images(
    session: AsyncSession,
    exercise_type: ExerciseType,
    *,
    user: User | None,
) -> ExerciseTypeImagesResponse:
    if exercise_type.status == ExerciseType.ExerciseTypeStatus.released and not (
        user and user.is_superuser
    ):
        images = [
            ExerciseTypeImageRead(
                asset_kind="published",
                status="active",
                url=resolve_exercise_image_url(image),
            )
            for image in parse_image_url_list(exercise_type.images_url)
        ]
        return ExerciseTypeImagesResponse(
            exercise_type_id=exercise_type.id, images=images
        )

    if user is None or (not user.is_superuser and exercise_type.owner_id != user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    candidates = await get_active_uploaded_references(
        session, exercise_type_id=exercise_type.id
    )
    return ExerciseTypeImagesResponse(
        exercise_type_id=exercise_type.id,
        images=[_candidate_to_read(candidate) for candidate in candidates],
    )


async def delete_candidate_image(
    session: AsyncSession,
    exercise_type: ExerciseType,
    *,
    asset_id: int,
    user: User,
) -> None:
    _assert_can_manage_uploads(exercise_type, user)
    candidate = await get_uploaded_reference_by_id(
        session,
        exercise_type_id=exercise_type.id,
        asset_id=asset_id,
    )
    if (
        candidate is None
        or candidate.status != ExerciseImageCandidate.AssetStatus.active.value
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Image not found"
        )

    now = datetime.now(timezone.utc)
    candidate.status = ExerciseImageCandidate.AssetStatus.deleted.value
    candidate.deleted_at = now
    _remove_reference_image(exercise_type, candidate.storage_path)
    await session.commit()


async def cleanup_exercise_image_candidates(
    session: AsyncSession,
    *,
    deleted_retention_days: int | None = None,
    rejected_retention_days: int | None = None,
    orphan_grace_hours: int | None = None,
    batch_size: int | None = None,
) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    candidates = await get_cleanup_eligible_candidates(
        session,
        deleted_before=now
        - timedelta(
            days=deleted_retention_days
            if deleted_retention_days is not None
            else settings.EXERCISE_IMAGE_DELETED_RETENTION_DAYS
        ),
        rejected_before=now
        - timedelta(
            days=rejected_retention_days
            if rejected_retention_days is not None
            else settings.EXERCISE_IMAGE_REJECTED_RETENTION_DAYS
        ),
        limit=batch_size or settings.EXERCISE_IMAGE_CLEANUP_BATCH_SIZE,
    )

    deleted_rows = 0
    reclaimed_bytes = 0
    for candidate in candidates:
        try:
            file_path = storage_path_for_relative_url(candidate.storage_path)
            if file_path.is_file():
                reclaimed_bytes += file_path.stat().st_size
                file_path.unlink(missing_ok=True)
        except (OSError, ValueError):
            pass
        await session.delete(candidate)
        deleted_rows += 1

    known_upload_paths = await get_all_upload_storage_paths(session)
    uploads_root = storage_path_for_relative_url("uploads/exercise-type-candidates")
    orphaned_files = 0
    orphan_grace = timedelta(
        hours=orphan_grace_hours
        if orphan_grace_hours is not None
        else settings.EXERCISE_IMAGE_ORPHAN_GRACE_HOURS
    )
    if uploads_root.exists():
        storage_root = exercise_image_storage_dir()
        for file_path in uploads_root.rglob("*"):
            if not file_path.is_file():
                continue
            try:
                relative_path = str(file_path.relative_to(storage_root))
                file_age = now - datetime.fromtimestamp(
                    file_path.stat().st_mtime,
                    tz=timezone.utc,
                )
            except OSError:
                continue
            if relative_path in known_upload_paths or file_age < orphan_grace:
                continue
            try:
                reclaimed_bytes += file_path.stat().st_size
                file_path.unlink(missing_ok=True)
                orphaned_files += 1
            except OSError:
                continue

    await session.commit()
    return {
        "deleted_rows": deleted_rows,
        "orphaned_files": orphaned_files,
        "reclaimed_bytes": reclaimed_bytes,
    }
