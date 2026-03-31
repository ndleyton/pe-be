from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

from src.core.errors import DomainValidationError
from src.exercise_sets.models import ExerciseSet
from src.exercise_sets.schemas import ExerciseSetCreate, ExerciseSetUpdate
from src.exercises.models import Exercise
from src.workouts.models import Workout


def _get_constraint_name(error: IntegrityError) -> Optional[str]:
    if error.orig is None:
        return None

    diag = getattr(error.orig, "diag", None)
    if diag is not None:
        constraint_name = getattr(diag, "constraint_name", None)
        if constraint_name:
            return constraint_name

    return getattr(error.orig, "constraint_name", None)


def _map_exercise_set_integrity_error(
    error: IntegrityError,
) -> Optional[DomainValidationError]:
    constraint_name = _get_constraint_name(error)
    error_message = str(error.orig) if error.orig is not None else str(error)
    lowered = error_message.lower()

    if (
        constraint_name == "fk_exercise_sets_intensity_unit_id_intensity_units"
        or constraint_name == "exercise_sets_intensity_unit_id_fkey"
        or (
            "intensity_unit_id" in error_message and "foreign key constraint" in lowered
        )
    ):
        return DomainValidationError.invalid_reference(field="intensity_unit_id")

    if (
        constraint_name == "fk_exercise_sets_exercise_id_exercises"
        or constraint_name == "exercise_sets_exercise_id_fkey"
        or ("exercise_id" in error_message and "foreign key constraint" in lowered)
    ):
        return DomainValidationError.invalid_reference(field="exercise_id")

    return None


async def get_exercise_set_by_id(
    session: AsyncSession, exercise_set_id: int
) -> Optional[ExerciseSet]:
    """Get an exercise set by ID with relationships loaded (excluding soft-deleted)"""
    result = await session.execute(
        select(ExerciseSet)
        .options(selectinload(ExerciseSet.exercise).selectinload(Exercise.workout))
        .where(ExerciseSet.id == exercise_set_id, ExerciseSet.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_exercise_set_owner_and_deleted(
    session: AsyncSession, exercise_set_id: int
) -> Optional[tuple[int, Optional[datetime]]]:
    """Return (owner_id, deleted_at) for an exercise set via lightweight joins.

    This avoids eager-loading full ORM graphs when only ownership and deletion
    state are needed.
    """
    result = await session.execute(
        select(Workout.owner_id, ExerciseSet.deleted_at)
        .select_from(ExerciseSet)
        .join(Exercise, Exercise.id == ExerciseSet.exercise_id)
        .join(Workout, Workout.id == Exercise.workout_id)
        .where(ExerciseSet.id == exercise_set_id)
    )
    row = result.one_or_none()
    if not row:
        return None
    return (row.owner_id, row.deleted_at)


async def get_exercise_sets_for_exercise(
    session: AsyncSession, exercise_id: int
) -> List[ExerciseSet]:
    """Get all exercise sets for a specific exercise (excluding soft-deleted)"""
    result = await session.execute(
        select(ExerciseSet)
        .where(ExerciseSet.exercise_id == exercise_id, ExerciseSet.deleted_at.is_(None))
        .order_by(ExerciseSet.created_at.asc(), ExerciseSet.id.asc())
    )
    return result.scalars().all()


async def create_exercise_set(
    session: AsyncSession, exercise_set_create: ExerciseSetCreate
) -> ExerciseSet:
    """Create a new exercise set"""
    exercise_set = ExerciseSet(**exercise_set_create.dict())
    session.add(exercise_set)
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        mapped_error = _map_exercise_set_integrity_error(e)
        if mapped_error:
            raise mapped_error from e
        raise
    await session.refresh(exercise_set)
    return exercise_set


async def update_exercise_set(
    session: AsyncSession, exercise_set_id: int, exercise_set_update: ExerciseSetUpdate
) -> Optional[ExerciseSet]:
    """Update an existing exercise set (excluding soft-deleted)"""
    exercise_set = await get_exercise_set_by_id(session, exercise_set_id)
    if not exercise_set:
        return None

    # Update only the provided fields
    for field, value in exercise_set_update.dict(exclude_unset=True).items():
        setattr(exercise_set, field, value)

    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        mapped_error = _map_exercise_set_integrity_error(e)
        if mapped_error:
            raise mapped_error from e
        raise
    await session.refresh(exercise_set)
    return exercise_set


async def soft_delete_exercise_set(session: AsyncSession, exercise_set_id: int) -> bool:
    """Soft delete an exercise set by setting deleted_at timestamp"""
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(ExerciseSet.id, ExerciseSet.deleted_at).where(
            ExerciseSet.id == exercise_set_id
        )
    )
    row = result.one_or_none()
    if not row:
        return False

    if row.deleted_at is not None:
        return True

    await session.execute(
        (
            ExerciseSet.__table__.update()
            .where(ExerciseSet.id == exercise_set_id, ExerciseSet.deleted_at.is_(None))
            .values(deleted_at=now)
        )
    )
    await session.commit()
    return True


async def delete_exercise_set(session: AsyncSession, exercise_set_id: int) -> bool:
    """Hard delete an exercise set (legacy function, now uses soft delete)"""
    return await soft_delete_exercise_set(session, exercise_set_id)


async def verify_exercise_ownership(
    session: AsyncSession, exercise_id: int, user_id: int
) -> Optional[Exercise]:
    """Verify that an exercise belongs to the specified user"""
    result = await session.execute(
        select(Exercise)
        .options(selectinload(Exercise.workout))
        .where(Exercise.id == exercise_id)
    )
    exercise = result.scalar_one_or_none()

    if not exercise or exercise.workout.owner_id != user_id:
        return None

    return exercise
