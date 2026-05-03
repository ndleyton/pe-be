from collections.abc import Sequence
from typing import Optional

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.errors import DomainValidationError
from src.exercises.intensity_units import normalize_intensity_for_storage
from src.exercises.models import ExerciseType, IntensityUnit
from src.routine_programs.models import RoutineProgram, RoutineProgramDay
from src.routine_programs.schemas import (
    AdminRoutineProgramCreate,
    RoutineProgramCreate,
    RoutineProgramDayCreate,
    RoutineProgramUpdate,
)
from src.routines.models import ExerciseTemplate, Routine, SetTemplate


def _program_detail_query(*, populate_existing: bool = False):
    query = select(RoutineProgram).options(
        selectinload(RoutineProgram.days)
        .selectinload(RoutineProgramDay.routine)
        .options(
            selectinload(Routine.exercise_templates).options(
                selectinload(ExerciseTemplate.set_templates).selectinload(
                    SetTemplate.intensity_unit
                ),
                selectinload(ExerciseTemplate.exercise_type),
            )
        )
    )
    if populate_existing:
        query = query.execution_options(populate_existing=True)
    return query


def _apply_visibility_filter(query, user_id: int | None):
    if user_id is None:
        return query.where(
            RoutineProgram.visibility == RoutineProgram.ProgramVisibility.public
        )
    return query.where(
        or_(
            RoutineProgram.creator_id == user_id,
            RoutineProgram.visibility == RoutineProgram.ProgramVisibility.public,
        )
    )


def _apply_direct_read_filter(query, user_id: int | None):
    if user_id is None:
        return query.where(
            or_(
                RoutineProgram.visibility == RoutineProgram.ProgramVisibility.public,
                RoutineProgram.visibility == RoutineProgram.ProgramVisibility.link_only,
            )
        )
    return query.where(
        or_(
            RoutineProgram.creator_id == user_id,
            RoutineProgram.visibility == RoutineProgram.ProgramVisibility.public,
            RoutineProgram.visibility == RoutineProgram.ProgramVisibility.link_only,
        )
    )


def _routine_visible_to_user_clause(user_id: int):
    return or_(
        Routine.creator_id == user_id,
        Routine.visibility == Routine.RoutineVisibility.public,
        Routine.visibility == Routine.RoutineVisibility.link_only,
    )


def _sort_orders_are_unique(days: Sequence[RoutineProgramDayCreate]) -> bool:
    sort_orders = [day.sort_order for day in days]
    return len(sort_orders) == len(set(sort_orders))


def _get_constraint_name(error: IntegrityError) -> Optional[str]:
    if error.orig is None:
        return None

    diag = getattr(error.orig, "diag", None)
    if diag is not None:
        constraint_name = getattr(diag, "constraint_name", None)
        if constraint_name:
            return constraint_name

    return getattr(error.orig, "constraint_name", None)


def _map_program_integrity_error(
    error: IntegrityError,
) -> Optional[DomainValidationError]:
    constraint_name = _get_constraint_name(error)
    error_message = str(error.orig) if error.orig is not None else str(error)
    lowered = error_message.lower()

    if (
        constraint_name == "routine_program_days_routine_id_fkey"
        or ("routine_id" in error_message and "foreign key constraint" in lowered)
    ):
        return DomainValidationError.invalid_reference(field="days.routine_id")

    if (
        constraint_name == "uq_routine_program_days_program_sort"
        or (
            "program_id" in error_message
            and "sort_order" in error_message
            and "unique" in lowered
        )
    ):
        return DomainValidationError.invalid_range(
            message="Program day sort_order values must be unique",
            field="days.sort_order",
        )

    return None


