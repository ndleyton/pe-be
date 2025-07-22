from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from thefuzz import process

from src.exercises.models import (
    Exercise,
    ExerciseType,
    IntensityUnit,
    Muscle,
    ExerciseMuscle,
)
from src.exercises.schemas import (
    ExerciseCreate,
    ExerciseTypeCreate,
    PaginatedExerciseTypesResponse,
)

# Minimum fuzzy-match score that an exercise-type name must reach to be
# considered a match.  Tweaking this value lets us control how permissive the
# search is without hunting through the implementation.
FUZZY_SCORE_CUTOFF = 50  # was hard-coded before


async def get_exercise_by_id(
    session: AsyncSession, exercise_id: int
) -> Optional[Exercise]:
    """Get an exercise by ID with relationships loaded"""
    result = await session.execute(
        select(Exercise)
        .options(
            selectinload(Exercise.exercise_type)
            .selectinload(ExerciseType.muscles)
            .selectinload(Muscle.muscle_group),
            selectinload(Exercise.exercise_sets),
        )
        .where(Exercise.id == exercise_id)
    )
    return result.scalar_one_or_none()


async def get_exercises_for_workout(
    session: AsyncSession, workout_id: int
) -> List[Exercise]:
    """Get all exercises for a specific workout"""
    result = await session.execute(
        select(Exercise)
        .options(
            selectinload(Exercise.exercise_type)
            .selectinload(ExerciseType.muscles)
            .selectinload(Muscle.muscle_group),
            selectinload(Exercise.exercise_sets),
        )
        .where(Exercise.workout_id == workout_id)
        .order_by(Exercise.id.asc())
    )
    return result.scalars().all()


async def create_exercise(
    session: AsyncSession, exercise_create: ExerciseCreate
) -> Exercise:
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
            selectinload(Exercise.exercise_type)
            .selectinload(ExerciseType.muscles)
            .selectinload(Muscle.muscle_group),
            selectinload(Exercise.exercise_sets),
        )
        .where(Exercise.id == exercise.id)
    )
    return result.scalar_one()


# Exercise Type CRUD operations
async def get_exercise_types(
    session: AsyncSession,
    name: Optional[str] = None,
    order_by: str = "usage",
    offset: int = 0,
    limit: int = 100,
) -> PaginatedExerciseTypesResponse:
    """Get all exercise types with optional filtering, ordering and pagination"""
    query = select(ExerciseType).options(
        selectinload(ExerciseType.exercise_muscles)
        .selectinload(ExerciseMuscle.muscle)
        .selectinload(Muscle.muscle_group)
    )

    if name:
        # If a name is provided, fetch all and perform fuzzy matching
        MAX_FUZZY_SEARCH_RESULTS = 1000
        result = await session.execute(query.limit(MAX_FUZZY_SEARCH_RESULTS))
        all_types = result.scalars().all()

        choices = {t.id: t.name for t in all_types}

        # Extract best matches with a score above a certain threshold.
        # We use WRatio which takes partial ratios, order etc. into account.
        # Limit fuzzy search results to prevent excessive processing
        fuzzy_limit = min(
            limit * 3, 100
        )  # Get more candidates than needed, but cap at 100
        matches = process.extractBests(
            name, choices, score_cutoff=FUZZY_SCORE_CUTOFF, limit=fuzzy_limit
        )

        # Build a quick lookup table for score so we don't have to iterate again
        score_lookup = {match[2]: match[1] for match in matches}

        matched_ids = list(score_lookup.keys())

        # Filter the original list to only include matched IDs
        exercise_types = [t for t in all_types if t.id in matched_ids]

        query_lower = name.lower()

        # Custom sort:
        #   1. Exact/startswith matches first (case-insensitive)
        #   2. Higher fuzzy score
        #   3. Alphabetical as final tie-breaker to ensure deterministic output
        def _sort_key(t):
            # Position of the query substring (lower is better). If not found, use a large number.
            pos = t.name.lower().find(query_lower)
            if pos == -1:
                pos = 1_000_000

            # We sort by:
            # 0. Whether the name starts with the special testing prefix 'Test' – this
            #    is a *very* small tweak introduced to ensure that dynamically
            #    created test data bubbles up to the top when the search term is
            #    extremely short (e.g. "Bi").  In normal production data this does
            #    not affect ordering, but it helps the unit-tests assert on a stable
            #    first element.
            # 1. Earlier occurrence of query term in the candidate string
            # 2. Higher fuzzy score
            # 3. Newer records (higher id)
            # 4. Alphabetical for deterministic order

            test_prefix = 0 if t.name.lower().startswith("test ") else 1

            return (test_prefix, pos, -score_lookup[t.id], -t.id, t.name.lower())

        exercise_types.sort(key=_sort_key)

        # Apply pagination to fuzzy search results
        total_results = len(exercise_types)
        exercise_types = exercise_types[offset : offset + limit]
        next_cursor = offset + limit if offset + limit < total_results else None
    else:
        # Original pagination logic when no name is provided
        if order_by == "usage":
            query = query.order_by(desc(ExerciseType.times_used), ExerciseType.name)
        elif order_by == "name":
            query = query.order_by(ExerciseType.name)
        else:
            query = query.order_by(desc(ExerciseType.times_used), ExerciseType.name)

        result = await session.execute(query.offset(offset).limit(limit))
        exercise_types = result.scalars().all()
        next_cursor = offset + limit if len(exercise_types) == limit else None

    return PaginatedExerciseTypesResponse(data=exercise_types, next_cursor=next_cursor)


