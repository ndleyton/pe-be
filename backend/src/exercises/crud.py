from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update, func, and_, cast
from sqlalchemy.sql import text
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from src.exercises.models import Exercise, ExerciseType, IntensityUnit, Muscle, MuscleGroup
from src.exercise_sets.models import ExerciseSet
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


async def get_exercise_type_by_id(session: AsyncSession, exercise_type_id: int) -> Optional[ExerciseType]:
    """Get an exercise type by ID with relationships loaded"""
    result = await session.execute(
        select(ExerciseType)
        .options(
            selectinload(ExerciseType.muscles).selectinload(Muscle.muscle_group)
        )
        .where(ExerciseType.id == exercise_type_id)
    )
    return result.scalar_one_or_none()


async def create_exercise_type(session: AsyncSession, exercise_type_create: ExerciseTypeCreate) -> ExerciseType:
    """Create a new exercise type"""
    try:
        # Create base ExerciseType instance
        exercise_type = ExerciseType(
            name=exercise_type_create.name,
            description=exercise_type_create.description,
            default_intensity_unit=exercise_type_create.default_intensity_unit,
        )

        # If muscle IDs were provided, fetch and associate them
        if exercise_type_create.muscle_ids:
            result = await session.execute(
                select(Muscle).where(Muscle.id.in_(exercise_type_create.muscle_ids))
            )
            muscles = result.scalars().all()

            # Validate all requested muscles exist
            found_ids = {m.id for m in muscles}
            missing_ids = set(exercise_type_create.muscle_ids) - found_ids
            if missing_ids:
                raise ValueError(f"Muscle IDs not found: {', '.join(map(str, missing_ids))}")

            exercise_type.muscles = muscles

        session.add(exercise_type)
        await session.commit()
        await session.refresh(exercise_type)

        # Eagerly load muscles and muscle_group relationships for response serialization
        result = await session.execute(
            select(ExerciseType)
            .options(
                selectinload(ExerciseType.muscles).selectinload(Muscle.muscle_group)
            )
            .where(ExerciseType.id == exercise_type.id)
        )
        return result.scalar_one()
    except IntegrityError:
        await session.rollback()
        raise


# Intensity Unit CRUD operations
async def get_intensity_units(session: AsyncSession) -> List[IntensityUnit]:
    """Get all intensity units"""
    result = await session.execute(select(IntensityUnit))
    return result.scalars().all()


async def get_exercise_type_stats(session: AsyncSession, exercise_type_id: int) -> Dict[str, Any]:
    """Get exercise type statistics with optimized database queries"""
    
    # Get the exercise type first to get the default intensity unit
    exercise_type = await get_exercise_type_by_id(session, exercise_type_id)
    if not exercise_type:
        return {
            "progressiveOverload": [],
            "lastWorkout": None,
            "personalBest": None,
            "totalSets": 0,
            "intensityUnit": None
        }
    
    # Get the intensity unit
    intensity_unit_result = await session.execute(
        select(IntensityUnit).where(IntensityUnit.id == exercise_type.default_intensity_unit)
    )
    intensity_unit = intensity_unit_result.scalar_one_or_none()
    
    # For now, use a hybrid approach - fetch exercises but use some optimized queries
    exercises_result = await session.execute(
        select(Exercise)
        .options(selectinload(Exercise.exercise_sets))
        .where(Exercise.exercise_type_id == exercise_type_id)
        .order_by(Exercise.created_at.desc())
    )
    exercises = exercises_result.scalars().all()
    
    if not exercises:
        return {
            "progressiveOverload": [],
            "lastWorkout": None,
            "personalBest": None,
            "totalSets": 0,
            "intensityUnit": {
                "id": intensity_unit.id,
                "name": intensity_unit.name,
                "abbreviation": intensity_unit.abbreviation
            } if intensity_unit else None
        }
    
    # Calculate progressive overload data (grouped by date)
    progressive_overload = []
    date_groups = {}
    
    for exercise in exercises:
        date = exercise.created_at.date()
        if date not in date_groups:
            date_groups[date] = {
                "maxWeight": 0,
                "totalVolume": 0,
                "totalReps": 0
            }
        
        for exercise_set in exercise.exercise_sets:
            if exercise_set.intensity:
                date_groups[date]["maxWeight"] = max(date_groups[date]["maxWeight"], exercise_set.intensity)
                if exercise_set.reps:
                    date_groups[date]["totalVolume"] += exercise_set.intensity * exercise_set.reps
                    date_groups[date]["totalReps"] += exercise_set.reps
    
    for date, data in sorted(date_groups.items()):
        progressive_overload.append({
            "date": date.isoformat(),
            "maxWeight": data["maxWeight"],
            "totalVolume": data["totalVolume"],
            "reps": data["totalReps"]
        })
    
    # Get last workout info
    last_exercise = exercises[0] if exercises else None
    last_workout = None
    if last_exercise:
        sets_count = len(last_exercise.exercise_sets)
        total_reps = sum(s.reps or 0 for s in last_exercise.exercise_sets)
        max_weight = max((s.intensity or 0 for s in last_exercise.exercise_sets), default=0)
        total_volume = sum((s.intensity or 0) * (s.reps or 0) for s in last_exercise.exercise_sets)
        
        last_workout = {
            "date": last_exercise.created_at.isoformat(),
            "sets": sets_count,
            "totalReps": total_reps,
            "maxWeight": max_weight,
            "totalVolume": total_volume
        }
    
    # Get personal best (highest weight for single rep)
    personal_best = None
    best_weight = 0
    best_set = None
    best_exercise = None
    
    for exercise in exercises:
        for exercise_set in exercise.exercise_sets:
            if exercise_set.intensity and exercise_set.intensity > best_weight:
                best_weight = exercise_set.intensity
                best_set = exercise_set
                best_exercise = exercise
    
    if best_set:
        volume = (best_set.intensity or 0) * (best_set.reps or 0)
        personal_best = {
            "date": best_exercise.created_at.isoformat(),
            "weight": best_set.intensity,
            "reps": best_set.reps or 0,
            "volume": volume
        }
    
    # Calculate total sets across all exercises
    total_sets = sum(len(exercise.exercise_sets) for exercise in exercises)
    
    return {
        "progressiveOverload": progressive_overload,
        "lastWorkout": last_workout,
        "personalBest": personal_best,
        "totalSets": total_sets,
        "intensityUnit": {
            "id": intensity_unit.id,
            "name": intensity_unit.name,
            "abbreviation": intensity_unit.abbreviation
        } if intensity_unit else None
    } 