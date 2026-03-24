import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.exc import IntegrityError
from thefuzz import process, fuzz
from opentelemetry import trace

from src.core.errors import DomainValidationError

from src.core.observability import traced_model_validate
from src.exercises.models import (
    Exercise,
    ExerciseType,
    IntensityUnit,
    Muscle,
    ExerciseMuscle,
)
from src.exercise_sets.models import ExerciseSet
from src.workouts.models import Workout
from src.exercises.schemas import (
    ExerciseCreate,
    ExerciseTypeCreate,
    PaginatedExerciseTypesResponse,
)

tracer = trace.get_tracer(__name__)

# Minimum fuzzy-match score that an exercise-type name must reach to be
# considered a match.  Tweaking this value lets us control how permissive the
# search is without hunting through the implementation.
FUZZY_SCORE_CUTOFF = 50  # permissive enough for minor typos
logger = logging.getLogger(__name__)


def _build_paginated_exercise_types_response(
    *,
    exercise_types: list[ExerciseType],
    next_cursor: Optional[int],
    offset: int,
    limit: int,
    name: Optional[str],
    order_by: str,
) -> PaginatedExerciseTypesResponse:
    return traced_model_validate(
        PaginatedExerciseTypesResponse,
        {"data": exercise_types, "next_cursor": next_cursor},
        span_name="exercises.get_exercise_types.response_model_validate",
        attributes={
            "query.offset": offset,
            "query.limit": limit,
            "query.has_name_filter": name is not None,
            "query.order_by": order_by,
            "serialization.item_count": len(exercise_types),
        },
    )


def _get_constraint_name(error: IntegrityError) -> Optional[str]:
    if error.orig is None:
        return None

    diag = getattr(error.orig, "diag", None)
    if diag is not None:
        constraint_name = getattr(diag, "constraint_name", None)
        if constraint_name:
            return constraint_name

    return getattr(error.orig, "constraint_name", None)


def _map_exercise_integrity_error(
    error: IntegrityError,
) -> Optional[DomainValidationError]:
    constraint_name = _get_constraint_name(error)
    error_message = str(error.orig) if error.orig is not None else str(error)
    lowered = error_message.lower()

    if (
        constraint_name == "fk_exercises_exercise_type_id_exercise_types"
        or constraint_name == "exercises_exercise_type_id_fkey"
        or ("exercise_type_id" in error_message and "foreign key constraint" in lowered)
    ):
        return DomainValidationError.invalid_reference(field="exercise_type_id")

    if (
        constraint_name == "fk_exercises_workout_id_workouts"
        or constraint_name == "exercises_workout_id_fkey"
        or ("workout_id" in error_message and "foreign key constraint" in lowered)
    ):
        return DomainValidationError.invalid_reference(field="workout_id")

    return None


