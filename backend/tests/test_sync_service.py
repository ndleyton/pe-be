import pytest
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.sync.service import SyncService
from src.sync.schemas import (
    GuestSyncPayload,
    GuestWorkout,
    GuestExercise,
    GuestExerciseSet,
    GuestExerciseType,
    GuestWorkoutType,
)
from src.workouts.models import Workout, WorkoutType
from src.exercises.models import Exercise, ExerciseType, IntensityUnit
from src.exercise_sets.models import ExerciseSet
from src.users.models import User

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _seed_user(db_session: AsyncSession, email: str = "test@example.com"):
    user = User(
        email=email,
        hashed_password="hashed_password",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _seed_intensity_unit(db_session: AsyncSession):
    # Seed intensity unit with ID 1
    unit = IntensityUnit(id=1, name="Kilograms", abbreviation="kg")
    db_session.add(unit)
    await db_session.flush()
    return unit


async def test_sync_guest_data_creates_new_records(db_session: AsyncSession):
    await _seed_intensity_unit(db_session)
    user = await _seed_user(db_session)
    user_id = user.id

    # Define payload with one workout, one exercise, and one set
    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="guest-workout-1",
                name="New Workout",
                notes="Some notes",
                start_time=datetime.now(timezone.utc),
                workout_type_id="guest-wt-1",
                exercises=[
                    GuestExercise(
                        id="guest-ex-1",
                        exercise_type_id="guest-et-1",
                        exercise_sets=[
                            GuestExerciseSet(
                                id="guest-set-1",
                                reps=10,
                                intensity=Decimal("100.5"),
                                intensity_unit_id=1,
                                done=True,
                            )
                        ],
                    )
                ],
            )
        ],
        exerciseTypes=[
            GuestExerciseType(
                id="guest-et-1", name="Bench Press", default_intensity_unit=1
            )
        ],
        workoutTypes=[GuestWorkoutType(id="guest-wt-1", name="Strength Training")],
    )

    # Execute sync
    result = await SyncService.sync_guest_data(db_session, payload, user_id)

    # Verify results
    assert result.success is True
    assert result.syncedWorkouts == 1
    assert result.syncedExercises == 1
    assert result.syncedSets == 1

    # Verify records in database
    # Workout
    stmt = select(Workout).where(
        Workout.owner_id == user_id, Workout.name == "New Workout"
    )
    workout = (await db_session.execute(stmt)).scalar_one()
    assert workout.notes == "Some notes"

    # Exercise
    stmt = select(Exercise).where(Exercise.workout_id == workout.id)
    exercise = (await db_session.execute(stmt)).scalar_one()

    # ExerciseType (should be candidate since it didn't exist)
    stmt = select(ExerciseType).where(ExerciseType.id == exercise.exercise_type_id)
    et = (await db_session.execute(stmt)).scalar_one()
    assert et.name == "Bench Press"
    assert et.status == "candidate"
    assert et.owner_id == user_id

    # Set
    stmt = select(ExerciseSet).where(ExerciseSet.exercise_id == exercise.id)
    es = (await db_session.execute(stmt)).scalar_one()
    assert es.reps == 10
    assert es.intensity == Decimal("100.5")
    assert es.done is True


async def test_sync_guest_data_reuses_existing_types(db_session: AsyncSession):
    await _seed_intensity_unit(db_session)
    user = await _seed_user(db_session, email="user2@example.com")
    user_id = user.id

    # Create existing exercise type
    et = ExerciseType(name="Squat", status="released", default_intensity_unit=1)
    db_session.add(et)

    wt = WorkoutType(name="Legs", description="Leg workout")
    db_session.add(wt)
    await db_session.flush()

    # Payload referencing the existing types by name
    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="guest-w2",
                name="Leg Day",
                start_time=datetime.now(timezone.utc),
                workout_type_id="guest-wt-legs",
                exercises=[
                    GuestExercise(
                        id="guest-ex2",
                        exercise_type_id="guest-et-squat",
                        exercise_sets=[
                            GuestExerciseSet(id="guest-s2", reps=5, intensity_unit_id=1)
                        ],
                    )
                ],
            )
        ],
        exerciseTypes=[
            GuestExerciseType(
                id="guest-et-squat",
                name="Squat",  # Matches existing by name
            )
        ],
        workoutTypes=[
            GuestWorkoutType(
                id="guest-wt-legs",
                name="Legs",  # Matches existing by name
            )
        ],
    )

    result = await SyncService.sync_guest_data(db_session, payload, user_id)

    assert result.success is True

    # Verify no new exercise types were created (we only want one 'Squat')
    stmt = select(ExerciseType).where(ExerciseType.name == "Squat")
    results = (await db_session.execute(stmt)).scalars().all()
    assert len(results) == 1
    assert results[0].id == et.id


