"""add routine programs

Revision ID: 20260503_0001
Revises: 20260428_0001
Create Date: 2026-05-03 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260503_0001"
down_revision: Union[str, None] = "20260428_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_enum_if_needed() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'routine_program_visibility'
                ) THEN
                    CREATE TYPE routine_program_visibility AS ENUM (
                        'private',
                        'public',
                        'link_only'
                    );
                END IF;
            END
            $$;
            """
        )


def _visibility_enum():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        return postgresql.ENUM(
            "private",
            "public",
            "link_only",
            name="routine_program_visibility",
            create_type=False,
        )
    return sa.Enum(
        "private",
        "public",
        "link_only",
        name="routine_program_visibility",
    )


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = set(inspector.get_table_names())

    _create_enum_if_needed()

    if "routine_programs" not in tables:
        op.create_table(
            "routine_programs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("creator_id", sa.Integer(), nullable=False),
            sa.Column("visibility", _visibility_enum(), nullable=False),
            sa.Column("author", sa.String(), nullable=True),
            sa.Column("category", sa.String(), nullable=True),
            sa.Column("source_label", sa.String(), nullable=True),
            sa.Column(
                "is_readonly",
                sa.Boolean(),
                server_default=sa.text("false"),
                nullable=False,
            ),
            sa.Column(
                "times_used",
                sa.Integer(),
                server_default="0",
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["creator_id"], ["users.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )

    tables = set(sa.inspect(connection).get_table_names())
    if "routine_program_days" not in tables:
        op.create_table(
            "routine_program_days",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("program_id", sa.Integer(), nullable=False),
            sa.Column("routine_id", sa.Integer(), nullable=False),
            sa.Column("day_label", sa.String(length=255), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False),
            sa.Column("week_number", sa.Integer(), nullable=True),
            sa.Column("phase_label", sa.String(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(
                ["program_id"], ["routine_programs.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(["routine_id"], ["recipes.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
        )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_routine_programs_creator_visibility "
        "ON routine_programs (creator_id, visibility)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_routine_programs_creator_created_at_desc "
        "ON routine_programs (creator_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_routine_programs_visibility_created_at_desc "
        "ON routine_programs (visibility, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_routine_programs_category_visibility "
        "ON routine_programs (category, visibility)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_routine_programs_author_visibility "
        "ON routine_programs (author, visibility)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_routine_programs_times_used_desc "
        "ON routine_programs (times_used DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_routine_program_days_program_sort "
        "ON routine_program_days (program_id, sort_order)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_routine_program_days_routine_id "
        "ON routine_program_days (routine_id)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_routine_program_days_program_sort "
        "ON routine_program_days (program_id, sort_order)"
    )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = set(inspector.get_table_names())

    if "routine_program_days" in tables:
        op.drop_table("routine_program_days")

    tables = set(sa.inspect(connection).get_table_names())
    if "routine_programs" in tables:
        op.drop_table("routine_programs")

    if connection.dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS routine_program_visibility")
