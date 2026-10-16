import importlib.util
from pathlib import Path

import pytest
import pytest_asyncio
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


spec = importlib.util.spec_from_file_location(
    "migration_20261012_0001",
    Path(__file__).resolve().parents[1]
    / "alembic/versions/20261012_0001_normalize_muscle_taxonomy.py",
)
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


def run_upgrade(connection):
    with Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()


@pytest_asyncio.fixture
async def migration_connection(db_session):
    connection = await db_session.connection()
    # Rollback removes the schema and leaves application tables untouched.
    await connection.execute(sa.text("CREATE SCHEMA muscle_taxonomy_migration_test"))
    await connection.execute(
        sa.text("SET LOCAL search_path TO muscle_taxonomy_migration_test")
    )
    for statement in (
        "CREATE TABLE muscles (id INTEGER PRIMARY KEY, name TEXT UNIQUE)",
        """CREATE TABLE exercise_types (
            id INTEGER PRIMARY KEY, name TEXT, category TEXT, equipment TEXT
        )""",
        """CREATE TABLE exercise_muscles (
            exercise_type_id INTEGER NOT NULL REFERENCES exercise_types(id),
            muscle_id INTEGER NOT NULL REFERENCES muscles(id) ON DELETE CASCADE,
            is_primary BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL,
            UNIQUE (exercise_type_id, muscle_id)
        )""",
    ):
        await connection.execute(sa.text(statement))
    return connection


@pytest.mark.asyncio
async def test_merge_preserves_assignments_and_primary_flags(migration_connection):
    connection = migration_connection
    await connection.execute(
        sa.text("INSERT INTO muscles VALUES (1, 'triceps'), (2, 'Triceps')")
    )
    await connection.execute(
        sa.text(
            "INSERT INTO exercise_types (id, name) VALUES (1, 'A'), (2, 'B'), (3, 'C'), (4, 'D')"
        )
    )
    await connection.execute(
        sa.text("""INSERT INTO exercise_muscles VALUES
            (1, 1, FALSE, now(), now()), (1, 2, TRUE, now(), now()),
            (2, 1, TRUE, now(), now()), (2, 2, FALSE, now(), now()),
            (3, 2, TRUE, now(), now()), (4, 2, FALSE, now(), now())
        """)
    )

    for _ in range(2):
        await connection.run_sync(run_upgrade)
        assert (
            await connection.execute(sa.text("SELECT id, name FROM muscles"))
        ).all() == [(1, "triceps")]
        rows = await connection.execute(
            sa.text(
                "SELECT exercise_type_id, muscle_id, is_primary FROM exercise_muscles ORDER BY exercise_type_id"
            )
        )
        assert rows.all() == [(1, 1, True), (2, 1, True), (3, 1, True), (4, 1, False)]


@pytest.mark.asyncio
async def test_rename_preserves_muscle_id_and_relationship(migration_connection):
    connection = migration_connection
    await connection.execute(sa.text("INSERT INTO muscles VALUES (2, 'Triceps')"))
    await connection.execute(
        sa.text("INSERT INTO exercise_types (id, name) VALUES (1, 'A')")
    )
    await connection.execute(
        sa.text("INSERT INTO exercise_muscles VALUES (1, 2, TRUE, now(), now())")
    )
    for _ in range(2):
        await connection.run_sync(run_upgrade)
        assert (
            await connection.execute(sa.text("SELECT id, name FROM muscles"))
        ).all() == [(2, "triceps")]
        assert (
            await connection.execute(
                sa.text(
                    "SELECT exercise_type_id, muscle_id, is_primary FROM exercise_muscles"
                )
            )
        ).all() == [(1, 2, True)]


@pytest.mark.asyncio
async def test_backfill_preserves_existing_primary_and_is_idempotent(
    migration_connection,
):
    connection = migration_connection
    await connection.execute(
        sa.text("""INSERT INTO muscles VALUES
            (1, 'quadriceps'), (2, 'glutes'), (3, 'hamstrings'), (4, 'adductors')""")
    )
    await connection.execute(
        sa.text("""INSERT INTO exercise_types VALUES
            (1, 'Bulgarian Split Squats', 'Strength', 'Dumbbell'),
            (2, 'Walking Lunges', NULL, NULL),
            (3, 'Leg Curls', 'strength', 'machine')""")
    )
    await connection.execute(
        sa.text("INSERT INTO exercise_muscles VALUES (2, 2, TRUE, now(), now())")
    )

    for _ in range(2):
        await connection.run_sync(run_upgrade)
        rows = await connection.execute(
            sa.text(
                "SELECT exercise_type_id, muscle_id, is_primary FROM exercise_muscles ORDER BY exercise_type_id, muscle_id"
            )
        )
        assert rows.all() == [
            (1, 1, True),
            (1, 2, False),
            (1, 3, False),
            (1, 4, False),
            (2, 2, True),
            (2, 3, False),
            (3, 3, True),
        ]
        assert (
            await connection.execute(
                sa.text(
                    "SELECT id, category, equipment FROM exercise_types ORDER BY id"
                )
            )
        ).all() == [
            (1, "strength", "dumbbell"),
            (2, None, None),
            (3, "strength", "machine"),
        ]
