import logging
from decimal import Decimal
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from opentelemetry import trace
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, delete, desc, or_, select, true, update
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.exc import IntegrityError
from thefuzz import process, fuzz

from src.core.errors import DomainValidationError
from src.core.observability import traced_model_validate
from src.exercises.models import (
    Exercise,
    ExerciseType,
    IntensityUnit,
    Muscle,
    MuscleGroup,
    ExerciseMuscle,
)
from src.exercise_sets.models import ExerciseSet
from src.workouts.models import Workout
from src.exercises.schemas import (
    ExerciseCreate,
    ExerciseTypeCreate,
    PaginatedExerciseTypesResponse,
)
from src.exercises.intensity_units import (
    convert_intensity_value,
    normalize_intensity_for_storage,
)

# Minimum fuzzy-match score that an exercise-type name must reach to be
# considered a match.  Tweaking this value lets us control how permissive the
# search is without hunting through the implementation.
FUZZY_SCORE_CUTOFF = 70  # stricter to reduce loosely related search matches
MAX_FUZZY_SEARCH_RESULTS = 1000
logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)
NON_RELEASED_EXERCISE_TYPE_STATUSES = (
    ExerciseType.ExerciseTypeStatus.candidate,
    ExerciseType.ExerciseTypeStatus.in_review,
)
EXACT_MATCH_STATUS_PRIORITY = {
    ExerciseType.ExerciseTypeStatus.released: 0,
    ExerciseType.ExerciseTypeStatus.in_review: 1,
    ExerciseType.ExerciseTypeStatus.candidate: 2,
}


def _exercise_type_visibility_clause(
    *,
    user_id: Optional[int],
    is_admin: bool,
    released_only: bool = False,
):
    released_clause = ExerciseType.status == ExerciseType.ExerciseTypeStatus.released
    if released_only:
        return released_clause
    if is_admin:
        return true()
    if user_id is None:
        return released_clause
    return or_(
        released_clause,
        and_(
            ExerciseType.owner_id == user_id,
            ExerciseType.status.in_(NON_RELEASED_EXERCISE_TYPE_STATUSES),
        ),
    )


def _normalized_exercise_type_name(name: str) -> str:
    return name.strip().lower()


def _exercise_type_relationship_option():
    return (
        selectinload(ExerciseType.exercise_muscles)
        .selectinload(ExerciseMuscle.muscle)
        .selectinload(Muscle.muscle_group)
    )


def _exact_match_sort_key(
    *,
    status: ExerciseType.ExerciseTypeStatus,
    owner_id: Optional[int],
    updated_at: Optional[datetime],
    exercise_type_id: int,
    user_id: Optional[int],
) -> tuple[int, int, float, int]:
    return (
        EXACT_MATCH_STATUS_PRIORITY.get(status, 99),
        0 if user_id is not None and owner_id == user_id else 1,
        -(updated_at.timestamp() if updated_at is not None else 0.0),
        -exercise_type_id,
    )


def _next_cursor_for_page(offset: int, limit: int, total_results: int) -> Optional[int]:
    return offset + limit if offset + limit < total_results else None


async def _load_muscles_by_ids(
    session: AsyncSession,
    muscle_ids: list[int],
) -> list[Muscle]:
    result = await session.execute(select(Muscle).where(Muscle.id.in_(muscle_ids)))
    muscles = result.scalars().all()
    found_ids = {muscle.id for muscle in muscles}
    missing_ids = set(muscle_ids) - found_ids
    if missing_ids:
        raise ValueError(
            f"Muscle IDs not found: {', '.join(map(str, sorted(missing_ids)))}"
        )
    return muscles


async def _replace_exercise_type_muscles(
    session: AsyncSession,
    exercise_type: ExerciseType,
    muscle_ids: Optional[list[int]],
) -> None:
    if muscle_ids is None:
        return

    await session.execute(
        delete(ExerciseMuscle).where(
            ExerciseMuscle.exercise_type_id == exercise_type.id
        )
    )

    if not muscle_ids:
        return

    muscles = await _load_muscles_by_ids(session, muscle_ids)
    for muscle in muscles:
        session.add(
            ExerciseMuscle(
                exercise_type=exercise_type,
                muscle=muscle,
                is_primary=False,
            )
        )


