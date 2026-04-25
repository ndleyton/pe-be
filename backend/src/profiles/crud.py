from sqlalchemy import Select, and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from src.exercises.models import Exercise
from src.exercise_sets.models import ExerciseSet
from src.users.models import User
from src.workouts.models import Workout


def public_completed_workouts_stmt(user_id: int) -> Select[tuple[Workout]]:
    return select(Workout).where(
        Workout.owner_id == user_id,
        Workout.visibility == Workout.WorkoutVisibility.public,
        Workout.end_time.is_not(None),
    )


async def get_public_user_by_username(
    session: AsyncSession, username: str
) -> User | None:
    result = await session.execute(
        select(User).where(
            func.lower(User.username) == username.lower(),
            User.is_profile_public.is_(True),
        )
    )
    return result.unique().scalar_one_or_none()


async def get_public_activity_stats(
    session: AsyncSession, user_id: int
) -> tuple[int, object | None]:
    result = await session.execute(
        select(func.count(Workout.id), func.max(Workout.end_time)).where(
            Workout.owner_id == user_id,
            Workout.visibility == Workout.WorkoutVisibility.public,
            Workout.end_time.is_not(None),
        )
    )
    count, last_activity_at = result.one()
    return int(count or 0), last_activity_at


async def get_public_activity_summaries(
    session: AsyncSession,
    user_id: int,
    *,
    cursor: int | None,
    limit: int,
) -> list[tuple[Workout, int, int, list[str]]]:
    stmt = (
        public_completed_workouts_stmt(user_id)
        .options(
            joinedload(Workout.workout_type),
            selectinload(Workout.exercises).joinedload(Exercise.exercise_type),
            selectinload(Workout.exercises).selectinload(Exercise.exercise_sets),
        )
        .order_by(desc(Workout.end_time), desc(Workout.id))
        .limit(limit)
    )
    if cursor is not None:
        cursor_result = await session.execute(
            select(Workout.end_time).where(
                Workout.id == cursor,
                Workout.owner_id == user_id,
                Workout.visibility == Workout.WorkoutVisibility.public,
                Workout.end_time.is_not(None),
            )
        )
        cursor_end_time = cursor_result.scalar_one_or_none()
        if cursor_end_time is None:
            return []
        stmt = stmt.where(
            or_(
                Workout.end_time < cursor_end_time,
                and_(Workout.end_time == cursor_end_time, Workout.id < cursor),
            )
        )

    result = await session.execute(stmt)
    workouts = result.scalars().all()

    summaries: list[tuple[Workout, int, int, list[str]]] = []
    for workout in workouts:
        active_exercises = [
            exercise for exercise in workout.exercises if exercise.deleted_at is None
        ]
        sets_total = sum(
            1
            for exercise in active_exercises
            for exercise_set in exercise.exercise_sets
            if exercise_set.deleted_at is None
        )
        names = [
            exercise.exercise_type.name
            for exercise in active_exercises
            if exercise.exercise_type is not None
        ][:3]
        summaries.append((workout, len(active_exercises), sets_total, names))
    return summaries


async def get_public_activity_detail(
    session: AsyncSession, user_id: int, workout_id: int
) -> Workout | None:
    result = await session.execute(
        public_completed_workouts_stmt(user_id)
        .options(
            joinedload(Workout.workout_type),
            joinedload(Workout.exercises).joinedload(Exercise.exercise_type),
            joinedload(Workout.exercises)
            .joinedload(Exercise.exercise_sets)
            .joinedload(ExerciseSet.intensity_unit),
        )
        .where(Workout.id == workout_id)
    )
    return result.unique().scalar_one_or_none()
