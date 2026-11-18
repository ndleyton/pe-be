import pytest
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import event, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.sync.models import GuestExerciseTypeMapping
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
from src.workouts.crud import delete_workout
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


async def test_literal_custom_types_and_stable_replay(db_session):
    user = await _seed_user(db_session)
    await _seed_intensity_unit(db_session)
    released = ExerciseType(name="Bench", status="released")
    db_session.add(released)
    await db_session.flush()
    definitions = [
        GuestExerciseType(id=f"local-{name}", name=name) for name in ("Bench", "%", "_")
    ]
    exercises = [
        GuestExercise(
            id=ref,
            exercise_type_id=ref,
            exercise_sets=[GuestExerciseSet(id="set", reps=5, intensity_unit_id=1)],
        )
        for ref in [d.id for d in definitions] + [str(released.id)]
    ]
    workout = GuestWorkout(
        id="first",
        start_time=datetime.now(timezone.utc),
        workout_type_id="wt",
        exercises=exercises,
    )
    payload = GuestSyncPayload(
        workouts=[workout],
        exerciseTypes=[*definitions, GuestExerciseType(id="unused", name="Seed")],
    )
    first = await SyncService.sync_guest_data(db_session, payload, user.id, "key")
    assert first.success
    assert first == await SyncService.sync_guest_data(
        db_session, payload, user.id, "key"
    )
    retry = await SyncService.sync_guest_data(db_session, payload, user.id, "fresh")
    assert retry.success and retry.workoutIdMap == first.workoutIdMap
    assert retry.syncedWorkouts == retry.syncedExercises == retry.syncedSets == 0
    for model, count in [
        (Workout, 1),
        (Exercise, 4),
        (ExerciseSet, 4),
        (ExerciseType, 4),
    ]:
        assert await db_session.scalar(select(func.count()).select_from(model)) == count
    candidates = (
        await db_session.scalars(
            select(ExerciseType).where(ExerciseType.owner_id == user.id)
        )
    ).all()
    assert {(et.name, et.status) for et in candidates} == {
        (name, "candidate") for name in ("Bench", "%", "_")
    }
    payload.workouts = [workout.model_copy(update={"id": "second"})]
    second = await SyncService.sync_guest_data(db_session, payload, user.id)
    assert (
        second.success and second.workoutIdMap["second"] != first.workoutIdMap["first"]
    )
    assert await db_session.scalar(select(func.count()).select_from(ExerciseType)) == 4


async def test_workout_type_names_are_literal(db_session):
    user = await _seed_user(db_session)
    await _seed_intensity_unit(db_session)
    db_session.add(WorkoutType(name="Strength Training"))
    await db_session.flush()
    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="w",
                start_time=datetime.now(timezone.utc),
                workout_type_id="wt",
                exercises=[],
            )
        ],
        workoutTypes=[GuestWorkoutType(id="wt", name="%")],
    )
    result = await SyncService.sync_guest_data(db_session, payload, user.id)
    assert result.success
    workout = await db_session.get(Workout, result.workoutIdMap["w"])
    assert (
        await db_session.scalar(
            select(WorkoutType.name).where(WorkoutType.id == workout.workout_type_id)
        )
        == "%"
    )


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


async def test_timestamp_collision_with_unmapped_workout(db_session: AsyncSession):
    await _seed_intensity_unit(db_session)
    user = await _seed_user(db_session, email="skip@example.com")
    user_id = user.id
    start_time = datetime.now(timezone.utc)

    # Pre-create a workout type
    wt = WorkoutType(name="Test Type", description="Test")
    db_session.add(wt)
    await db_session.flush()

    # Pre-create a workout
    existing = Workout(
        name="Existing", start_time=start_time, workout_type_id=wt.id, owner_id=user_id
    )
    db_session.add(existing)
    await db_session.commit()

    # Payload with same start_time
    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="g1",
                name="New Name Same Time",
                start_time=start_time,
                workout_type_id="wt1",
                exercises=[],
            )
        ],
        exerciseTypes=[],
        workoutTypes=[GuestWorkoutType(id="wt1", name="Test Type")],  # Matches by name
    )

    result = await SyncService.sync_guest_data(db_session, payload, user_id)
    assert result.success is True
    assert result.syncedWorkouts == 1
    assert result.workoutIdMap["g1"] != existing.id


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