async def _validate_program_days(
    session: AsyncSession,
    *,
    days: Sequence[RoutineProgramDayCreate],
    user_id: int,
    visibility: RoutineProgram.ProgramVisibility,
) -> None:
    if not _sort_orders_are_unique(days):
        raise DomainValidationError.invalid_range(
            message="Program day sort_order values must be unique",
            field="days.sort_order",
        )

    routine_ids = {day.routine_id for day in days}
    if not routine_ids:
        return

    result = await session.execute(select(Routine).where(Routine.id.in_(routine_ids)))
    routines = {routine.id: routine for routine in result.scalars().all()}

    missing_ids = routine_ids - set(routines)
    if missing_ids:
        raise DomainValidationError.invalid_reference(field="days.routine_id")

    inaccessible_ids = [
        routine_id
        for routine_id, routine in routines.items()
        if not (
            routine.creator_id == user_id
            or routine.visibility
            in {
                Routine.RoutineVisibility.public,
                Routine.RoutineVisibility.link_only,
            }
        )
    ]
    if inaccessible_ids:
        raise DomainValidationError.invalid_reference(field="days.routine_id")

    if visibility == RoutineProgram.ProgramVisibility.public:
        non_public_ids = [
            routine.id
            for routine in routines.values()
            if routine.visibility != Routine.RoutineVisibility.public
        ]
        if non_public_ids:
            raise DomainValidationError.invalid_reference(
                message="Public programs may only include public routines",
                field="days.routine_id",
            )


async def _add_days(
    session: AsyncSession,
    *,
    program_id: int,
    days: Sequence[RoutineProgramDayCreate],
) -> None:
    for day_data in days:
        session.add(
            RoutineProgramDay(
                program_id=program_id,
                routine_id=day_data.routine_id,
                day_label=day_data.day_label,
                sort_order=day_data.sort_order,
                week_number=day_data.week_number,
                phase_label=day_data.phase_label,
                notes=day_data.notes,
            )
        )


async def _fetch_routine_counts(session: AsyncSession, routine_ids: list[int]) -> dict:
    if not routine_ids:
        return {}

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
    session: AsyncSession, routine_ids: list[int], limit: int = 5
) -> dict:
    if not routine_ids:
        return {}

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


async def _routine_summary_map(session: AsyncSession, routines: Sequence[Routine]) -> dict:
    routine_ids = [routine.id for routine in routines]
    counts_by_routine = await _fetch_routine_counts(session, routine_ids)
    previews_by_routine = await _fetch_routine_previews(session, routine_ids)
    summary_by_id = {}

    for routine in routines:
        counts = counts_by_routine.get(
            routine.id, {"exercise_count": 0, "set_count": 0}
        )
        summary_by_id[routine.id] = {
            "id": routine.id,
            "name": routine.name,
            "exercise_count": counts["exercise_count"],
            "set_count": counts["set_count"],
            "exercise_names_preview": previews_by_routine.get(routine.id, []),
        }

    return summary_by_id


