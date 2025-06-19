from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.exercise_sets.models import ExerciseSet
from src.exercise_sets.schemas import ExerciseSetCreate, ExerciseSetUpdate
from src.exercises.models import Exercise


async def get_exercise_set_by_id(session: AsyncSession, exercise_set_id: int) -> Optional[ExerciseSet]:
    """Get an exercise set by ID with relationships loaded"""
    result = await session.execute(
        select(ExerciseSet)
        .options(selectinload(ExerciseSet.exercise).selectinload(Exercise.workout))
        .where(ExerciseSet.id == exercise_set_id)
    )
    return result.scalar_one_or_none()


async def get_exercise_sets_for_exercise(session: AsyncSession, exercise_id: int) -> List[ExerciseSet]:
    """Get all exercise sets for a specific exercise"""
    result = await session.execute(
        select(ExerciseSet).where(ExerciseSet.exercise_id == exercise_id)
    )
    return result.scalars().all()


async def create_exercise_set(session: AsyncSession, exercise_set_create: ExerciseSetCreate) -> ExerciseSet:
    """Create a new exercise set"""
    exercise_set = ExerciseSet(**exercise_set_create.dict())
    session.add(exercise_set)
    await session.commit()
    await session.refresh(exercise_set)
    return exercise_set


async def update_exercise_set(
    session: AsyncSession, 
    exercise_set_id: int, 
    exercise_set_update: ExerciseSetUpdate
) -> Optional[ExerciseSet]:
    """Update an existing exercise set"""
    exercise_set = await get_exercise_set_by_id(session, exercise_set_id)
    if not exercise_set:
        return None
    
    # Update only the provided fields
    for field, value in exercise_set_update.dict(exclude_unset=True).items():
        setattr(exercise_set, field, value)
    
    await session.commit()
    await session.refresh(exercise_set)
    return exercise_set


async def delete_exercise_set(session: AsyncSession, exercise_set_id: int) -> bool:
    """Delete an exercise set"""
    exercise_set = await get_exercise_set_by_id(session, exercise_set_id)
    if not exercise_set:
        return False
    
    await session.delete(exercise_set)
    await session.commit()
    return True


async def verify_exercise_ownership(session: AsyncSession, exercise_id: int, user_id: int) -> Optional[Exercise]:
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