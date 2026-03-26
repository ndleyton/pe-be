from typing import Optional, List
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.core.errors import DomainValidationError
from src.workouts.models import Workout, WorkoutType
from src.workouts.schemas import WorkoutCreate, WorkoutUpdate, WorkoutTypeCreate


def _get_constraint_name(error: IntegrityError) -> Optional[str]:
    if error.orig is None:
        return None

    diag = getattr(error.orig, "diag", None)
    if diag is not None:
        constraint_name = getattr(diag, "constraint_name", None)
        if constraint_name:
            return constraint_name

    return getattr(error.orig, "constraint_name", None)


def _map_workout_integrity_error(
    error: IntegrityError,
) -> Optional[DomainValidationError]:
    constraint_name = _get_constraint_name(error)
    error_message = str(error.orig) if error.orig is not None else str(error)
    lowered = error_message.lower()

    if (
        constraint_name == "ck_workouts_end_time_gte_start_time"
        or "ck_workouts_end_time_gte_start_time" in error_message
    ):
        return DomainValidationError.invalid_range(
            field="end_time",
            message="end_time must be greater than or equal to start_time",
        )

    if (
        constraint_name == "fk_workouts_workout_type_id_workout_types"
        or constraint_name == "workouts_workout_type_id_fkey"
        or ("workout_type_id" in error_message and "foreign key constraint" in lowered)
    ):
        return DomainValidationError.invalid_reference(field="workout_type_id")

    return None


async def get_workout_by_date(
    session: AsyncSession, user_id: int, workout_date: date
) -> Optional[Workout]:
    """Get a workout by a specific date for a user."""
    result = await session.execute(
        select(Workout)
        .where(
            Workout.owner_id == user_id,
            Workout.start_time >= workout_date,
            Workout.start_time < workout_date + timedelta(days=1),
        )
        .order_by(Workout.start_time.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_workout_by_id(
    session: AsyncSession, workout_id: int, user_id: int
) -> Optional[Workout]:
    """Get a workout by ID for a specific user"""
    result = await session.execute(
        select(Workout).where(Workout.id == workout_id, Workout.owner_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_user_workouts(
    session: AsyncSession,
    user_id: int,
    limit: int = 100,
    cursor: Optional[int] = None,
) -> List[Workout]:
    """Fetch workouts ordered by id desc using keyset pagination.

    If `cursor` is provided, return workouts with id < cursor (older).
    """
    stmt = (
        select(Workout)
        .where(Workout.owner_id == user_id)
        .order_by(Workout.id.desc())
        .limit(limit)
    )
    if cursor is not None:
        stmt = stmt.where(Workout.id < cursor)

    result = await session.execute(stmt)
    return result.scalars().all()


async def create_workout(
    session: AsyncSession, workout_create: WorkoutCreate, user_id: int
) -> Workout:
    """Create a new workout"""
    workout = Workout(**workout_create.dict(), owner_id=user_id)
    session.add(workout)
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        mapped_error = _map_workout_integrity_error(e)
        if mapped_error:
            raise mapped_error from e
        raise
    await session.refresh(workout)
    return workout


async def update_workout(
    session: AsyncSession, workout_id: int, workout_update: WorkoutUpdate, user_id: int
) -> Optional[Workout]:
    """Update an existing workout"""
    workout = await get_workout_by_id(session, workout_id, user_id)
    if not workout:
        return None

    update_data = workout_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(workout, field, value)

    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        mapped_error = _map_workout_integrity_error(e)
        if mapped_error:
            raise mapped_error from e
        raise
    await session.refresh(workout)
    return workout


async def delete_workout(session: AsyncSession, workout_id: int, user_id: int) -> bool:
    """Delete a workout"""
    workout = await get_workout_by_id(session, workout_id, user_id)
    if not workout:
        return False

    await session.delete(workout)
    await session.commit()
    return True


# Workout Type CRUD operations
async def get_workout_types(session: AsyncSession) -> List[WorkoutType]:
    """Get all workout types"""
    result = await session.execute(select(WorkoutType))
    return result.scalars().all()


async def create_workout_type(
    session: AsyncSession, workout_type_create: WorkoutTypeCreate
) -> WorkoutType:
    """Create a new workout type"""
    workout_type = WorkoutType(**workout_type_create.dict())
    session.add(workout_type)
    await session.commit()
    await session.refresh(workout_type)
    return workout_type


async def get_latest_workout_for_user(
    session: AsyncSession, user_id: int
) -> Optional[Workout]:
    """Return the most recent workout for a user (ordered by start_time DESC)"""
    result = await session.execute(
        select(Workout)
        .where(Workout.owner_id == user_id)
        .order_by(Workout.start_time.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_stale_open_workouts(
    session: AsyncSession,
    *,
    older_than: datetime,
) -> List[Workout]:
    """Return open workouts whose start_time is older than the cutoff."""
    result = await session.execute(
        select(Workout)
        .where(
            Workout.end_time.is_(None),
            Workout.start_time.is_not(None),
            Workout.start_time <= older_than,
        )
        .order_by(Workout.start_time.asc(), Workout.id.asc())
    )
    return result.scalars().all()