async def get_visible_programs_summary(
    session: AsyncSession,
    user_id: int | None,
    offset: int = 0,
    limit: int = 100,
    order_by: str = "createdAt",
    category: str | None = None,
    author: str | None = None,
) -> list[dict]:
    query = select(RoutineProgram)
    query = _apply_visibility_filter(query, user_id)

    if category is not None:
        query = query.where(RoutineProgram.category == category)
    if author is not None:
        query = query.where(RoutineProgram.author == author)

    if order_by == "name":
        query = query.order_by(RoutineProgram.name.asc(), RoutineProgram.id.asc())
    elif order_by == "updatedAt":
        query = query.order_by(
            RoutineProgram.updated_at.desc(), RoutineProgram.id.asc()
        )
    elif order_by == "author":
        query = query.order_by(
            RoutineProgram.author.asc().nullslast(), RoutineProgram.id.asc()
        )
    elif order_by == "category":
        query = query.order_by(
            RoutineProgram.category.asc().nullslast(), RoutineProgram.id.asc()
        )
    elif order_by == "timesUsed":
        query = query.order_by(RoutineProgram.times_used.desc(), RoutineProgram.id.asc())
    else:
        query = query.order_by(RoutineProgram.created_at.desc(), RoutineProgram.id.asc())

    result = await session.execute(query.offset(offset).limit(limit))
    programs = result.scalars().all()
    if not programs:
        return []

    program_ids = [program.id for program in programs]
    day_query = (
        select(RoutineProgramDay)
        .where(RoutineProgramDay.program_id.in_(program_ids))
        .order_by(RoutineProgramDay.program_id, RoutineProgramDay.sort_order)
    )
    day_result = await session.execute(day_query)
    days_by_program: dict[int, list[RoutineProgramDay]] = {}
    routine_ids: set[int] = set()
    for day in day_result.scalars().all():
        days_by_program.setdefault(day.program_id, []).append(day)
        routine_ids.add(day.routine_id)

    counts_by_routine = await _fetch_routine_counts(session, list(routine_ids))

    summary_list = []
    for program in programs:
        days = days_by_program.get(program.id, [])
        distinct_routine_ids = {day.routine_id for day in days}
        exercise_count = sum(
            counts_by_routine.get(routine_id, {}).get("exercise_count", 0)
            for routine_id in distinct_routine_ids
        )
        set_count = sum(
            counts_by_routine.get(routine_id, {}).get("set_count", 0)
            for routine_id in distinct_routine_ids
        )
        summary_list.append(
            {
                "id": program.id,
                "name": program.name,
                "description": program.description,
                "creator_id": program.creator_id,
                "visibility": program.visibility,
                "author": program.author,
                "category": program.category,
                "source_label": program.source_label,
                "is_readonly": program.is_readonly,
                "times_used": program.times_used,
                "day_count": len(days),
                "routine_count": len(distinct_routine_ids),
                "exercise_count": exercise_count,
                "set_count": set_count,
                "day_labels_preview": [day.day_label for day in days[:4]],
                "created_at": program.created_at,
                "updated_at": program.updated_at,
            }
        )

    return summary_list


async def get_visible_programs(
    session: AsyncSession,
    user_id: int | None,
    offset: int = 0,
    limit: int = 100,
) -> list[RoutineProgram]:
    query = _program_detail_query().order_by(RoutineProgram.created_at.desc())
    query = _apply_visibility_filter(query, user_id)
    result = await session.execute(query.offset(offset).limit(limit))
    return list(result.scalars().all())