async def _hydrate_exercise_types_by_ids(
    session: AsyncSession,
    exercise_type_ids: List[int],
    *,
    user_id: Optional[int] = None,
    is_admin: bool = False,
    released_only: bool = False,
) -> List[ExerciseType]:
    if not exercise_type_ids:
        return []

    with tracer.start_as_current_span("exercise_types.search.hydrate_matches") as span:
        span.set_attribute("exercise_types.search.match_count", len(exercise_type_ids))
        result = await session.execute(
            select(ExerciseType)
            .options(_exercise_type_relationship_option())
            .where(
                ExerciseType.id.in_(exercise_type_ids),
                _exercise_type_visibility_clause(
                    user_id=user_id,
                    is_admin=is_admin,
                    released_only=released_only,
                ),
            )
        )
        hydrated_types = result.unique().scalars().all()
        hydrated_by_id = {
            exercise_type.id: exercise_type for exercise_type in hydrated_types
        }
        return [
            hydrated_by_id[exercise_type_id]
            for exercise_type_id in exercise_type_ids
            if exercise_type_id in hydrated_by_id
        ]


def _build_paginated_exercise_types_response(
    *,
    exercise_types: list[ExerciseType],
    next_cursor: Optional[int],
    offset: int,
    limit: int,
    name: Optional[str],
    muscle_group_id: Optional[int],
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
            "query.has_muscle_group_filter": muscle_group_id is not None,
            "query.order_by": order_by,
            "serialization.item_count": len(exercise_types),
        },
    )


def _serialize_numeric(value: Decimal | int | float) -> int | float:
    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)
        return float(value)

    if isinstance(value, int):
        return value

    if value.is_integer():
        return int(value)
    return value


def _get_stats_intensity_value(
    exercise_set: ExerciseSet,
    *,
    intensity_units_by_id: dict[int, IntensityUnit],
    stats_intensity_unit: Optional[IntensityUnit],
) -> Optional[Decimal]:
    canonical_intensity = exercise_set.canonical_intensity
    canonical_unit = intensity_units_by_id.get(exercise_set.canonical_intensity_unit_id)

    if canonical_intensity is None:
        canonical_intensity, canonical_unit_key = normalize_intensity_for_storage(
            exercise_set.intensity,
            exercise_set.intensity_unit,
        )
        canonical_unit = next(
            (
                unit
                for unit in intensity_units_by_id.values()
                if unit.abbreviation.lower() == canonical_unit_key
            ),
            None,
        )

    return convert_intensity_value(
        canonical_intensity,
        canonical_unit,
        stats_intensity_unit,
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


def _exercise_set_sort_key(exercise_set: ExerciseSet) -> tuple[datetime, int]:
    created_at = exercise_set.created_at or datetime.min.replace(tzinfo=timezone.utc)
    return (created_at, exercise_set.id)


def _sort_loaded_exercise_sets(exercises: List[Exercise]) -> List[Exercise]:
    for exercise in exercises:
        exercise.exercise_sets = sorted(
            exercise.exercise_sets,
            key=_exercise_set_sort_key,
        )
    return exercises


async def get_exercise_by_id(
    session: AsyncSession, exercise_id: int
) -> Optional[Exercise]:
    """Get an exercise by ID with relationships loaded"""
    result = await session.execute(
        select(Exercise)
        .options(
            joinedload(Exercise.exercise_type)
            .selectinload(ExerciseType.exercise_muscles)
            .joinedload(ExerciseMuscle.muscle)
            .joinedload(Muscle.muscle_group),
            selectinload(
                Exercise.exercise_sets.and_(ExerciseSet.deleted_at.is_(None))
            ).joinedload(ExerciseSet.intensity_unit),
        )
        .where(Exercise.id == exercise_id, Exercise.deleted_at.is_(None))
    )
    exercise = result.scalar_one_or_none()
    if exercise is None:
        return None

    return _sort_loaded_exercise_sets([exercise])[0]


async def get_muscle_groups(session: AsyncSession) -> List[MuscleGroup]:
    """Get all muscle groups ordered alphabetically."""
    result = await session.execute(select(MuscleGroup).order_by(MuscleGroup.name))
    return result.scalars().all()


async def get_exercises_for_workout(
    session: AsyncSession, workout_id: int
) -> List[Exercise]:
    """Get all exercises for a specific workout (excluding soft-deleted sets)"""
    result = await session.execute(
        select(Exercise)
        .options(
            joinedload(Exercise.exercise_type)
            .selectinload(ExerciseType.exercise_muscles)
            .joinedload(ExerciseMuscle.muscle)
            .joinedload(Muscle.muscle_group),
            selectinload(
                Exercise.exercise_sets.and_(ExerciseSet.deleted_at.is_(None))
            ).joinedload(ExerciseSet.intensity_unit),
        )
        .where(Exercise.workout_id == workout_id, Exercise.deleted_at.is_(None))
        .order_by(Exercise.id.asc())
    )
    return _sort_loaded_exercise_sets(result.scalars().all())


async def create_exercise(
    session: AsyncSession,
    exercise_create: ExerciseCreate,
    *,
    user_id: Optional[int] = None,
    is_admin: bool = False,
) -> Exercise:
    """Create a new exercise"""
    if user_id is not None:
        visible_exercise_type = await get_exercise_type_by_id(
            session,
            exercise_create.exercise_type_id,
            user_id=user_id,
            is_admin=is_admin,
        )
        if visible_exercise_type is None:
            raise DomainValidationError.invalid_reference(field="exercise_type_id")

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
            joinedload(Exercise.exercise_type)
            .selectinload(ExerciseType.exercise_muscles)
            .joinedload(ExerciseMuscle.muscle)
            .joinedload(Muscle.muscle_group),
            selectinload(
                Exercise.exercise_sets.and_(ExerciseSet.deleted_at.is_(None))
            ).joinedload(ExerciseSet.intensity_unit),
        )
        .where(Exercise.id == exercise.id)
    )
    return result.scalar_one()


