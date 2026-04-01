from datetime import datetime, timezone
from decimal import Decimal

import pytest

from src.core.errors import DomainValidationError
from src.exercise_sets import crud
from src.exercise_sets.schemas import ExerciseSetCreate, ExerciseSetUpdate
from tests.test_exercises_crud import (
    _seed_exercise,
    _seed_exercise_set,
    _seed_exercise_type,
    _seed_intensity_unit,
    _seed_user,
    _seed_workout,
    _seed_workout_type,
)


pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_exercise_set_queries_filter_deleted_and_return_owner_state(db_session):
    owner = await _seed_user(db_session, "exercise-set-queries@example.com")
    workout_type = await _seed_workout_type(db_session, "Set Query Type")
    workout = await _seed_workout(db_session, owner.id, workout_type.id)
    unit = await _seed_intensity_unit(db_session)
    exercise_type = await _seed_exercise_type(db_session, "Set Query Exercise")
    exercise = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )
    deleted_at = datetime(2026, 3, 2, tzinfo=timezone.utc)
    newer_active_set = await _seed_exercise_set(
        db_session,
        exercise_id=exercise.id,
        intensity_unit_id=unit.id,
        intensity=80,
        reps=8,
        created_at=datetime(2026, 3, 2, 12, 0, tzinfo=timezone.utc),
    )
    older_active_set = await _seed_exercise_set(
        db_session,
        exercise_id=exercise.id,
        intensity_unit_id=unit.id,
        intensity=75,
        reps=10,
        created_at=datetime(2026, 3, 2, 8, 0, tzinfo=timezone.utc),
    )
    deleted_set = await _seed_exercise_set(
        db_session,
        exercise_id=exercise.id,
        intensity_unit_id=unit.id,
        intensity=85,
        reps=6,
        created_at=datetime(2026, 3, 2, 16, 0, tzinfo=timezone.utc),
        deleted_at=deleted_at,
    )
    await db_session.commit()

    found = await crud.get_exercise_set_by_id(db_session, newer_active_set.id)
    assert found is not None
    assert found.id == newer_active_set.id
    assert found.exercise.workout.owner_id == owner.id
    assert await crud.get_exercise_set_by_id(db_session, deleted_set.id) is None

    active_owner = await crud.get_exercise_set_owner_and_deleted(
        db_session, newer_active_set.id
    )
    assert active_owner == (owner.id, None)

    deleted_owner = await crud.get_exercise_set_owner_and_deleted(
        db_session, deleted_set.id
    )
    assert deleted_owner == (owner.id, deleted_at)
    assert await crud.get_exercise_set_owner_and_deleted(db_session, 999999) is None

    sets = await crud.get_exercise_sets_for_exercise(db_session, exercise.id)
    assert [exercise_set.id for exercise_set in sets] == [
        older_active_set.id,
        newer_active_set.id,
    ]


async def test_create_exercise_set_success_and_invalid_reference_mapping(db_session):
    owner = await _seed_user(db_session, "exercise-set-create@example.com")
    workout_type = await _seed_workout_type(db_session, "Set Create Type")
    workout = await _seed_workout(db_session, owner.id, workout_type.id)
    unit = await _seed_intensity_unit(db_session)
    exercise_type = await _seed_exercise_type(db_session, "Set Create Exercise")
    exercise = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 3, 3, tzinfo=timezone.utc),
    )
    unit_id = unit.id
    exercise_id = exercise.id
    await db_session.commit()

    created = await crud.create_exercise_set(
        db_session,
        ExerciseSetCreate(
            reps=10,
            intensity=100,
            intensity_unit_id=unit_id,
            exercise_id=exercise_id,
            rest_time_seconds=90,
            done=False,
            notes="top set",
            type="working",
        ),
    )
    assert created.id is not None
    assert created.exercise_id == exercise_id
    assert created.intensity_unit_id == unit_id
    assert created.canonical_intensity == 100
    assert created.canonical_intensity_unit_id == unit_id

    with pytest.raises(DomainValidationError) as invalid_unit:
        await crud.create_exercise_set(
            db_session,
            ExerciseSetCreate(
                reps=8,
                intensity=90,
                intensity_unit_id=999999,
                exercise_id=exercise_id,
            ),
        )
    assert invalid_unit.value.field == "intensity_unit_id"

    with pytest.raises(DomainValidationError) as invalid_exercise:
        await crud.create_exercise_set(
            db_session,
            ExerciseSetCreate(
                reps=8,
                intensity=90,
                intensity_unit_id=unit_id,
                exercise_id=999999,
            ),
        )
    assert invalid_exercise.value.field == "exercise_id"


