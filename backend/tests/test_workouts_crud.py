from datetime import date, datetime, timezone

import pytest

from src.core.errors import DomainValidationError
from src.users.models import User
from src.workouts import crud
from src.workouts.schemas import WorkoutCreate, WorkoutTypeCreate, WorkoutUpdate


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


async def _seed_workout_type(db_session, name: str, description: str = "desc"):
    workout_type = await crud.create_workout_type(
        db_session,
        WorkoutTypeCreate(name=name, description=description),
    )
    return workout_type


async def test_get_workout_by_date_and_id_scope_queries(db_session):
    owner = await _seed_user(db_session, "workout-date-owner@example.com")
    other = await _seed_user(db_session, "workout-date-other@example.com")
    workout_type = await _seed_workout_type(db_session, "Date Lookup Type")

    early = await crud.create_workout(
        db_session,
        WorkoutCreate(
            name="Morning Session",
            start_time=datetime(2026, 3, 1, 9, 0, tzinfo=timezone.utc),
            workout_type_id=workout_type.id,
        ),
        owner.id,
    )
    late = await crud.create_workout(
        db_session,
        WorkoutCreate(
            name="Evening Session",
            start_time=datetime(2026, 3, 1, 18, 0, tzinfo=timezone.utc),
            workout_type_id=workout_type.id,
        ),
        owner.id,
    )
    await crud.create_workout(
        db_session,
        WorkoutCreate(
            name="Next Day",
            start_time=datetime(2026, 3, 2, 8, 0, tzinfo=timezone.utc),
            workout_type_id=workout_type.id,
        ),
        owner.id,
    )
    other_users_workout = await crud.create_workout(
        db_session,
        WorkoutCreate(
            name="Other User Session",
            start_time=datetime(2026, 3, 1, 20, 0, tzinfo=timezone.utc),
            workout_type_id=workout_type.id,
        ),
        other.id,
    )

    by_date = await crud.get_workout_by_date(db_session, owner.id, date(2026, 3, 1))
    assert by_date is not None
    assert by_date.id == late.id

    other_by_date = await crud.get_workout_by_date(
        db_session, other.id, date(2026, 3, 1)
    )
    assert other_by_date is not None
    assert other_by_date.id == other_users_workout.id

    assert (
        await crud.get_workout_by_date(db_session, owner.id, date(2026, 3, 3)) is None
    )

    found = await crud.get_workout_by_id(db_session, early.id, owner.id)
    assert found is not None
    assert found.id == early.id
    assert await crud.get_workout_by_id(db_session, early.id, other.id) is None


async def test_get_user_workouts_keyset_pagination_and_latest_by_start_time(db_session):
    owner = await _seed_user(db_session, "workout-list-owner@example.com")
    other = await _seed_user(db_session, "workout-list-other@example.com")
    workout_type = await _seed_workout_type(db_session, "Pagination Type")

    first = await crud.create_workout(
        db_session,
        WorkoutCreate(
            name="First Insert",
            start_time=datetime(2026, 4, 1, 8, 0, tzinfo=timezone.utc),
            workout_type_id=workout_type.id,
        ),
        owner.id,
    )
    latest_by_time = await crud.create_workout(
        db_session,
        WorkoutCreate(
            name="Latest By Time",
            start_time=datetime(2026, 4, 3, 8, 0, tzinfo=timezone.utc),
            workout_type_id=workout_type.id,
        ),
        owner.id,
    )
    last_inserted = await crud.create_workout(
        db_session,
        WorkoutCreate(
            name="Last Inserted",
            start_time=datetime(2026, 4, 2, 8, 0, tzinfo=timezone.utc),
            workout_type_id=workout_type.id,
        ),
        owner.id,
    )
    await crud.create_workout(
        db_session,
        WorkoutCreate(
            name="Other User",
            start_time=datetime(2026, 4, 4, 8, 0, tzinfo=timezone.utc),
            workout_type_id=workout_type.id,
        ),
        other.id,
    )

    page_one = await crud.get_user_workouts(db_session, owner.id, limit=2)
    assert [workout.id for workout in page_one] == [last_inserted.id, latest_by_time.id]

    page_two = await crud.get_user_workouts(
        db_session, owner.id, limit=2, cursor=latest_by_time.id
    )
    assert [workout.id for workout in page_two] == [first.id]

    latest = await crud.get_latest_workout_for_user(db_session, owner.id)
    assert latest is not None
    assert latest.id == latest_by_time.id

    assert await crud.get_latest_workout_for_user(db_session, 999999) is None