# Exercise Type CRUD operations
async def get_exercise_types(
    session: AsyncSession,
    name: Optional[str] = None,
    muscle_group_id: Optional[int] = None,
    order_by: str = "usage",
    offset: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    is_admin: bool = False,
    released_only: bool = False,
) -> PaginatedExerciseTypesResponse:
    """Get all exercise types with optional filtering, ordering and pagination"""
    visibility_clause = _exercise_type_visibility_clause(
        user_id=user_id,
        is_admin=is_admin,
        released_only=released_only,
    )
    query = (
        select(ExerciseType)
        .options(_exercise_type_relationship_option())
        .where(visibility_clause)
    )
    if muscle_group_id is not None:
        query = query.where(
            ExerciseType.exercise_muscles.any(
                ExerciseMuscle.muscle.has(Muscle.muscle_group_id == muscle_group_id)
            )
        )

    if name:
        with tracer.start_as_current_span(
            "exercises.crud.get_exercise_types.fetch_candidates"
        ) as span:
            span.set_attribute(
                "exercise_types.search.candidate_limit", MAX_FUZZY_SEARCH_RESULTS
            )
            candidate_query = select(
                ExerciseType.id,
                ExerciseType.name,
                ExerciseType.status,
                ExerciseType.owner_id,
                ExerciseType.updated_at,
            ).where(visibility_clause)
            if muscle_group_id is not None:
                candidate_query = candidate_query.where(
                    ExerciseType.exercise_muscles.any(
                        ExerciseMuscle.muscle.has(
                            Muscle.muscle_group_id == muscle_group_id
                        )
                    )
                )
            result = await session.execute(
                candidate_query.limit(MAX_FUZZY_SEARCH_RESULTS)
            )
            candidate_rows = result.all()
            span.set_attribute(
                "exercise_types.search.candidate_count", len(candidate_rows)
            )

        # Quick path: exact (case-insensitive) name match for determinism
        exact_match_ids = [
            exercise_type_id
            for (
                exercise_type_id,
                candidate_name,
                candidate_status,
                candidate_owner_id,
                candidate_updated_at,
            ) in sorted(
                (
                    row
                    for row in candidate_rows
                    if row[1] and row[1].lower() == name.lower()
                ),
                key=lambda row: _exact_match_sort_key(
                    status=row[2],
                    owner_id=row[3],
                    updated_at=row[4],
                    exercise_type_id=row[0],
                    user_id=user_id,
                ),
            )
        ]
        if exact_match_ids:
            total_results = len(exact_match_ids)
            paged_exact_match_ids = exact_match_ids[offset : offset + limit]
            exercise_types = await _hydrate_exercise_types_by_ids(
                session,
                paged_exact_match_ids,
                user_id=user_id,
                is_admin=is_admin,
                released_only=released_only,
            )
            next_cursor = _next_cursor_for_page(offset, limit, total_results)
            return _build_paginated_exercise_types_response(
                exercise_types=exercise_types,
                next_cursor=next_cursor,
                offset=offset,
                limit=limit,
                name=name,
                muscle_group_id=muscle_group_id,
                order_by=order_by,
            )

        # Filter out None/empty names to avoid TypeError from thefuzz
        valid_candidates = [
            (exercise_type_id, candidate_name)
            for (
                exercise_type_id,
                candidate_name,
                _candidate_status,
                _candidate_owner_id,
                _candidate_updated_at,
            ) in candidate_rows
            if isinstance(candidate_name, str) and candidate_name.strip()
        ]

        # Use name->id mapping and pass only names to thefuzz to avoid tuple-order
        # differences across versions when passing a dict. Map back to ids afterward.
        name_to_id = {
            str(candidate_name): exercise_type_id
            for exercise_type_id, candidate_name in valid_candidates
        }
        candidate_names = list(name_to_id.keys())

        with tracer.start_as_current_span(
            "exercises.crud.get_exercise_types.fuzzy_matching"
        ) as span:
            span.set_attribute(
                "exercise_types.search.valid_candidate_count", len(candidate_names)
            )
            matches = process.extractBests(
                name,
                candidate_names,
                scorer=fuzz.WRatio,  # Using WRatio for better overall matching
                score_cutoff=FUZZY_SCORE_CUTOFF,
                limit=min(
                    limit * 3, 100
                ),  # Get more candidates than needed, but cap at 100
            )
            span.set_attribute("exercise_types.search.match_count", len(matches))
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

            # Simple sort key function that prioritizes:
            # 1. Starts with query (case-insensitive)
            # 2. Contains query (case-insensitive)
            # 3. Higher fuzzy score
            # 4. Alphabetical for deterministic order
            query_lower = name.lower()

            def _sort_key(t):
                name_lower = t[1].lower()
                starts_with = 0 if name_lower.startswith(query_lower) else 1
                contains = 0 if query_lower in name_lower else 1
                return (starts_with, contains, -score_lookup[t[0]], name_lower)

            sorted_matches = sorted(
                (
                    (matched_id, candidate_name)
                    for candidate_name, matched_id in name_to_id.items()
                    if matched_id in score_lookup
                ),
                key=_sort_key,
            )
            matched_ids = [matched_id for matched_id, _ in sorted_matches]

            # Apply pagination
            total_results = len(matched_ids)
            paged_matched_ids = matched_ids[offset : offset + limit]
            exercise_types = await _hydrate_exercise_types_by_ids(
                session,
                paged_matched_ids,
                user_id=user_id,
                is_admin=is_admin,
                released_only=released_only,
            )
            next_cursor = _next_cursor_for_page(offset, limit, total_results)
        else:
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
        exercise_types = result.unique().scalars().all()
        next_cursor = offset + limit if len(exercise_types) == limit else None

    return _build_paginated_exercise_types_response(
        exercise_types=exercise_types,
        next_cursor=next_cursor,
        offset=offset,
        limit=limit,
        name=name,
        muscle_group_id=muscle_group_id,
        order_by=order_by,
    )