async def get_exercise_by_id(
    session: AsyncSession, exercise_id: int
) -> Optional[Exercise]:
    """Get an exercise by ID with relationships loaded"""
    result = await session.execute(
        select(Exercise)
        .options(
            selectinload(Exercise.exercise_type)
            .selectinload(ExerciseType.exercise_muscles)
            .selectinload(ExerciseMuscle.muscle)
            .selectinload(Muscle.muscle_group),
            selectinload(Exercise.exercise_sets.and_(ExerciseSet.deleted_at.is_(None))),
        )
        .where(Exercise.id == exercise_id, Exercise.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_exercises_for_workout(
    session: AsyncSession, workout_id: int
) -> List[Exercise]:
    """Get all exercises for a specific workout (excluding soft-deleted sets)"""
    result = await session.execute(
        select(Exercise)
        .options(
            selectinload(Exercise.exercise_type)
            .selectinload(ExerciseType.exercise_muscles)
            .selectinload(ExerciseMuscle.muscle)
            .selectinload(Muscle.muscle_group),
            selectinload(
                Exercise.exercise_sets.and_(ExerciseSet.deleted_at.is_(None))
            ).selectinload(ExerciseSet.intensity_unit),
        )
        .where(Exercise.workout_id == workout_id, Exercise.deleted_at.is_(None))
        .order_by(Exercise.id.asc())
    )
    return result.scalars().all()


async def create_exercise(
    session: AsyncSession, exercise_create: ExerciseCreate
) -> Exercise:
    """Create a new exercise"""
    exercise = Exercise(**exercise_create.dict())
    session.add(exercise)

    try:
        # Increment the times_used count for the selected exercise type
        await session.execute(
            update(ExerciseType)
            .where(ExerciseType.id == exercise_create.exercise_type_id)
            .values(times_used=ExerciseType.times_used + 1)
        )
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        mapped_error = _map_exercise_integrity_error(e)
        if mapped_error:
            raise mapped_error from e
        raise
    await session.refresh(exercise)

    # Fetch the exercise with eager loading for the response
    result = await session.execute(
        select(Exercise)
        .options(
            selectinload(Exercise.exercise_type)
            .selectinload(ExerciseType.exercise_muscles)
            .selectinload(ExerciseMuscle.muscle)
            .selectinload(Muscle.muscle_group),
            selectinload(Exercise.exercise_sets.and_(ExerciseSet.deleted_at.is_(None))),
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
        with tracer.start_as_current_span("exercises.crud.get_exercise_types.orm_hydration"):
            all_types = result.scalars().all()

        # Quick path: exact (case-insensitive) name match for determinism
        exact_matches = [
            t for t in all_types if t.name and t.name.lower() == name.lower()
        ]
        if exact_matches:
            exercise_types = exact_matches
            total_results = len(exact_matches)
            exercise_types = exercise_types[offset : offset + limit]
            next_cursor = offset + limit if offset + limit < total_results else None
            return _build_paginated_exercise_types_response(
                exercise_types=exercise_types,
                next_cursor=next_cursor,
                offset=offset,
                limit=limit,
                name=name,
                order_by=order_by,
            )

        # Filter out None/empty names to avoid TypeError from thefuzz
        valid_types = [
            t for t in all_types if isinstance(t.name, str) and t.name.strip()
        ]

        # Create a mapping of exercise types by ID for quick lookup
        types_by_id = {t.id: t for t in valid_types}

        # Use name->id mapping and pass only names to thefuzz to avoid tuple-order
        # differences across versions when passing a dict. Map back to ids afterward.
        name_to_id = {str(t.name): t.id for t in valid_types}
        candidate_names = list(name_to_id.keys())

        # Perform fuzzy matching with a single call
        with tracer.start_as_current_span("exercises.crud.get_exercise_types.fuzzy_matching"):
            matches = process.extractBests(
                name,
                candidate_names,
                scorer=fuzz.WRatio,  # Using WRatio for better overall matching
                score_cutoff=FUZZY_SCORE_CUTOFF,
                limit=min(
                    limit * 3, 100
                ),  # Get more candidates than needed, but cap at 100
            )
        logger.debug(
            "Computed fuzzy exercise type matches query=%r count=%s",
            name,
            len(matches),
        )
        if matches:
            # Create a score lookup by ID
            score_lookup = {
                name_to_id[m[0]]: m[1] for m in matches if m and m[0] in name_to_id
            }
            matched_ids = list(score_lookup.keys())

            # Get matched exercise types
            exercise_types = [
                types_by_id[id] for id in matched_ids if id in types_by_id
            ]

            # Simple sort key function that prioritizes:
            # 1. Starts with query (case-insensitive)
            # 2. Contains query (case-insensitive)
            # 3. Higher fuzzy score
            # 4. Alphabetical for deterministic order
            query_lower = name.lower()

            def _sort_key(t):
                name_lower = t.name.lower()
                starts_with = 0 if name_lower.startswith(query_lower) else 1
                contains = 0 if query_lower in name_lower else 1
                return (starts_with, contains, -score_lookup[t.id], name_lower)

            exercise_types.sort(key=_sort_key)

            # Apply pagination
            total_results = len(exercise_types)
            exercise_types = exercise_types[offset : offset + limit]
            next_cursor = offset + limit if offset + limit < total_results else None
        else:
            # Last-resort: take the single best match with a minimum acceptance threshold
            with tracer.start_as_current_span("exercises.crud.get_exercise_types.fuzzy_matching_fallback"):
                best = process.extractOne(name, candidate_names, scorer=fuzz.WRatio)
            if best and best[1] >= 60:
                matched_name = best[0]
                matched_id = name_to_id.get(matched_name)
                if matched_id is not None and matched_id in types_by_id:
                    exercise_types = [types_by_id[matched_id]]
                    total_results = 1
                    # Apply pagination
                    exercise_types = exercise_types[offset : offset + limit]
                    next_cursor = (
                        None if offset + limit >= total_results else offset + limit
                    )
                else:
                    exercise_types = []
                    next_cursor = None
            else:
                # No acceptable matches
                exercise_types = []
                next_cursor = None
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

    return _build_paginated_exercise_types_response(
        exercise_types=exercise_types,
        next_cursor=next_cursor,
        offset=offset,
        limit=limit,
        name=name,
        order_by=order_by,
    )


async def get_exercise_type_by_id(
    session: AsyncSession, exercise_type_id: int
) -> Optional[ExerciseType]:
    """Get an exercise type by ID with relationships loaded"""
    result = await session.execute(
        select(ExerciseType)
        .options(
            joinedload(ExerciseType.exercise_muscles)
            .joinedload(ExerciseMuscle.muscle)
            .joinedload(Muscle.muscle_group)
        )
        .where(ExerciseType.id == exercise_type_id)
    )
    return result.unique().scalar_one_or_none()


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

            # Create ExerciseMuscle relationships
            for muscle in muscles:
                exercise_muscle = ExerciseMuscle(
                    exercise_type=exercise_type,
                    muscle=muscle,
                    is_primary=False,  # You may want to make this configurable
                )
                session.add(exercise_muscle)

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
    session: AsyncSession, exercise_type_id: int, user_id: int
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
        .join(Workout, Exercise.workout_id == Workout.id)
        .options(
            selectinload(Exercise.exercise_sets.and_(ExerciseSet.deleted_at.is_(None)))
        )
        .where(
            Exercise.exercise_type_id == exercise_type_id,
            Exercise.deleted_at.is_(None),
            Workout.owner_id == user_id,
        )
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


async def soft_delete_exercise(session: AsyncSession, exercise_id: int) -> bool:
    """Soft delete an exercise and all its exercise sets by setting deleted_at timestamp"""
    exercise = await get_exercise_by_id(session, exercise_id)
    if not exercise:
        return False

    now = datetime.now(timezone.utc)

    # Soft delete the exercise
    exercise.deleted_at = now

    # Also soft delete all associated exercise sets that haven't been deleted yet
    await session.execute(
        update(ExerciseSet)
        .where(
            ExerciseSet.exercise_id == exercise_id,
            ExerciseSet.deleted_at.is_(None),
        )
        .values(deleted_at=now)
    )

    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    return True


async def get_exercise_owner_id(
    session: AsyncSession, exercise_id: int
) -> Optional[int]:
    """Return the owner_id for the exercise's workout, or None if not found.

    This performs a lightweight join without loading full ORM graphs.
    """
    result = await session.execute(
        select(Workout.owner_id)
        .select_from(Exercise)
        .join(Workout, Exercise.workout_id == Workout.id)
        .where(Exercise.id == exercise_id)
    )
    return result.scalar_one_or_none()


async def verify_exercise_ownership(
    session: AsyncSession, exercise_id: int, user_id: int
) -> Optional[Exercise]:
    """Verify that an exercise belongs to the specified user (excluding soft-deleted)"""
    result = await session.execute(
        select(Exercise)
        .options(selectinload(Exercise.workout))
        .where(Exercise.id == exercise_id, Exercise.deleted_at.is_(None))
    )
    exercise = result.scalar_one_or_none()

    if not exercise or exercise.workout.owner_id != user_id:
        return None

    return exercise
