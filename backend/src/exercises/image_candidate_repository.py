from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercises.models import ExerciseImageCandidate


ACTIVE_STATUS = ExerciseImageCandidate.AssetStatus.active.value
UPLOADED_REFERENCE = ExerciseImageCandidate.AssetKind.uploaded_reference.value
GENERATED_CANDIDATE = ExerciseImageCandidate.AssetKind.generated_candidate.value


async def get_active_uploaded_reference_by_hash(
    session: AsyncSession,
    *,
    exercise_type_id: int,
    sha256: str,
) -> ExerciseImageCandidate | None:
    result = await session.execute(
        select(ExerciseImageCandidate).where(
            ExerciseImageCandidate.exercise_type_id == exercise_type_id,
            ExerciseImageCandidate.asset_kind == UPLOADED_REFERENCE,
            ExerciseImageCandidate.status == ACTIVE_STATUS,
            ExerciseImageCandidate.sha256 == sha256,
        )
    )
    return result.scalar_one_or_none()


async def get_image_candidate_by_generation_key(
    session: AsyncSession,
    *,
    generation_key: str,
) -> ExerciseImageCandidate | None:
    result = await session.execute(
        select(ExerciseImageCandidate).where(
            ExerciseImageCandidate.generation_key == generation_key
        )
    )
    return result.scalar_one_or_none()


async def get_active_uploaded_references(
    session: AsyncSession,
    *,
    exercise_type_id: int,
) -> list[ExerciseImageCandidate]:
    result = await session.execute(
        select(ExerciseImageCandidate)
        .where(
            ExerciseImageCandidate.exercise_type_id == exercise_type_id,
            ExerciseImageCandidate.asset_kind == UPLOADED_REFERENCE,
            ExerciseImageCandidate.status == ACTIVE_STATUS,
        )
        .order_by(ExerciseImageCandidate.id.asc())
    )
    return result.scalars().all()


async def count_active_uploaded_references(
    session: AsyncSession,
    *,
    exercise_type_id: int,
) -> int:
    result = await session.execute(
        select(func.count(ExerciseImageCandidate.id)).where(
            ExerciseImageCandidate.exercise_type_id == exercise_type_id,
            ExerciseImageCandidate.asset_kind == UPLOADED_REFERENCE,
            ExerciseImageCandidate.status == ACTIVE_STATUS,
        )
    )
    return int(result.scalar_one())


async def sum_active_upload_bytes_for_user(
    session: AsyncSession,
    *,
    owner_id: int,
) -> int:
    result = await session.execute(
        select(ExerciseImageCandidate.storage_path).where(
            ExerciseImageCandidate.asset_kind == UPLOADED_REFERENCE,
            ExerciseImageCandidate.status == ACTIVE_STATUS,
            ExerciseImageCandidate.exercise_type.has(owner_id=owner_id),
        )
    )
    total = 0
    from src.exercises.image_assets import storage_path_for_relative_url

    for storage_path in result.scalars().all():
        try:
            file_path = storage_path_for_relative_url(storage_path)
            if file_path.is_file():
                total += file_path.stat().st_size
        except (OSError, ValueError):
            continue
    return total


async def get_uploaded_reference_by_id(
    session: AsyncSession,
    *,
    exercise_type_id: int,
    asset_id: int,
) -> ExerciseImageCandidate | None:
    result = await session.execute(
        select(ExerciseImageCandidate).where(
            ExerciseImageCandidate.id == asset_id,
            ExerciseImageCandidate.exercise_type_id == exercise_type_id,
            ExerciseImageCandidate.asset_kind == UPLOADED_REFERENCE,
        )
    )
    return result.scalar_one_or_none()


async def get_cleanup_eligible_candidates(
    session: AsyncSession,
    *,
    deleted_before: datetime,
    rejected_before: datetime,
    limit: int,
) -> list[ExerciseImageCandidate]:
    deleted = ExerciseImageCandidate.AssetStatus.deleted.value
    rejected = ExerciseImageCandidate.AssetStatus.rejected.value
    abandoned = ExerciseImageCandidate.AssetStatus.abandoned.value
    result = await session.execute(
        select(ExerciseImageCandidate)
        .where(
            ExerciseImageCandidate.status.in_((deleted, rejected, abandoned)),
            or_(
                (ExerciseImageCandidate.status == deleted)
                & (ExerciseImageCandidate.deleted_at <= deleted_before),
                (ExerciseImageCandidate.status.in_((rejected, abandoned)))
                & (ExerciseImageCandidate.updated_at <= rejected_before),
            ),
        )
        .order_by(ExerciseImageCandidate.updated_at.asc())
        .limit(limit)
    )
    return result.scalars().all()


async def get_all_upload_storage_paths(session: AsyncSession) -> set[str]:
    result = await session.execute(
        select(ExerciseImageCandidate.storage_path).where(
            ExerciseImageCandidate.storage_path.like(
                "uploads/exercise-type-candidates/%"
            )
        )
    )
    return set(result.scalars().all())