async def test_retries_do_not_recreate_a_deleted_workout(db_session):
    user = await _seed_user(db_session)
    user_id = user.id
    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="deleted-workout",
                start_time=datetime.now(timezone.utc),
                workout_type_id="strength",
            )
        ]
    )
    result = await SyncService.sync_guest_data(db_session, payload, user_id, "original")
    assert result.success
    assert await delete_workout(
        db_session, result.workoutIdMap["deleted-workout"], user_id
    )

    for key in ("fresh", "original"):
        replay = await SyncService.sync_guest_data(db_session, payload, user_id, key)
        assert not replay.success
        assert replay.deletedWorkoutIds == ["deleted-workout"]
        assert replay.workoutIdMap == {}
    assert await db_session.scalar(
        select(func.count()).select_from(Workout).where(Workout.owner_id == user_id)
    ) == 0


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
                        exercise_type_id=str(
                            et.id
                        ),  # Numeric fallback for exercise type
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


async def test_visibility_lookup_batched_across_workouts(db_session):
    user = await _seed_user(db_session)
    types = [ExerciseType(name=name, status="released") for name in ("A", "B")]
    db_session.add_all(types)
    await db_session.flush()
    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id=wid,
                start_time=datetime.now(timezone.utc),
                workout_type_id="wt",
                exercises=[
                    GuestExercise(id=str(et.id), exercise_type_id=str(et.id))
                    for et in types
                ],
            )
            for wid in ("one", "two")
        ]
    )
    statements = []

    def capture(conn, cursor, statement, params, context, many):
        if "FROM exercise_types" in statement and "exercise_types.status" in statement:
            statements.append(statement)

    engine = db_session.bind.sync_engine
    event.listen(engine, "before_cursor_execute", capture)
    try:
        result = await SyncService.sync_guest_data(db_session, payload, user.id)
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert result.success and len(statements) == 1
    for wid in ("one", "two"):
        ids = await db_session.scalars(
            select(Exercise.exercise_type_id)
            .where(Exercise.workout_id == result.workoutIdMap[wid])
            .order_by(Exercise.id)
        )
        assert list(ids) == [et.id for et in types]


@pytest.mark.parametrize("reference", ["direct", "external", "missing"])
async def test_unavailable_reference_aborts_import(db_session, reference):
    user = await _seed_user(db_session)
    other = await _seed_user(db_session, "other@example.com")
    private = ExerciseType(name="Private", status="candidate", owner_id=other.id)
    db_session.add(private)
    await db_session.commit()
    ref = str(private.id) if reference == "direct" else "local"
    definitions = (
        [GuestExerciseType(id=ref, name="Private", external_id=str(private.id))]
        if reference == "external"
        else []
    )
    payload = GuestSyncPayload(
        exerciseTypes=definitions,
        workouts=[
            GuestWorkout(
                id="w",
                start_time=datetime.now(timezone.utc),
                workout_type_id="wt",
                exercises=[GuestExercise(id="e", exercise_type_id=ref)],
            )
        ],
    )
    result = await SyncService.sync_guest_data(db_session, payload, user.id)
    assert not result.success
    assert await db_session.scalar(select(func.count()).select_from(Workout)) == 0


@pytest.mark.parametrize("second_key", ["first-key", "fresh-key"])
async def test_concurrent_retries_share_workout(db_session, second_key):
    import asyncio
    from sqlalchemy.ext.asyncio import async_sessionmaker

    user = await _seed_user(db_session)
    user_id = user.id
    await db_session.commit()
    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="guest", start_time=datetime.now(timezone.utc), workout_type_id="wt"
            )
        ]
    )
    sessions = async_sessionmaker(db_session.bind)
    async with sessions() as first, sessions() as second:
        a, b = await asyncio.gather(
            SyncService.sync_guest_data(first, payload, user_id, "first-key"),
            SyncService.sync_guest_data(second, payload, user_id, second_key),
        )
    assert a.success and b.success
    assert a.workoutIdMap == b.workoutIdMap
    assert await db_session.scalar(select(func.count()).select_from(Workout)) == 1
    assert sorted([a.syncedWorkouts, b.syncedWorkouts]) == (
        [1, 1] if second_key == "first-key" else [0, 1]
    )


async def test_legacy_key_replay_is_unconfirmed(db_session):
    from src.sync.models import SyncLog

    user = await _seed_user(db_session)
    user_id = user.id
    db_session.add(
        SyncLog(user_id=user_id, idempotency_key="legacy", synced_workouts=1)
    )
    await db_session.commit()
    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="g", start_time=datetime.now(timezone.utc), workout_type_id="wt"
            )
        ]
    )
    result = await SyncService.sync_guest_data(db_session, payload, user_id, "legacy")
    assert not result.success and result.workoutIdMap == {}
    assert "Cannot confirm" in result.error
    assert await db_session.scalar(select(func.count()).select_from(Workout)) == 0

    # A fresh key imports the workout; the legacy key still can't claim it.
    fresh = await SyncService.sync_guest_data(db_session, payload, user_id, "fresh")
    replay = await SyncService.sync_guest_data(db_session, payload, user_id, "legacy")
    assert fresh.success
    assert not replay.success and replay.workoutIdMap == {}
    assert "Cannot confirm" in replay.error
    assert await db_session.scalar(select(func.count()).select_from(Workout)) == 1