async def get_exercise_type_by_id(
    session: AsyncSession,
    exercise_type_id: int,
    *,
    user_id: Optional[int] = None,
    is_admin: bool = False,
    released_only: bool = False,
) -> Optional[ExerciseType]:
    """Get an exercise type by ID with relationships loaded"""
    result = await session.execute(
        select(ExerciseType)
        .options(
            joinedload(ExerciseType.exercise_muscles)
            .joinedload(ExerciseMuscle.muscle)
            .joinedload(Muscle.muscle_group)
        )
        .where(
            ExerciseType.id == exercise_type_id,
            _exercise_type_visibility_clause(
                user_id=user_id,
                is_admin=is_admin,
                released_only=released_only,
            ),
        )
    )
    return result.unique().scalar_one_or_none()


async def create_exercise_type(
    session: AsyncSession,
    exercise_type_create: ExerciseTypeCreate,
    *,
    owner_id: Optional[int] = None,
    status: Optional[ExerciseType.ExerciseTypeStatus] = None,
) -> ExerciseType:
    """Create a new exercise type"""
    resolved_status = status or (
        ExerciseType.ExerciseTypeStatus.candidate
        if owner_id is not None
        else ExerciseType.ExerciseTypeStatus.released
    )
    now = datetime.now(timezone.utc)
    exercise_type: Optional[ExerciseType] = None

    try:
        # Create base ExerciseType instance
        exercise_type = ExerciseType(
            name=exercise_type_create.name,
            description=exercise_type_create.description,
            default_intensity_unit=exercise_type_create.default_intensity_unit,
            owner_id=owner_id,
            status=resolved_status,
            instructions=exercise_type_create.instructions,
            equipment=exercise_type_create.equipment,
            category=exercise_type_create.category,
            released_at=(
                now
                if resolved_status == ExerciseType.ExerciseTypeStatus.released
                else None
            ),
        )
        session.add(exercise_type)
        await session.flush()

        # If muscle IDs were provided, fetch and associate them
        await _replace_exercise_type_muscles(
            session,
            exercise_type,
            exercise_type_create.muscle_ids,
        )
        await session.commit()
        await session.refresh(exercise_type)

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
        return result.unique().scalar_one()
    except IntegrityError:
        await session.rollback()
        duplicate_query = select(ExerciseType).where(
            ExerciseType.name.ilike(exercise_type_create.name)
        )
        if (
            owner_id is not None
            and resolved_status in NON_RELEASED_EXERCISE_TYPE_STATUSES
        ):
            duplicate_query = duplicate_query.where(
                ExerciseType.owner_id == owner_id,
                ExerciseType.status.in_(NON_RELEASED_EXERCISE_TYPE_STATUSES),
            )
        elif resolved_status == ExerciseType.ExerciseTypeStatus.released:
            duplicate_query = duplicate_query.where(
                ExerciseType.status == ExerciseType.ExerciseTypeStatus.released
            )

        dup = await session.execute(duplicate_query)
        existing = dup.unique().scalar_one_or_none()
        if existing is None:
            raise

        result = await session.execute(
            select(ExerciseType)
            .options(_exercise_type_relationship_option())
            .where(ExerciseType.id == existing.id)
        )
        return result.unique().scalar_one()


