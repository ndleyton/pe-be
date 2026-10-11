import importlib.util
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


spec = importlib.util.spec_from_file_location(
    "migration_20261009_0001",
    Path(__file__).resolve().parents[1]
    / "alembic/versions/20261009_0001_fix_active_upload_hash_index.py",
)
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


@pytest.mark.asyncio
async def test_downgrade_accepts_duplicate_generated_hashes_and_preserves_uploads(
    db_session,
):
    connection = await db_session.connection()
    # Isolate the migration from the application's tables; rollback removes this schema.
    await connection.execute(sa.text("CREATE SCHEMA upload_hash_migration_test"))
    await connection.execute(
        sa.text("SET LOCAL search_path TO upload_hash_migration_test")
    )
    await connection.execute(
        sa.text(
            """
            CREATE TABLE exercise_image_candidates (
                id INTEGER PRIMARY KEY,
                exercise_type_id INTEGER NOT NULL,
                asset_kind VARCHAR(64) NOT NULL,
                status VARCHAR(32) NOT NULL,
                sha256 VARCHAR(64)
            )
            """
        )
    )

    def run_migration(sync_connection, direction):
        with Operations.context(MigrationContext.configure(sync_connection)):
            direction()

    await connection.run_sync(run_migration, migration.upgrade)
    await connection.execute(
        sa.text(
            """
            INSERT INTO exercise_image_candidates VALUES
                (1, 10, 'generated_candidate', 'active', 'same-generated-hash'),
                (2, 10, 'generated_candidate', 'active', 'same-generated-hash'),
                (3, 10, 'uploaded_reference', 'active', 'upload-hash'),
                (4, 10, 'generated_candidate', 'promoted', 'promoted-hash')
            """
        )
    )
    await connection.run_sync(run_migration, migration.downgrade)

    rows = await connection.execute(
        sa.text("SELECT id, sha256 FROM exercise_image_candidates ORDER BY id")
    )
    assert rows.all() == [
        (1, None),
        (2, None),
        (3, "upload-hash"),
        (4, "promoted-hash"),
    ]
    with pytest.raises(sa.exc.IntegrityError):
        async with connection.begin_nested():
            await connection.execute(
                sa.text(
                    """
                    INSERT INTO exercise_image_candidates VALUES
                        (5, 10, 'uploaded_reference', 'active', 'upload-hash')
                    """
                )
            )
    await connection.run_sync(run_migration, migration.upgrade)
