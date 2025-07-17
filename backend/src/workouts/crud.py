from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.workouts.models import Workout, WorkoutType
from src.workouts.schemas import WorkoutCreate, WorkoutUpdate, WorkoutTypeCreate


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
    await session.commit()
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

    await session.commit()
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