async def update_exercise_type(
    session: AsyncSession,
    exercise_type: ExerciseType,
    exercise_type_update,
) -> ExerciseType:
    """Update an existing exercise type and reload relationships."""
    update_data = exercise_type_update.model_dump(exclude_unset=True)
    muscle_ids = update_data.pop("muscle_ids", None)

    for field, value in update_data.items():
        setattr(exercise_type, field, value)

    await _replace_exercise_type_muscles(session, exercise_type, muscle_ids)

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise

    result = await session.execute(
        select(ExerciseType)
        .options(_exercise_type_relationship_option())
        .where(ExerciseType.id == exercise_type.id)
    )
    return result.unique().scalar_one()


async def request_exercise_type_evaluation(
    session: AsyncSession,
    exercise_type: ExerciseType,
) -> ExerciseType:
    exercise_type.status = ExerciseType.ExerciseTypeStatus.in_review
    exercise_type.review_requested_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(exercise_type)
    return await get_exercise_type_by_id(
        session,
        exercise_type.id,
        user_id=exercise_type.owner_id,
    )


async def get_exercise_type_review_queue(session: AsyncSession) -> list[ExerciseType]:
    result = await session.execute(
        select(ExerciseType)
        .options(_exercise_type_relationship_option())
        .where(ExerciseType.status == ExerciseType.ExerciseTypeStatus.in_review)
        .order_by(desc(ExerciseType.review_requested_at), ExerciseType.id.desc())
    )
    return result.unique().scalars().all()


