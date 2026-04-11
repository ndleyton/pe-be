from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from src.core.errors import DomainValidationError
from src.exercises.intensity_units import normalize_intensity_for_storage
from src.exercises.models import IntensityUnit
from src.routines.models import Routine, ExerciseTemplate, SetTemplate
from src.exercises.models import ExerciseType
from src.routines.schemas import (
    AdminRoutineCreate,
    RoutineCreate,
    RoutineUpdate,
)


def _routine_detail_query(*, populate_existing: bool = False):
    query = select(Routine).options(
        selectinload(Routine.exercise_templates)
        .selectinload(ExerciseTemplate.set_templates)
        .selectinload(SetTemplate.intensity_unit),
        selectinload(Routine.exercise_templates).selectinload(
            ExerciseTemplate.exercise_type
        ),
        selectinload(Routine.workout_type),
    )
    if populate_existing:
        query = query.execution_options(populate_existing=True)
    return query


def _get_constraint_name(error: IntegrityError) -> Optional[str]:
    if error.orig is None:
        return None

    diag = getattr(error.orig, "diag", None)
    if diag is not None:
        constraint_name = getattr(diag, "constraint_name", None)
        if constraint_name:
            return constraint_name

    return getattr(error.orig, "constraint_name", None)


def _map_routine_integrity_error(
    error: IntegrityError,
) -> Optional[DomainValidationError]:
    constraint_name = _get_constraint_name(error)
    error_message = str(error.orig) if error.orig is not None else str(error)
    lowered = error_message.lower()

    if (
        constraint_name == "fk_recipes_workout_type_id_workout_types"
        or constraint_name == "recipes_workout_type_id_fkey"
        or ("workout_type_id" in error_message and "foreign key constraint" in lowered)
    ):
        return DomainValidationError.invalid_reference(field="workout_type_id")

    if (
        constraint_name == "fk_exercise_templates_exercise_type_id_exercise_types"
        or constraint_name == "exercise_templates_exercise_type_id_fkey"
        or ("exercise_type_id" in error_message and "foreign key constraint" in lowered)
    ):
        return DomainValidationError.invalid_reference(
            field="exercise_templates.exercise_type_id"
        )

    if (
        constraint_name == "fk_set_templates_intensity_unit_id_intensity_units"
        or constraint_name == "set_templates_intensity_unit_id_fkey"
        or (
            "intensity_unit_id" in error_message and "foreign key constraint" in lowered
        )
    ):
        return DomainValidationError.invalid_reference(
            field="exercise_templates.set_templates.intensity_unit_id"
        )

    return None


async def get_routine_by_id_for_user(
    session: AsyncSession, routine_id: int, user_id: int
) -> Optional[Routine]:
    """Get a routine by ID with relationships loaded.

    Accessible when owned by the user OR marked public/link_only.
    """
    result = await session.execute(
        _routine_detail_query().where(
            and_(
                Routine.id == routine_id,
                or_(
                    Routine.creator_id == user_id,
                    Routine.visibility == Routine.RoutineVisibility.public,
                    Routine.visibility == Routine.RoutineVisibility.link_only,
                ),
            )
        )
    )
    return result.scalar_one_or_none()


async def get_user_routine_by_id(
    session: AsyncSession,
    routine_id: int,
    user_id: int,
    populate_existing: bool = False,
) -> Optional[Routine]:
    """Get a routine by ID with relationships loaded (user-owned only)."""
    query = _routine_detail_query(populate_existing=populate_existing).where(
        and_(Routine.id == routine_id, Routine.creator_id == user_id)
    )

    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_any_routine_by_id(
    session: AsyncSession, routine_id: int, populate_existing: bool = False
) -> Optional[Routine]:
    """Get any routine by ID with relationships loaded."""
    result = await session.execute(
        _routine_detail_query(populate_existing=populate_existing).where(
            Routine.id == routine_id
        )
    )
    return result.scalar_one_or_none()


async def get_public_routine_by_id(
    session: AsyncSession, routine_id: int, populate_existing: bool = False
) -> Optional[Routine]:
    """Get a shareable (public/link_only) routine by ID with relationships loaded."""
    result = await session.execute(
        _routine_detail_query(populate_existing=populate_existing).where(
            Routine.id == routine_id,
            or_(
                Routine.visibility == Routine.RoutineVisibility.public,
                Routine.visibility == Routine.RoutineVisibility.link_only,
            ),
        )
    )
    return result.scalar_one_or_none()


