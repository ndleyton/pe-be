from datetime import datetime, timedelta, timezone

import pytest

from src.users.models import User
from src.workouts.crud import (
    create_workout,
    create_workout_type,
    get_stale_open_workouts,
)
from src.workouts.schemas import WorkoutCreate, WorkoutTypeCreate
from src.workouts.service import WorkoutService


pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _seed_user(db_session, email: str) -> User:
    user = User(
        email=email,
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _seed_workout_type(db_session):
    return await create_workout_type(
        db_session,
        WorkoutTypeCreate(name="Auto Close Type", description="desc"),
    )


async def test_get_stale_open_workouts_returns_only_open_workouts_older_than_cutoff(
    db_session,
):
    user = await _seed_user(db_session, "stale-open-list@example.com")
    workout_type = await _seed_workout_type(db_session)

    stale = await create_workout(
        db_session,
        WorkoutCreate(
            name="Stale",
            start_time=datetime.now(timezone.utc) - timedelta(hours=30),
            workout_type_id=workout_type.id,
        ),
        user.id,
    )
    await create_workout(
        db_session,
        WorkoutCreate(
            name="Recent",
            start_time=datetime.now(timezone.utc) - timedelta(hours=2),
            workout_type_id=workout_type.id,
        ),
        user.id,
    )
    await create_workout(
        db_session,
        WorkoutCreate(
            name="Already Closed",
            start_time=datetime.now(timezone.utc) - timedelta(hours=40),
            end_time=datetime.now(timezone.utc) - timedelta(hours=39),
            workout_type_id=workout_type.id,
        ),
        user.id,
    )

    workouts = await get_stale_open_workouts(
        db_session,
        older_than=datetime.now(timezone.utc) - timedelta(hours=24),
    )

    assert [workout.id for workout in workouts] == [stale.id]


async def test_close_stale_open_workouts_caps_end_time_at_start_plus_24_hours(
    db_session,
):
    user = await _seed_user(db_session, "stale-open-close@example.com")
    workout_type = await _seed_workout_type(db_session)
    stale_start = datetime.now(timezone.utc) - timedelta(hours=30)
    recent_start = datetime.now(timezone.utc) - timedelta(hours=3)

    stale = await create_workout(
        db_session,
        WorkoutCreate(
            name="Stale Open Workout",
            start_time=stale_start,
            workout_type_id=workout_type.id,
        ),
        user.id,
    )
    recent = await create_workout(
        db_session,
        WorkoutCreate(
            name="Recent Open Workout",
            start_time=recent_start,
            workout_type_id=workout_type.id,
        ),
        user.id,
    )

    closed_count = await WorkoutService.close_stale_open_workouts(
        db_session,
        max_age_hours=24,
    )

    assert closed_count == 1

    refreshed_stale = await WorkoutService.get_workout(db_session, stale.id, user.id)
    refreshed_recent = await WorkoutService.get_workout(db_session, recent.id, user.id)

    assert refreshed_stale is not None
    assert refreshed_stale.end_time == stale_start + timedelta(hours=24)
    assert refreshed_recent is not None
    assert refreshed_recent.end_time is None