async def test_sync_guest_data_rolls_back_on_error(db_session: AsyncSession):
    await _seed_intensity_unit(db_session)
    user = await _seed_user(db_session, email="user3@example.com")
    user_id = user.id

    # Create invalid payload (e.g., missing mandatory field in a way that violates DB constraint,
    # but Pydantic might catch it first. We'll simulate a DB error by using a non-existent unit ID if possible)

    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="guest-w3",
                name="Error Workout",
                start_time=datetime.now(timezone.utc),
                workout_type_id="guest-wt-1",
                exercises=[
                    GuestExercise(
                        id="guest-ex3",
                        exercise_type_id="guest-et-1",
                        exercise_sets=[
                            GuestExerciseSet(
                                id="guest-s3",
                                reps=10,
                                intensity_unit_id=99999,  # Likely invalid FK if we had a strict FK,
                                # but let's just trigger a general failure.
                                done=True,
                            )
                        ],
                    )
                ],
            )
        ],
        exerciseTypes=[
            GuestExerciseType(
                id="guest-et-1", name="Error Exercise", default_intensity_unit=1
            )
        ],
        workoutTypes=[GuestWorkoutType(id="guest-wt-1", name="Error Type")],
    )

    # We'll use a mock or just expect it to fail if it violates a constraint.
    # Actually, the implementation has a try-except that returns success=False.

    # Since we're using a real (test) database, let's see if a commit error happens.
    # Actually, the easiest way to fail is a unique constraint violation or null violation.
    # But for a simple test, we just want to ensure that if it returns success=False,
    # nothing was committed.

    # Let's mock the session to raise an error during commit.
    from unittest.mock import patch

    with patch.object(db_session, "commit", side_effect=Exception("Simulated Failure")):
        result = await SyncService.sync_guest_data(db_session, payload, user_id)
        assert result.success is False

    # Verify nothing was committed
    stmt = select(Workout).where(Workout.name == "Error Workout")
    workout = (await db_session.execute(stmt)).scalar_one_or_none()
    assert workout is None


async def test_sync_guest_data_is_idempotent(db_session: AsyncSession):
    await _seed_intensity_unit(db_session)
    user = await _seed_user(db_session, email="idempotency@example.com")
    user_id = user.id
    idempotency_key = "test-key-123"

    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="guest-w-idemp",
                name="Idemp Workout",
                start_time=datetime.now(timezone.utc),
                workout_type_id="guest-wt-1",
                exercises=[],
            )
        ],
        exerciseTypes=[],
        workoutTypes=[GuestWorkoutType(id="guest-wt-1", name="Idemp Type")],
    )

    # First call
    result1 = await SyncService.sync_guest_data(
        db_session, payload, user_id, idempotency_key=idempotency_key
    )
    assert result1.success is True
    assert result1.syncedWorkouts == 1

    # Second call with same key
    result2 = await SyncService.sync_guest_data(
        db_session, payload, user_id, idempotency_key=idempotency_key
    )
    assert result2.success is True
    assert result2.syncedWorkouts == 1  # cached result

    # Verify only one workout exists despite two calls
    stmt = select(Workout).where(Workout.owner_id == user_id)
    workouts = (await db_session.execute(stmt)).scalars().all()
    assert len(workouts) == 1


async def test_sync_guest_data_uses_external_id(db_session: AsyncSession):
    await _seed_intensity_unit(db_session)
    user = await _seed_user(db_session, email="external_id@example.com")
    user_id = user.id

    # Create an existing exercise type that we'll refer to by ID
    et = ExerciseType(
        name="External Exercise", status="released", default_intensity_unit=1
    )
    db_session.add(et)
    await db_session.flush()

    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="gw1",
                start_time=datetime.now(timezone.utc),
                workout_type_id="gwt1",
                exercises=[
                    GuestExercise(
                        id="ge1",
                        exercise_type_id="guest-uuid-1",
                        exercise_sets=[
                            GuestExerciseSet(id="gs1", reps=10, intensity_unit_id=1)
                        ],
                    )
                ],
            )
        ],
        exerciseTypes=[
            GuestExerciseType(
                id="guest-uuid-1",
                name="Different Name",  # Name mismatch is intentional
                external_id=str(et.id),  # But external_id matches
            )
        ],
        workoutTypes=[GuestWorkoutType(id="gwt1", name="Typical")],
    )

    result = await SyncService.sync_guest_data(db_session, payload, user_id)
    assert result.success is True

    # Verify that the exercise was linked to the correct server ID despite name mismatch
    stmt = select(Exercise).join(Workout).where(Workout.owner_id == user_id)
    exercise = (await db_session.execute(stmt)).scalar_one()
    assert exercise.exercise_type_id == et.id


async def test_sync_guest_data_falls_back_to_server_id(db_session: AsyncSession):
    await _seed_intensity_unit(db_session)
    user = await _seed_user(db_session, email="fallback@example.com")
    user_id = user.id

    # Seed workout type ID 4 (standard strength training)
    # Using explicit ID in seed to support code constants
    wt = WorkoutType(id=4, name="Strength Training", description="Standard")
    db_session.add(wt)

    # Create an existing exercise type with a specific ID if possible,
    # but we'll just use whatever ID it gets.
    et = ExerciseType(
        name="Fallback Exercise", status="released", default_intensity_unit=1
    )
    db_session.add(et)
    await db_session.flush()

    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="gw2",
                start_time=datetime.now(timezone.utc),
                workout_type_id="4",  # Numeric fallback for Strength Training
                exercises=[
                    GuestExercise(
                        id="ge2",
                        exercise_type_id=str(et.id),  # Numeric fallback for exercise type
                        exercise_sets=[
                            GuestExerciseSet(id="gs2", reps=10, intensity_unit_id=1)
                        ],
                    )
                ],
            )
        ],
        exerciseTypes=[],  # Empty list to force fallback
        workoutTypes=[],
    )

    result = await SyncService.sync_guest_data(db_session, payload, user_id)
    assert result.success is True, f"Sync failed: {result.error}"

    # Verify workout type 4 was used
    stmt = select(Workout).where(Workout.owner_id == user_id)
    workout = (await db_session.execute(stmt)).scalar_one()
    assert workout.workout_type_id == 4

    # Verify exercise type fallback worked
    stmt = select(Exercise).where(Exercise.workout_id == workout.id)
    exercise = (await db_session.execute(stmt)).scalar_one()
    assert exercise.exercise_type_id == et.id