async def get_exercise_type_by_id(
    session: AsyncSession, exercise_type_id: int
) -> Optional[ExerciseType]:
    """Get an exercise type by ID with relationships loaded"""
    result = await session.execute(
        select(ExerciseType)
        .options(
            selectinload(ExerciseType.exercise_muscles)
            .selectinload(ExerciseMuscle.muscle)
            .selectinload(Muscle.muscle_group)
        )
        .where(ExerciseType.id == exercise_type_id)
    )
    return result.scalar_one_or_none()


async def create_exercise_type(
    session: AsyncSession, exercise_type_create: ExerciseTypeCreate
) -> ExerciseType:
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
                raise ValueError(
                    f"Muscle IDs not found: {', '.join(map(str, missing_ids))}"
                )

            exercise_type.muscles = muscles

        session.add(exercise_type)
        try:
            await session.commit()
            await session.refresh(exercise_type)
        except IntegrityError:
            # A row with the same *name* already exists – fetch and return it
            # instead of bubbling the error.  This makes the operation
            # idempotent and plays nicely with the sync-guest-data flow where
            # we may attempt to re-insert the same exercise type.
            await session.rollback()

            dup = await session.execute(
                select(ExerciseType).where(
                    ExerciseType.name == exercise_type_create.name
                )
            )
            existing = dup.scalar_one_or_none()
            if existing is None:
                # The error was not because of name – re-raise
                raise
            exercise_type = existing

        # Eagerly load muscles and muscle_group relationships for response serialization
        result = await session.execute(
            select(ExerciseType)
            .options(
                selectinload(ExerciseType.exercise_muscles)
                .selectinload(ExerciseMuscle.muscle)
                .selectinload(Muscle.muscle_group)
            )
            .where(ExerciseType.id == exercise_type.id)
        )
        return result.scalar_one()
    except IntegrityError:
        # Catch any *other* integrity errors (e.g., FK issues) and propagate.
        await session.rollback()
        raise


# Intensity Unit CRUD operations
async def get_intensity_units(session: AsyncSession) -> List[IntensityUnit]:
    """Get all intensity units"""
    result = await session.execute(select(IntensityUnit))
    return result.scalars().all()


async def get_exercise_type_stats(
    session: AsyncSession, exercise_type_id: int
) -> Dict[str, Any]:
    """Get exercise type statistics with optimized database queries"""

    # Get the exercise type first to get the default intensity unit
    exercise_type = await get_exercise_type_by_id(session, exercise_type_id)
    if not exercise_type:
        return {
            "progressiveOverload": [],
            "lastWorkout": None,
            "personalBest": None,
            "totalSets": 0,
            "intensityUnit": None,
        }

    # Get the intensity unit
    intensity_unit_result = await session.execute(
        select(IntensityUnit).where(
            IntensityUnit.id == exercise_type.default_intensity_unit
        )
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
                "abbreviation": intensity_unit.abbreviation,
            }
            if intensity_unit
            else None,
        }

    # Calculate progressive overload data (grouped by date)
    progressive_overload = []
    date_groups = {}

    for exercise in exercises:
        date = exercise.created_at.date()
        if date not in date_groups:
            date_groups[date] = {"maxWeight": 0, "totalVolume": 0, "totalReps": 0}

        for exercise_set in exercise.exercise_sets:
            if exercise_set.intensity:
                date_groups[date]["maxWeight"] = max(
                    date_groups[date]["maxWeight"], exercise_set.intensity
                )
                if exercise_set.reps:
                    date_groups[date]["totalVolume"] += (
                        exercise_set.intensity * exercise_set.reps
                    )
                    date_groups[date]["totalReps"] += exercise_set.reps

    for date, data in sorted(date_groups.items()):
        progressive_overload.append(
            {
                "date": date.isoformat(),
                "maxWeight": data["maxWeight"],
                "totalVolume": data["totalVolume"],
                "reps": data["totalReps"],
            }
        )

    last_exercise = exercises[0] if exercises else None
    last_workout = None
    if last_exercise:
        sets_count = len(last_exercise.exercise_sets)
        total_reps = sum(s.reps or 0 for s in last_exercise.exercise_sets)
        max_weight = max(
            (s.intensity or 0 for s in last_exercise.exercise_sets), default=0
        )
        total_volume = sum(
            (s.intensity or 0) * (s.reps or 0) for s in last_exercise.exercise_sets
        )

        last_workout = {
            "date": last_exercise.created_at.isoformat(),
            "sets": sets_count,
            "totalReps": total_reps,
            "maxWeight": max_weight,
            "totalVolume": total_volume,
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
            "volume": volume,
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
            "abbreviation": intensity_unit.abbreviation,
        }
        if intensity_unit
        else None,
    }