async def release_exercise_type(
    session: AsyncSession,
    exercise_type: ExerciseType,
    *,
    reviewer_id: int,
    review_notes: Optional[str] = None,
) -> ExerciseType:
    now = datetime.now(timezone.utc)
    exercise_type.status = ExerciseType.ExerciseTypeStatus.released
    exercise_type.released_at = exercise_type.released_at or now
    exercise_type.reviewed_by = reviewer_id
    exercise_type.review_notes = review_notes

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise

    return await get_exercise_type_by_id(
        session,
        exercise_type.id,
        is_admin=True,
    )


# Intensity Unit CRUD operations
async def get_intensity_units(session: AsyncSession) -> List[IntensityUnit]:
    """Get all intensity units"""
    result = await session.execute(select(IntensityUnit))
    return result.unique().scalars().all()


async def get_muscles(session: AsyncSession) -> List[Muscle]:
    """Get all muscles ordered for taxonomy pickers."""
    result = await session.execute(
        select(Muscle)
        .options(joinedload(Muscle.muscle_group))
        .join(Muscle.muscle_group)
        .order_by(MuscleGroup.name.asc(), Muscle.name.asc())
    )
    return result.unique().scalars().all()


async def get_visible_exercise_type_ids(
    session: AsyncSession,
    exercise_type_ids: list[int],
    *,
    user_id: Optional[int],
    is_admin: bool = False,
    released_only: bool = False,
) -> set[int]:
    if not exercise_type_ids:
        return set()

    result = await session.execute(
        select(ExerciseType.id).where(
            ExerciseType.id.in_(exercise_type_ids),
            _exercise_type_visibility_clause(
                user_id=user_id,
                is_admin=is_admin,
                released_only=released_only,
            ),
        )
    )
    return set(result.scalars().all())


