"""add workout visibility for public reuse

Revision ID: 0f4c6d7e8a9b
Revises: f7a1b2c3d4e5
Create Date: 2026-04-23 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0f4c6d7e8a9b"
down_revision: Union[str, None] = "f7a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


WORKOUT_VISIBILITY_ENUM = sa.Enum("private", "public", name="workout_visibility")
WORKOUTS_PUBLIC_INDEX = "ix_workouts_owner_visibility_end_time_desc"


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "workouts" not in inspector.get_table_names():
        return

    WORKOUT_VISIBILITY_ENUM.create(connection, checkfirst=True)

    columns = {column["name"] for column in inspector.get_columns("workouts")}
    if "visibility" not in columns:
        op.add_column(
            "workouts",
            sa.Column(
                "visibility",
                WORKOUT_VISIBILITY_ENUM,
                nullable=False,
                server_default="private",
            ),
        )

    op.execute("UPDATE workouts SET visibility = 'private' WHERE visibility IS NULL")
    op.alter_column("workouts", "visibility", server_default=None)

    indexes = {index["name"] for index in inspector.get_indexes("workouts")}
    if WORKOUTS_PUBLIC_INDEX not in indexes:
        op.execute(
            f"CREATE INDEX IF NOT EXISTS {WORKOUTS_PUBLIC_INDEX} "
            "ON workouts (owner_id, visibility, end_time DESC)"
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "workouts" not in inspector.get_table_names():
        return

    op.execute(f"DROP INDEX IF EXISTS {WORKOUTS_PUBLIC_INDEX}")

    columns = {column["name"] for column in inspector.get_columns("workouts")}
    if "visibility" in columns:
        op.drop_column("workouts", "visibility")

    WORKOUT_VISIBILITY_ENUM.drop(connection, checkfirst=True)
