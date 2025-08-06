from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime

from src.exercise_sets.models import ExerciseSet
from src.exercise_sets.schemas import ExerciseSetCreate, ExerciseSetUpdate
from src.exercises.models import Exercise


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


async def get_exercise_sets_for_exercise(
    session: AsyncSession, exercise_id: int
) -> List[ExerciseSet]:
    """Get all exercise sets for a specific exercise (excluding soft-deleted)"""
    result = await session.execute(
        select(ExerciseSet)
        .where(ExerciseSet.exercise_id == exercise_id, ExerciseSet.deleted_at.is_(None))
    )
    return result.scalars().all()


async def create_exercise_set(
    session: AsyncSession, exercise_set_create: ExerciseSetCreate
) -> ExerciseSet:
    """Create a new exercise set"""
    exercise_set = ExerciseSet(**exercise_set_create.dict())
    session.add(exercise_set)
    await session.commit()
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

    await session.commit()
    await session.refresh(exercise_set)
    return exercise_set


async def soft_delete_exercise_set(session: AsyncSession, exercise_set_id: int) -> bool:
    """Soft delete an exercise set by setting deleted_at timestamp"""
    exercise_set = await get_exercise_set_by_id(session, exercise_set_id)
    if not exercise_set:
        return False

    exercise_set.deleted_at = datetime.utcnow()
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