async def get_exercise_type_stats(
    session: AsyncSession, exercise_type_id: int, user_id: int
) -> Dict[str, Any]:
    """Get exercise type statistics with optimized database queries"""

    # Get the exercise type first to get the default intensity unit
    exercise_type = await get_exercise_type_by_id(
        session,
        exercise_type_id,
        user_id=user_id,
    )
    if not exercise_type:
        return {
            "progressiveOverload": [],
            "lastWorkout": None,
            "personalBest": None,
            "totalSets": 0,
            "intensityUnit": None,
        }

    intensity_units_result = await session.execute(select(IntensityUnit))
    intensity_units = intensity_units_result.scalars().all()
    intensity_units_by_id = {unit.id: unit for unit in intensity_units}

    stats_intensity_unit = intensity_units_by_id.get(
        exercise_type.default_intensity_unit
    )

    # For now, use a hybrid approach - fetch exercises but use some optimized queries
    exercises_result = await session.execute(
        select(Exercise)
        .join(Workout, Exercise.workout_id == Workout.id)
        .options(
            selectinload(
                Exercise.exercise_sets.and_(ExerciseSet.deleted_at.is_(None))
            ).selectinload(ExerciseSet.intensity_unit)
        )
        .where(
            Exercise.exercise_type_id == exercise_type_id,
            Exercise.deleted_at.is_(None),
            Workout.owner_id == user_id,
        )
        .order_by(Exercise.created_at.desc())
    )
    exercises = exercises_result.unique().scalars().all()

    if not exercises:
        return {
            "progressiveOverload": [],
            "lastWorkout": None,
            "personalBest": None,
            "totalSets": 0,
            "intensityUnit": {
                "id": stats_intensity_unit.id,
                "name": stats_intensity_unit.name,
                "abbreviation": stats_intensity_unit.abbreviation,
            }
            if stats_intensity_unit
            else None,
        }

    if stats_intensity_unit is None:
        first_set_with_unit = next(
            (
                exercise_set
                for exercise in exercises
                for exercise_set in exercise.exercise_sets
                if exercise_set.intensity_unit is not None
            ),
            None,
        )
        if first_set_with_unit is not None:
            stats_intensity_unit = first_set_with_unit.intensity_unit

    # Calculate progressive overload data (grouped by date)
    progressive_overload = []
    date_groups = {}

    for exercise in exercises:
        date = exercise.created_at.date()
        if date not in date_groups:
            date_groups[date] = {
                "maxWeight": Decimal("0"),
                "totalVolume": Decimal("0"),
                "totalReps": 0,
            }

        for exercise_set in exercise.exercise_sets:
            converted_intensity = _get_stats_intensity_value(
                exercise_set,
                intensity_units_by_id=intensity_units_by_id,
                stats_intensity_unit=stats_intensity_unit,
            )
            if converted_intensity:
                date_groups[date]["maxWeight"] = max(
                    date_groups[date]["maxWeight"], converted_intensity
                )
                if exercise_set.reps:
                    date_groups[date]["totalVolume"] += (
                        converted_intensity * exercise_set.reps
                    )
                    date_groups[date]["totalReps"] += exercise_set.reps

    for date, data in sorted(date_groups.items()):
        progressive_overload.append(
            {
                "date": date.isoformat(),
                "maxWeight": _serialize_numeric(data["maxWeight"]),
                "totalVolume": _serialize_numeric(data["totalVolume"]),
                "reps": data["totalReps"],
            }
        )

    last_exercise = exercises[0] if exercises else None
    last_workout = None
    if last_exercise:
        sets_count = len(last_exercise.exercise_sets)
        total_reps = sum(s.reps or 0 for s in last_exercise.exercise_sets)
        max_weight = max(
            (
                _get_stats_intensity_value(
                    s,
                    intensity_units_by_id=intensity_units_by_id,
                    stats_intensity_unit=stats_intensity_unit,
                )
                or Decimal("0")
                for s in last_exercise.exercise_sets
            ),
            default=Decimal("0"),
        )
        total_volume = sum(
            (
                (
                    (
                        _get_stats_intensity_value(
                            s,
                            intensity_units_by_id=intensity_units_by_id,
                            stats_intensity_unit=stats_intensity_unit,
                        )
                        or Decimal("0")
                    )
                    * (s.reps or 0)
                )
                for s in last_exercise.exercise_sets
            ),
            Decimal("0"),
        )

        last_workout = {
            "date": last_exercise.created_at.isoformat(),
            "sets": sets_count,
            "totalReps": total_reps,
            "maxWeight": _serialize_numeric(max_weight),
            "totalVolume": _serialize_numeric(total_volume),
        }

    # Get personal best (highest weight for single rep)
    personal_best = None
    best_weight = Decimal("0")
    best_set = None
    best_exercise = None

    for exercise in exercises:
        for exercise_set in exercise.exercise_sets:
            converted_intensity = _get_stats_intensity_value(
                exercise_set,
                intensity_units_by_id=intensity_units_by_id,
                stats_intensity_unit=stats_intensity_unit,
            )
            if converted_intensity and converted_intensity > best_weight:
                best_weight = converted_intensity
                best_set = exercise_set
                best_exercise = exercise

    if best_set:
        converted_best_intensity = _get_stats_intensity_value(
            best_set,
            intensity_units_by_id=intensity_units_by_id,
            stats_intensity_unit=stats_intensity_unit,
        ) or Decimal("0")
        volume = converted_best_intensity * (best_set.reps or 0)
        personal_best = {
            "date": best_exercise.created_at.isoformat(),
            "weight": _serialize_numeric(converted_best_intensity),
            "reps": best_set.reps or 0,
            "volume": _serialize_numeric(volume),
        }

    # Calculate total sets across all exercises
    total_sets = sum(len(exercise.exercise_sets) for exercise in exercises)

    return {
        "progressiveOverload": progressive_overload,
        "lastWorkout": last_workout,
        "personalBest": personal_best,
        "totalSets": total_sets,
        "intensityUnit": {
            "id": stats_intensity_unit.id,
            "name": stats_intensity_unit.name,
            "abbreviation": stats_intensity_unit.abbreviation,
        }
        if stats_intensity_unit
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
    exercise = result.unique().scalar_one_or_none()

    if not exercise or exercise.workout.owner_id != user_id:
        return None

    return exercise
