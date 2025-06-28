from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from src.exercises.models import Exercise, ExerciseType, IntensityUnit, Muscle, MuscleGroup
from src.exercises.schemas import ExerciseCreate, ExerciseTypeCreate


async def get_exercise_by_id(session: AsyncSession, exercise_id: int) -> Optional[Exercise]:
    """Get an exercise by ID with relationships loaded"""
    result = await session.execute(
        select(Exercise)
        .options(
            selectinload(Exercise.exercise_type).selectinload(ExerciseType.muscles).selectinload(Muscle.muscle_group),
            selectinload(Exercise.exercise_sets)
        )
        .where(Exercise.id == exercise_id)
    )
    return result.scalar_one_or_none()


async def get_exercises_for_workout(session: AsyncSession, workout_id: int) -> List[Exercise]:
    """Get all exercises for a specific workout"""
    result = await session.execute(
        select(Exercise)
        .options(
            selectinload(Exercise.exercise_type).selectinload(ExerciseType.muscles).selectinload(Muscle.muscle_group),
            selectinload(Exercise.exercise_sets)
        )
        .where(Exercise.workout_id == workout_id)
        .order_by(Exercise.id.asc())
    )
    return result.scalars().all()


async def create_exercise(session: AsyncSession, exercise_create: ExerciseCreate) -> Exercise:
    """Create a new exercise"""
    exercise = Exercise(**exercise_create.dict())
    session.add(exercise)
    
    # Increment the times_used count for the selected exercise type
    await session.execute(
        update(ExerciseType)
        .where(ExerciseType.id == exercise_create.exercise_type_id)
        .values(times_used=ExerciseType.times_used + 1)
    )
    
    await session.commit()
    await session.refresh(exercise)
    
    # Fetch the exercise with eager loading for the response
    result = await session.execute(
        select(Exercise)
        .options(
            selectinload(Exercise.exercise_type).selectinload(ExerciseType.muscles).selectinload(Muscle.muscle_group),
            selectinload(Exercise.exercise_sets)
        )
        .where(Exercise.id == exercise.id)
    )
    return result.scalar_one()


# Exercise Type CRUD operations
async def get_exercise_types(session: AsyncSession, order_by: str = "usage") -> List[ExerciseType]:
    """Get all exercise types with optional ordering"""
    query = select(ExerciseType).options(
        selectinload(ExerciseType.muscles).selectinload(Muscle.muscle_group)
    )
    
    if order_by == "usage":
        # Order by times_used DESC (most used first), then by name ASC (alphabetical)
        query = query.order_by(desc(ExerciseType.times_used), ExerciseType.name)
    elif order_by == "name":
        # Order alphabetically by name
        query = query.order_by(ExerciseType.name)
    else:
        # Default to usage-based ordering
        query = query.order_by(desc(ExerciseType.times_used), ExerciseType.name)
    
    result = await session.execute(query)
    return result.scalars().all()


async def create_exercise_type(session: AsyncSession, exercise_type_create: ExerciseTypeCreate) -> ExerciseType:
    """Create a new exercise type"""
    try:
        exercise_type = ExerciseType(
            name=exercise_type_create.name,
            description=exercise_type_create.description,
            default_intensity_unit=exercise_type_create.default_intensity_unit
        )
        session.add(exercise_type)
        await session.commit()
        await session.refresh(exercise_type)
        return exercise_type
    except IntegrityError:
        await session.rollback()
        raise


# Intensity Unit CRUD operations
async def get_intensity_units(session: AsyncSession) -> List[IntensityUnit]:
    """Get all intensity units"""
    result = await session.execute(select(IntensityUnit))
    return result.scalars().all() 