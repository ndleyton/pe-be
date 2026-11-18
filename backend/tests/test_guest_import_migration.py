from datetime import datetime, timezone
from pathlib import Path
from runpy import run_path

from alembic.migration import MigrationContext
from alembic.operations import Operations
import pytest
from sqlalchemy import inspect, select

from src.exercise_sets.models import ExerciseSet
from src.exercises.models import Exercise, ExerciseType, IntensityUnit
from src.sync.models import SyncLog
from src.users.models import User
from src.workouts.models import Workout, WorkoutType


@pytest.mark.asyncio(loop_scope="session")
async def test_guest_import_migration_round_trip(db_session):
    user = User(email="migration@example.com", hashed_password="test")
    workout_type = WorkoutType(name="Strength")
    exercise_type = ExerciseType(name="Bench", status="released")
    unit = IntensityUnit(name="Kilograms", abbreviation="kg")
    db_session.add_all([user, workout_type, exercise_type, unit])
    await db_session.flush()
    timestamp = datetime.now(timezone.utc)
    workout = Workout(
        owner_id=user.id, workout_type_id=workout_type.id, start_time=timestamp
    )
    db_session.add(workout)
    await db_session.flush()
    exercise = Exercise(
        workout_id=workout.id, exercise_type_id=exercise_type.id, timestamp=timestamp
    )
    db_session.add(exercise)
    await db_session.flush()
    db_session.add_all(
        [
            ExerciseSet(
                exercise_id=exercise.id, intensity_unit_id=unit.id, reps=8, position=0
            ),
            SyncLog(
                user_id=user.id,
                idempotency_key="old",
                synced_workouts=1,
                synced_exercises=1,
                synced_sets=1,
            ),
        ]
    )
    await db_session.flush()

    migration = run_path(
        str(
            Path(__file__).resolve().parents[1]
            / "alembic/versions/20261117_0001_guest_import_mappings.py"
        )
    )

    def round_trip(connection):
        checks = [
            select(Workout.__table__),
            select(Exercise.__table__),
            select(ExerciseSet.__table__),
            select(
                *(
                    col
                    for col in SyncLog.__table__.columns
                    if col.name != "workout_id_map"
                )
            ),
        ]
        previous = [connection.execute(stmt).all() for stmt in checks]
        with Operations.context(MigrationContext.configure(connection)):
            for direction in ("downgrade", "upgrade", "downgrade", "upgrade"):
                migration[direction]()
                schema = inspect(connection)
                upgraded = direction == "upgrade"
                assert schema.has_table("guest_workout_mappings") == upgraded
                assert schema.has_table("guest_exercise_type_mappings") == upgraded
                assert (
                    "workout_id_map"
                    in {col["name"] for col in schema.get_columns("sync_logs")}
                ) == upgraded
                if upgraded:
                    assert (
                        connection.execute(select(SyncLog.workout_id_map)).scalar_one()
                        is None
                    )
                assert [connection.execute(stmt).all() for stmt in checks] == previous

    await (await db_session.connection()).run_sync(round_trip)