def _apply_visibility_filter(query, user_id: int | None):
    if user_id is None:
        return query.where(Routine.visibility == Routine.RoutineVisibility.public)
    return query.where(
        or_(
            Routine.creator_id == user_id,
            Routine.visibility == Routine.RoutineVisibility.public,
        )
    )


async def _fetch_routine_counts(session: AsyncSession, routine_ids: List[int]) -> dict:
    count_query = (
        select(
            ExerciseTemplate.routine_id,
            func.count(ExerciseTemplate.id.distinct()).label("exercise_count"),
            func.count(SetTemplate.id).label("set_count"),
        )
        .outerjoin(SetTemplate, ExerciseTemplate.id == SetTemplate.exercise_template_id)
        .where(ExerciseTemplate.routine_id.in_(routine_ids))
        .group_by(ExerciseTemplate.routine_id)
    )
    count_result = await session.execute(count_query)
    return {
        row.routine_id: {
            "exercise_count": row.exercise_count,
            "set_count": row.set_count,
        }
        for row in count_result.all()
    }


async def _fetch_routine_previews(
    session: AsyncSession, routine_ids: List[int], limit: int = 5
) -> dict:
    preview_ranked = (
        select(
            ExerciseTemplate.routine_id.label("routine_id"),
            ExerciseTemplate.exercise_type_id.label("exercise_type_id"),
            func.row_number()
            .over(
                partition_by=ExerciseTemplate.routine_id,
                order_by=ExerciseTemplate.id,
            )
            .label("preview_rank"),
        )
        .where(ExerciseTemplate.routine_id.in_(routine_ids))
        .subquery()
    )
    preview_query = (
        select(preview_ranked.c.routine_id, ExerciseType.name)
        .join(ExerciseType, preview_ranked.c.exercise_type_id == ExerciseType.id)
        .where(preview_ranked.c.preview_rank <= limit)
        .order_by(preview_ranked.c.routine_id, preview_ranked.c.preview_rank)
    )
    preview_result = await session.execute(preview_query)
    previews = {}
    for row in preview_result.all():
        if row.routine_id not in previews:
            previews[row.routine_id] = []
        previews[row.routine_id].append(row.name)
    return previews