@pytest.mark.parametrize("status", ["candidate", "in_review"])
async def test_second_device_reuses_private_type(db_session, status):
    from src.sync.models import GuestExerciseTypeMapping

    user = await _seed_user(db_session)
    other = await _seed_user(db_session, "other@example.com")
    db_session.add_all(
        [
            ExerciseType(name="Bench", status="released"),
            ExerciseType(name="Bench", status="candidate", owner_id=other.id),
        ]
    )
    await db_session.flush()

    for ref, name in [("device-a", "Bench"), ("device-b", "BENCH")]:
        payload = GuestSyncPayload(
            workouts=[
                GuestWorkout(
                    id=ref,
                    start_time=datetime.now(timezone.utc),
                    workout_type_id="wt",
                    exercises=[GuestExercise(id=ref, exercise_type_id=ref)],
                )
            ],
            exerciseTypes=[GuestExerciseType(id=ref, name=name, description=ref)],
        )
        result = await SyncService.sync_guest_data(db_session, payload, user.id)
        assert result.success, result.error
        private = (
            await db_session.scalars(
                select(ExerciseType).where(ExerciseType.owner_id == user.id)
            )
        ).one()
        if ref == "device-a":
            private.status = status
            await db_session.commit()

    assert (private.name, private.description, private.status) == (
        "Bench",
        "device-a",
        status,
    )
    mappings = await db_session.execute(
        select(
            GuestExerciseTypeMapping.guest_id, GuestExerciseTypeMapping.exercise_type_id
        ).where(GuestExerciseTypeMapping.user_id == user.id)
    )
    assert dict(mappings.all()) == {"device-a": private.id, "device-b": private.id}
    assert list(await db_session.scalars(select(Exercise.exercise_type_id))) == [
        private.id,
        private.id,
    ]


async def test_legacy_seeds_map_to_released_types(db_session):
    user = await _seed_user(db_session)
    squat = ExerciseType(name="Barbell Squat", status="released")
    db_session.add(squat)
    await db_session.flush()
    seed = "Lower body exercise"
    refs = {
        "old-seed": ("Squat", seed),
        "seed": ("Barbell Squat", seed),
        "other-case": ("squat", seed),
        "custom": ("Barbell Squat", "Custom exercise"),
    }
    payload = GuestSyncPayload(
        workouts=[
            GuestWorkout(
                id="g",
                start_time=datetime.now(timezone.utc),
                workout_type_id="wt",
                exercises=[GuestExercise(id=r, exercise_type_id=r) for r in refs],
            )
        ],
        exerciseTypes=[
            GuestExerciseType(id=r, name=n, description=d) for r, (n, d) in refs.items()
        ],
    )
    result = await SyncService.sync_guest_data(db_session, payload, user.id)
    assert result.success
    mapped = dict(
        (
            await db_session.execute(
                select(GuestExerciseTypeMapping.guest_id, ExerciseType.status).join(
                    ExerciseType,
                    GuestExerciseTypeMapping.exercise_type_id == ExerciseType.id,
                )
            )
        ).all()
    )
    # Exact seed definitions, current or pre-#443 name, reuse the released type.
    assert mapped == {
        "old-seed": "released",
        "seed": "released",
        "other-case": "candidate",
        "custom": "candidate",
    }


async def test_idempotency_key_is_bound_to_its_payload(db_session):
    user_id = (await _seed_user(db_session)).id

    def payload(guest_id):
        return GuestSyncPayload(
            workouts=[
                GuestWorkout(
                    id=guest_id,
                    start_time=datetime.now(timezone.utc),
                    workout_type_id="wt",
                )
            ]
        )

    first, second = payload("a"), payload("b")
    a = await SyncService.sync_guest_data(db_session, first, user_id, "key-a")
    b = await SyncService.sync_guest_data(db_session, second, user_id, "key-b")
    assert a.success and b.success

    # Workout B is already mapped, but key A belongs to workout A's request.
    reused = await SyncService.sync_guest_data(db_session, second, user_id, "key-a")
    assert not reused.success and "different request" in reused.error
    assert reused.workoutIdMap == {}

    replay = await SyncService.sync_guest_data(db_session, first, user_id, "key-a")
    assert replay.success and replay.workoutIdMap == a.workoutIdMap