async def test_update_exercise_set_handles_missing_deleted_and_invalid_reference(
    db_session,
):
    owner = await _seed_user(db_session, "exercise-set-update@example.com")
    workout_type = await _seed_workout_type(db_session, "Set Update Type")
    workout = await _seed_workout(db_session, owner.id, workout_type.id)
    unit = await _seed_intensity_unit(db_session, "Kilograms", "kg")
    alternate_unit = await _seed_intensity_unit(db_session, "Pounds", "lb")
    exercise_type = await _seed_exercise_type(db_session, "Set Update Exercise")
    exercise = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 3, 4, tzinfo=timezone.utc),
    )
    active_set = await _seed_exercise_set(
        db_session,
        exercise_id=exercise.id,
        intensity_unit_id=unit.id,
        intensity=80,
        reps=8,
    )
    deleted_set = await _seed_exercise_set(
        db_session,
        exercise_id=exercise.id,
        intensity_unit_id=unit.id,
        intensity=85,
        reps=6,
        deleted_at=datetime(2026, 3, 5, tzinfo=timezone.utc),
    )
    await db_session.commit()

    updated = await crud.update_exercise_set(
        db_session,
        active_set.id,
        ExerciseSetUpdate(
            reps=12,
            intensity=95,
            intensity_unit_id=alternate_unit.id,
            rest_time_seconds=120,
            done=True,
            notes="updated",
            type="backoff",
        ),
    )
    assert updated is not None
    assert updated.reps == 12
    assert updated.intensity_unit_id == alternate_unit.id
    assert updated.canonical_intensity == Decimal("43.09128")
    assert updated.canonical_intensity_unit_id == unit.id
    assert updated.done is True
    assert updated.notes == "updated"
    assert updated.type == "backoff"

    assert (
        await crud.update_exercise_set(db_session, 999999, ExerciseSetUpdate()) is None
    )
    assert (
        await crud.update_exercise_set(db_session, deleted_set.id, ExerciseSetUpdate())
        is None
    )

    with pytest.raises(DomainValidationError) as invalid_unit:
        await crud.update_exercise_set(
            db_session,
            active_set.id,
            ExerciseSetUpdate(intensity_unit_id=999999),
        )
    assert invalid_unit.value.field == "intensity_unit_id"


async def test_soft_delete_delete_and_verify_exercise_ownership(db_session):
    owner = await _seed_user(db_session, "exercise-set-delete@example.com")
    other = await _seed_user(db_session, "exercise-set-other@example.com")
    workout_type = await _seed_workout_type(db_session, "Set Delete Type")
    workout = await _seed_workout(db_session, owner.id, workout_type.id)
    unit = await _seed_intensity_unit(db_session)
    exercise_type = await _seed_exercise_type(db_session, "Set Delete Exercise")
    exercise = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 3, 6, tzinfo=timezone.utc),
    )
    active_set = await _seed_exercise_set(
        db_session,
        exercise_id=exercise.id,
        intensity_unit_id=unit.id,
        intensity=80,
        reps=8,
    )
    already_deleted = await _seed_exercise_set(
        db_session,
        exercise_id=exercise.id,
        intensity_unit_id=unit.id,
        intensity=85,
        reps=5,
        deleted_at=datetime(2026, 3, 7, tzinfo=timezone.utc),
    )
    await db_session.commit()

    assert await crud.soft_delete_exercise_set(db_session, 999999) is False
    assert await crud.soft_delete_exercise_set(db_session, active_set.id) is True
    refreshed = await crud.get_exercise_set_owner_and_deleted(db_session, active_set.id)
    assert refreshed is not None
    assert refreshed[1] is not None

    assert await crud.soft_delete_exercise_set(db_session, already_deleted.id) is True
    assert await crud.delete_exercise_set(db_session, active_set.id) is True

    assert (
        await crud.verify_exercise_ownership(db_session, exercise.id, owner.id)
        is not None
    )
    assert (
        await crud.verify_exercise_ownership(db_session, exercise.id, other.id) is None
    )
    assert await crud.verify_exercise_ownership(db_session, 999999, owner.id) is None