async def get_visible_routines(
    session: AsyncSession,
    user_id: int | None,
    offset: int = 0,
    limit: int = 100,
) -> List[Routine]:
    """Get routines visible to the current viewer with pagination."""
    query = (
        _routine_detail_query()
        .order_by(Routine.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    query = _apply_visibility_filter(query, user_id)

    result = await session.execute(query)
    return result.scalars().all()


async def get_visible_routines_summary(
    session: AsyncSession,
    user_id: int | None,
    offset: int = 0,
    limit: int = 100,
    order_by: str = "createdAt",
) -> List[dict]:
    """Get routines visible to the current viewer as summary dictionaries mapped to RoutineSummary."""
    from src.core.observability import traced_span

    with traced_span("routine.list.sql_phase") as span:
        # 1. Base query for routines
        query = select(Routine)
        query = _apply_visibility_filter(query, user_id)

        # Ordering
        if order_by == "name":
            query = query.order_by(Routine.name.asc(), Routine.id.asc())
        elif order_by == "updatedAt":
            query = query.order_by(Routine.updated_at.desc(), Routine.id.asc())
        else:
            # Default to createdAt
            query = query.order_by(Routine.created_at.desc(), Routine.id.asc())

        query = query.offset(offset).limit(limit)

        result = await session.execute(query)
        routines = result.scalars().all()

        if not routines:
            span.set_attribute("routine.list.row_count", 0)
            return []

        span.set_attribute("routine.list.row_count", len(routines))
        routine_ids = [r.id for r in routines]

        # 2. Aggregations and Previews
        counts_by_routine = await _fetch_routine_counts(session, routine_ids)
        previews_by_routine = await _fetch_routine_previews(session, routine_ids)

        # 3. Final Assembly
        total_exercises = 0
        total_sets = 0
        summary_list = []
        for r in routines:
            counts = counts_by_routine.get(r.id, {"exercise_count": 0, "set_count": 0})
            previews = previews_by_routine.get(r.id, [])
            total_exercises += counts["exercise_count"]
            total_sets += counts["set_count"]

            summary_list.append(
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "workout_type_id": r.workout_type_id,
                    "creator_id": r.creator_id,
                    "visibility": r.visibility,
                    "is_readonly": r.is_readonly,
                    "created_at": r.created_at,
                    "updated_at": r.updated_at,
                    "exercise_count": counts["exercise_count"],
                    "set_count": counts["set_count"],
                    "exercise_names_preview": previews,
                }
            )

        span.set_attribute("routine.list.exercise_count_total", total_exercises)
        span.set_attribute("routine.list.set_count_total", total_sets)

        return summary_list


async def create_routine(
    session: AsyncSession, routine_data: RoutineCreate, user_id: int
) -> Routine:
    """Create a new routine with exercise and set templates."""
    try:
        routine = Routine(
            name=routine_data.name,
            description=routine_data.description,
            workout_type_id=routine_data.workout_type_id,
            creator_id=user_id,
        )
        session.add(routine)
        await session.flush()  # Get the backing recipe ID

        # Create exercise templates
        for exercise_template_data in routine_data.exercise_templates:
            exercise_template = ExerciseTemplate(
                exercise_type_id=exercise_template_data.exercise_type_id,
                notes=exercise_template_data.notes,
                routine_id=routine.id,
            )
            session.add(exercise_template)
            await session.flush()  # Get the exercise template ID

            # Create set templates
            for set_template_data in exercise_template_data.set_templates:
                source_unit = await session.get(
                    IntensityUnit,
                    set_template_data.intensity_unit_id,
                )
                canonical_intensity, canonical_unit_key = (
                    normalize_intensity_for_storage(
                        set_template_data.intensity,
                        source_unit,
                    )
                )
                canonical_intensity_unit_id = set_template_data.intensity_unit_id
                if canonical_unit_key is not None:
                    canonical_unit = await session.execute(
                        select(IntensityUnit).where(
                            IntensityUnit.abbreviation.ilike(canonical_unit_key)
                        )
                    )
                    canonical_intensity_unit_id = (
                        canonical_unit.scalar_one_or_none() or source_unit
                    ).id
                set_template = SetTemplate(
                    reps=set_template_data.reps,
                    duration_seconds=set_template_data.duration_seconds,
                    intensity=set_template_data.intensity,
                    rpe=set_template_data.rpe,
                    canonical_intensity=canonical_intensity,
                    intensity_unit_id=set_template_data.intensity_unit_id,
                    canonical_intensity_unit_id=canonical_intensity_unit_id,
                    exercise_template_id=exercise_template.id,
                )
                session.add(set_template)

        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        mapped_error = _map_routine_integrity_error(e)
        if mapped_error:
            raise mapped_error from e
        raise
    await session.refresh(routine)

    # Return the routine with all relationships loaded
    return await get_user_routine_by_id(session, routine.id, user_id)


async def create_routine_admin(
    session: AsyncSession, routine_data: AdminRoutineCreate, user_id: int
) -> Routine:
    """Create a new routine with admin controls for visibility and read-only.

    Mirrors create_routine but allows setting `visibility` and `is_readonly`.
    """
    # Base fields
    new_routine_kwargs = {
        "name": routine_data.name,
        "description": routine_data.description,
        "workout_type_id": routine_data.workout_type_id,
        "creator_id": user_id,
    }

    # Optional admin-only fields
    if routine_data.visibility is not None:
        new_routine_kwargs["visibility"] = Routine.RoutineVisibility(
            routine_data.visibility.value
        )
    if routine_data.is_readonly is not None:
        new_routine_kwargs["is_readonly"] = routine_data.is_readonly

    try:
        routine = Routine(**new_routine_kwargs)
        session.add(routine)
        await session.flush()  # Get the backing recipe ID

        # Create exercise templates
        for exercise_template_data in routine_data.exercise_templates:
            exercise_template = ExerciseTemplate(
                exercise_type_id=exercise_template_data.exercise_type_id,
                notes=exercise_template_data.notes,
                routine_id=routine.id,
            )
            session.add(exercise_template)
            await session.flush()  # Get the exercise template ID

            # Create set templates
            for set_template_data in exercise_template_data.set_templates:
                source_unit = await session.get(
                    IntensityUnit,
                    set_template_data.intensity_unit_id,
                )
                canonical_intensity, canonical_unit_key = (
                    normalize_intensity_for_storage(
                        set_template_data.intensity,
                        source_unit,
                    )
                )
                canonical_intensity_unit_id = set_template_data.intensity_unit_id
                if canonical_unit_key is not None:
                    canonical_unit = await session.execute(
                        select(IntensityUnit).where(
                            IntensityUnit.abbreviation.ilike(canonical_unit_key)
                        )
                    )
                    canonical_intensity_unit_id = (
                        canonical_unit.scalar_one_or_none() or source_unit
                    ).id
                set_template = SetTemplate(
                    reps=set_template_data.reps,
                    duration_seconds=set_template_data.duration_seconds,
                    intensity=set_template_data.intensity,
                    rpe=set_template_data.rpe,
                    canonical_intensity=canonical_intensity,
                    intensity_unit_id=set_template_data.intensity_unit_id,
                    canonical_intensity_unit_id=canonical_intensity_unit_id,
                    exercise_template_id=exercise_template.id,
                )
                session.add(set_template)

        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        mapped_error = _map_routine_integrity_error(e)
        if mapped_error:
            raise mapped_error from e
        raise
    await session.refresh(routine)

    # Return with relationships loaded
    return await get_user_routine_by_id(session, routine.id, user_id)


async def update_routine(
    session: AsyncSession,
    routine_id: int,
    routine_data: RoutineUpdate,
    user_id: int,
    is_superuser: bool = False,
) -> Optional[Routine]:
    """Update a routine.

    When `exercise_templates` is provided, the existing nested template tree is
    replaced transactionally using the submitted payload.
    """
    routine = await (
        get_any_routine_by_id(session, routine_id)
        if is_superuser
        else get_user_routine_by_id(session, routine_id, user_id)
    )
    if not routine:
        return None

    # Update fields if provided
    if routine_data.name is not None:
        routine.name = routine_data.name
    if routine_data.description is not None:
        routine.description = routine_data.description
    if routine_data.workout_type_id is not None:
        routine.workout_type_id = routine_data.workout_type_id
    if routine_data.visibility is not None:
        routine.visibility = routine_data.visibility

    if routine_data.exercise_templates is not None:
        # Full-replace semantics for nested templates on update.
        for existing_template in list(routine.exercise_templates):
            await session.delete(existing_template)
        await session.flush()

        for exercise_template_data in routine_data.exercise_templates:
            exercise_template = ExerciseTemplate(
                exercise_type_id=exercise_template_data.exercise_type_id,
                notes=exercise_template_data.notes,
                routine_id=routine.id,
            )
            session.add(exercise_template)
            await session.flush()

            for set_template_data in exercise_template_data.set_templates:
                source_unit = await session.get(
                    IntensityUnit,
                    set_template_data.intensity_unit_id,
                )
                canonical_intensity, canonical_unit_key = (
                    normalize_intensity_for_storage(
                        set_template_data.intensity,
                        source_unit,
                    )
                )
                canonical_intensity_unit_id = set_template_data.intensity_unit_id
                if canonical_unit_key is not None:
                    canonical_unit = await session.execute(
                        select(IntensityUnit).where(
                            IntensityUnit.abbreviation.ilike(canonical_unit_key)
                        )
                    )
                    canonical_intensity_unit_id = (
                        canonical_unit.scalar_one_or_none() or source_unit
                    ).id
                set_template = SetTemplate(
                    reps=set_template_data.reps,
                    duration_seconds=set_template_data.duration_seconds,
                    intensity=set_template_data.intensity,
                    rpe=set_template_data.rpe,
                    canonical_intensity=canonical_intensity,
                    intensity_unit_id=set_template_data.intensity_unit_id,
                    canonical_intensity_unit_id=canonical_intensity_unit_id,
                    exercise_template_id=exercise_template.id,
                )
                session.add(set_template)

    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        mapped_error = _map_routine_integrity_error(e)
        if mapped_error:
            raise mapped_error from e
        raise

    # Reload the full tree eagerly so response serialization does not trigger
    # async lazy loads for nested templates after the replace operation.
    return await (
        get_any_routine_by_id(session, routine.id, populate_existing=True)
        if is_superuser
        else get_user_routine_by_id(
            session, routine.id, user_id, populate_existing=True
        )
    )


async def delete_routine(
    session: AsyncSession, routine_id: int, user_id: int, is_superuser: bool = False
) -> bool:
    """Delete a routine (user-owned only unless performed by a superuser)."""
    routine = await (
        get_any_routine_by_id(session, routine_id)
        if is_superuser
        else get_user_routine_by_id(session, routine_id, user_id)
    )
    if not routine:
        return False

    await session.delete(routine)
    await session.commit()
    return True
