"""add workout photos

Revision ID: 20260514_0001
Revises: 5b870c040f55
Create Date: 2026-05-14 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260514_0001"
down_revision: Union[str, None] = "5b870c040f55"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = set(inspector.get_table_names())

    if "workout_photos" not in tables:
        op.create_table(
            "workout_photos",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("workout_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("storage_key", sa.String(length=512), nullable=False),
            sa.Column("mime_type", sa.String(length=100), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("width", sa.Integer(), nullable=True),
            sa.Column("height", sa.Integer(), nullable=True),
            sa.Column("sha256", sa.String(length=64), nullable=False),
            sa.Column("original_filename", sa.String(length=255), nullable=True),
            sa.Column(
                "is_primary",
                sa.Boolean(),
                server_default=sa.text("true"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(
                ["workout_id"], ["workouts.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("storage_key"),
        )

    tables = set(sa.inspect(connection).get_table_names())
    if "workout_photos" in tables:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_workout_photos_workout_id_is_primary
            ON workout_photos (workout_id, is_primary)
            """
        )
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_workout_photos_user_id
            ON workout_photos (user_id)
            """
        )
        op.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_photos_one_active_primary
            ON workout_photos (workout_id)
            WHERE is_primary = true AND deleted_at IS NULL
            """
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = set(inspector.get_table_names())

    if "workout_photos" in tables:
        op.execute("DROP INDEX IF EXISTS uq_workout_photos_one_active_primary")
        op.execute("DROP INDEX IF EXISTS ix_workout_photos_user_id")
        op.execute("DROP INDEX IF EXISTS ix_workout_photos_workout_id_is_primary")
        op.drop_table("workout_photos")