async def test_create_workout_success_and_integrity_mappings(db_session):
    owner = await _seed_user(db_session, "workout-create@example.com")
    workout_type = await _seed_workout_type(db_session, "Create Type")
    owner_id = owner.id
    workout_type_id = workout_type.id

    created = await crud.create_workout(
        db_session,
        WorkoutCreate(
            name="Created Workout",
            notes="top notes",
            start_time=datetime(2026, 5, 1, 7, 30),
            workout_type_id=workout_type_id,
        ),
        owner_id,
    )
    assert created.id is not None
    assert created.owner_id == owner_id
    assert created.start_time.tzinfo == timezone.utc

    with pytest.raises(DomainValidationError) as invalid_type:
        await crud.create_workout(
            db_session,
            WorkoutCreate(
                name="Invalid Type",
                start_time=datetime(2026, 5, 1, 8, 0, tzinfo=timezone.utc),
                workout_type_id=999999,
            ),
            owner_id,
        )
    assert invalid_type.value.field == "workout_type_id"

    with pytest.raises(DomainValidationError) as invalid_range:
        await crud.create_workout(
            db_session,
            WorkoutCreate.model_construct(
                name="Invalid Range",
                start_time=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
                end_time=datetime(2026, 5, 1, 8, 0, tzinfo=timezone.utc),
                workout_type_id=workout_type_id,
            ),
            owner_id,
        )
    assert invalid_range.value.field == "end_time"


async def test_update_workout_handles_success_missing_and_integrity_errors(db_session):
    owner = await _seed_user(db_session, "workout-update@example.com")
    other = await _seed_user(db_session, "workout-update-other@example.com")
    workout_type = await _seed_workout_type(db_session, "Original Type")
    replacement_type = await _seed_workout_type(db_session, "Replacement Type")
    owner_id = owner.id
    other_id = other.id
    workout_type_id = workout_type.id
    replacement_type_id = replacement_type.id

    workout = await crud.create_workout(
        db_session,
        WorkoutCreate(
            name="Needs Update",
            start_time=datetime(2026, 6, 1, 9, 0, tzinfo=timezone.utc),
            workout_type_id=workout_type_id,
        ),
        owner_id,
    )
    workout_id = workout.id

    assert (
        await crud.update_workout(
            db_session,
            workout_id,
            WorkoutUpdate(name="Ignored"),
            other_id,
        )
        is None
    )

    updated = await crud.update_workout(
        db_session,
        workout_id,
        WorkoutUpdate(
            name="Updated Workout",
            notes="new notes",
            end_time=datetime(2026, 6, 1, 10, 0),
            workout_type_id=replacement_type_id,
        ),
        owner_id,
    )
    assert updated is not None
    assert updated.name == "Updated Workout"
    assert updated.notes == "new notes"
    assert updated.workout_type_id == replacement_type.id
    assert updated.end_time.tzinfo == timezone.utc

    with pytest.raises(DomainValidationError) as invalid_type:
        await crud.update_workout(
            db_session,
            workout_id,
            WorkoutUpdate(workout_type_id=999999),
            owner_id,
        )
    assert invalid_type.value.field == "workout_type_id"

    with pytest.raises(DomainValidationError) as invalid_range:
        await crud.update_workout(
            db_session,
            workout_id,
            WorkoutUpdate.model_construct(
                end_time=datetime(2026, 6, 1, 8, 0, tzinfo=timezone.utc)
            ),
            owner_id,
        )
    assert invalid_range.value.field == "end_time"


async def test_delete_workout_and_workout_type_queries(db_session):
    owner = await _seed_user(db_session, "workout-delete@example.com")
    other = await _seed_user(db_session, "workout-delete-other@example.com")
    strength = await _seed_workout_type(db_session, " Strength ", "Barbell work")
    await _seed_workout_type(db_session, "Cardio", "Conditioning")

    workout = await crud.create_workout(
        db_session,
        WorkoutCreate(
            name="Delete Me",
            start_time=datetime(2026, 7, 1, 7, 0, tzinfo=timezone.utc),
            workout_type_id=strength.id,
        ),
        owner.id,
    )

    workout_types = await crud.get_workout_types(db_session)
    assert {
        (workout_type.name, workout_type.description) for workout_type in workout_types
    } == {
        ("Strength", "Barbell work"),
        ("Cardio", "Conditioning"),
    }

    assert await crud.delete_workout(db_session, workout.id, other.id) is False
    assert await crud.delete_workout(db_session, workout.id, owner.id) is True
    assert await crud.delete_workout(db_session, workout.id, owner.id) is False
    assert await crud.get_workout_by_id(db_session, workout.id, owner.id) is None