async def get_program_by_id(
    session: AsyncSession,
    program_id: int,
    user_id: int | None,
    populate_existing: bool = False,
) -> Optional[RoutineProgram]:
    query = _program_detail_query(populate_existing=populate_existing).where(
        RoutineProgram.id == program_id
    )
    query = _apply_direct_read_filter(query, user_id)
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_user_program_by_id(
    session: AsyncSession,
    program_id: int,
    user_id: int,
    populate_existing: bool = False,
) -> Optional[RoutineProgram]:
    result = await session.execute(
        _program_detail_query(populate_existing=populate_existing).where(
            and_(RoutineProgram.id == program_id, RoutineProgram.creator_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def get_any_program_by_id(
    session: AsyncSession,
    program_id: int,
    populate_existing: bool = False,
) -> Optional[RoutineProgram]:
    result = await session.execute(
        _program_detail_query(populate_existing=populate_existing).where(
            RoutineProgram.id == program_id
        )
    )
    return result.scalar_one_or_none()


async def create_program(
    session: AsyncSession,
    program_data: RoutineProgramCreate | AdminRoutineProgramCreate,
    user_id: int,
    *,
    is_admin: bool = False,
) -> RoutineProgram:
    visibility = program_data.visibility or RoutineProgram.ProgramVisibility.private
    await _validate_program_days(
        session, days=program_data.days, user_id=user_id, visibility=visibility
    )

    try:
        program = RoutineProgram(
            name=program_data.name,
            description=program_data.description,
            creator_id=user_id,
            visibility=visibility,
            author=program_data.author,
            category=program_data.category,
            source_label=program_data.source_label,
            is_readonly=(
                bool(program_data.is_readonly)
                if is_admin and isinstance(program_data, AdminRoutineProgramCreate)
                else False
            ),
        )
        session.add(program)
        await session.flush()
        await _add_days(session, program_id=program.id, days=program_data.days)
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        mapped_error = _map_program_integrity_error(e)
        if mapped_error:
            raise mapped_error from e
        raise

    return await get_user_program_by_id(
        session, program.id, user_id, populate_existing=True
    )


async def update_program(
    session: AsyncSession,
    program_id: int,
    program_data: RoutineProgramUpdate,
    user_id: int,
    *,
    is_superuser: bool = False,
) -> Optional[RoutineProgram]:
    program = await (
        get_any_program_by_id(session, program_id)
        if is_superuser
        else get_user_program_by_id(session, program_id, user_id)
    )
    if program is None:
        return None

    if program.is_readonly and not is_superuser:
        raise PermissionError("Read-only programs cannot be updated")

    target_visibility = program_data.visibility or program.visibility
    target_days = program_data.days if program_data.days is not None else program.days
    await _validate_program_days(
        session,
        days=[
            day
            if isinstance(day, RoutineProgramDayCreate)
            else RoutineProgramDayCreate(
                routine_id=day.routine_id,
                day_label=day.day_label,
                sort_order=day.sort_order,
                week_number=day.week_number,
                phase_label=day.phase_label,
                notes=day.notes,
            )
            for day in target_days
        ],
        user_id=user_id,
        visibility=target_visibility,
    )

    if program_data.name is not None:
        program.name = program_data.name
    if program_data.description is not None:
        program.description = program_data.description
    if program_data.visibility is not None:
        program.visibility = program_data.visibility
    if program_data.author is not None:
        program.author = program_data.author
    if program_data.category is not None:
        program.category = program_data.category
    if program_data.source_label is not None:
        program.source_label = program_data.source_label

    if program_data.days is not None:
        for existing_day in list(program.days):
            await session.delete(existing_day)
        await session.flush()
        await _add_days(session, program_id=program.id, days=program_data.days)

    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        mapped_error = _map_program_integrity_error(e)
        if mapped_error:
            raise mapped_error from e
        raise

    return await (
        get_any_program_by_id(session, program.id, populate_existing=True)
        if is_superuser
        else get_user_program_by_id(session, program.id, user_id, populate_existing=True)
    )


async def delete_program(
    session: AsyncSession,
    program_id: int,
    user_id: int,
    *,
    is_superuser: bool = False,
) -> bool:
    program = await (
        get_any_program_by_id(session, program_id)
        if is_superuser
        else get_user_program_by_id(session, program_id, user_id)
    )
    if program is None:
        return False
    if program.is_readonly and not is_superuser:
        raise PermissionError("Read-only programs cannot be deleted")

    await session.delete(program)
    await session.commit()
    return True


async def _clone_routine(
    session: AsyncSession,
    *,
    source: Routine,
    user_id: int,
) -> Routine:
    routine = Routine(
        name=source.name,
        description=source.description,
        workout_type_id=source.workout_type_id,
        creator_id=user_id,
        visibility=Routine.RoutineVisibility.private,
        author=source.author,
        category=source.category,
        is_readonly=False,
    )
    session.add(routine)
    await session.flush()

    for exercise_template in source.exercise_templates:
        cloned_exercise = ExerciseTemplate(
            exercise_type_id=exercise_template.exercise_type_id,
            notes=exercise_template.notes,
            routine_id=routine.id,
        )
        session.add(cloned_exercise)
        await session.flush()

        for set_template in exercise_template.set_templates:
            source_unit = await session.get(IntensityUnit, set_template.intensity_unit_id)
            canonical_intensity, canonical_unit_key = normalize_intensity_for_storage(
                set_template.intensity,
                source_unit,
            )
            canonical_intensity_unit_id = set_template.intensity_unit_id
            if canonical_unit_key is not None:
                canonical_unit = await session.execute(
                    select(IntensityUnit).where(
                        IntensityUnit.abbreviation.ilike(canonical_unit_key)
                    )
                )
                canonical_intensity_unit_id = (
                    canonical_unit.scalar_one_or_none() or source_unit
                ).id

            session.add(
                SetTemplate(
                    reps=set_template.reps,
                    duration_seconds=set_template.duration_seconds,
                    intensity=set_template.intensity,
                    rpe=set_template.rpe,
                    rir=set_template.rir,
                    notes=set_template.notes,
                    type=set_template.type,
                    canonical_intensity=set_template.canonical_intensity
                    or canonical_intensity,
                    intensity_unit_id=set_template.intensity_unit_id,
                    canonical_intensity_unit_id=set_template.canonical_intensity_unit_id
                    or canonical_intensity_unit_id,
                    exercise_template_id=cloned_exercise.id,
                )
            )

    return routine


async def clone_program(
    session: AsyncSession,
    program_id: int,
    user_id: int,
) -> Optional[RoutineProgram]:
    source_program = await get_program_by_id(session, program_id, user_id)
    if source_program is None:
        return None

    cloned_routines_by_source_id: dict[int, Routine] = {}
    try:
        for day in source_program.days:
            if day.routine_id not in cloned_routines_by_source_id:
                cloned_routines_by_source_id[day.routine_id] = await _clone_routine(
                    session, source=day.routine, user_id=user_id
                )

        cloned_program = RoutineProgram(
            name=source_program.name,
            description=source_program.description,
            creator_id=user_id,
            visibility=RoutineProgram.ProgramVisibility.private,
            author=source_program.author,
            category=source_program.category,
            source_label=source_program.source_label or source_program.name,
            is_readonly=False,
        )
        session.add(cloned_program)
        await session.flush()

        for source_day in source_program.days:
            session.add(
                RoutineProgramDay(
                    program_id=cloned_program.id,
                    routine_id=cloned_routines_by_source_id[source_day.routine_id].id,
                    day_label=source_day.day_label,
                    sort_order=source_day.sort_order,
                    week_number=source_day.week_number,
                    phase_label=source_day.phase_label,
                    notes=source_day.notes,
                )
            )

        await session.execute(
            update(RoutineProgram)
            .where(RoutineProgram.id == source_program.id)
            .values(times_used=RoutineProgram.times_used + 1)
        )
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        mapped_error = _map_program_integrity_error(e)
        if mapped_error:
            raise mapped_error from e
        raise
    except Exception:
        await session.rollback()
        raise

    return await get_user_program_by_id(
        session, cloned_program.id, user_id, populate_existing=True
    )


async def hydrate_program(program: RoutineProgram, session: AsyncSession) -> dict:
    routines = [day.routine for day in program.days]
    routine_summaries = await _routine_summary_map(session, routines)
    return {
        "id": program.id,
        "name": program.name,
        "description": program.description,
        "creator_id": program.creator_id,
        "visibility": program.visibility,
        "author": program.author,
        "category": program.category,
        "source_label": program.source_label,
        "is_readonly": program.is_readonly,
        "times_used": program.times_used,
        "created_at": program.created_at,
        "updated_at": program.updated_at,
        "days": [
            {
                "id": day.id,
                "routine_id": day.routine_id,
                "day_label": day.day_label,
                "sort_order": day.sort_order,
                "week_number": day.week_number,
                "phase_label": day.phase_label,
                "notes": day.notes,
                "created_at": day.created_at,
                "updated_at": day.updated_at,
                "routine": routine_summaries[day.routine_id],
            }
            for day in program.days
        ],
    }
