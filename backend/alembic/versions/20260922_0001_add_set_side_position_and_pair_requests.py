"""add set side, persisted order, and pair request idempotency

Revision ID: 20260922_0001
Revises: 20260902_0001
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260922_0001"
down_revision: Union[str, None] = "20260902_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def _checks(inspector: sa.Inspector, table: str) -> set[str]:
    return {constraint["name"] for constraint in inspector.get_check_constraints(table)}


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    for table in ("exercise_sets", "set_templates"):
        columns = _columns(inspector, table)
        if "side" not in columns:
            op.add_column(table, sa.Column("side", sa.String(), nullable=True))
        if "position" not in columns:
            op.add_column(table, sa.Column("position", sa.Integer(), nullable=True))
        inspector = sa.inspect(connection)

    op.execute(
        """
        WITH ranked AS (
            SELECT id, row_number() OVER (
                PARTITION BY exercise_id ORDER BY created_at, id
            ) - 1 AS new_position
            FROM exercise_sets
        )
        UPDATE exercise_sets AS target
        SET position = ranked.new_position
        FROM ranked
        WHERE target.id = ranked.id AND target.position IS NULL
        """
    )
    op.execute(
        """
        WITH ranked AS (
            SELECT id, row_number() OVER (
                PARTITION BY exercise_template_id ORDER BY id
            ) - 1 AS new_position
            FROM set_templates
        )
        UPDATE set_templates AS target
        SET position = ranked.new_position
        FROM ranked
        WHERE target.id = ranked.id AND target.position IS NULL
        """
    )

    inspector = sa.inspect(connection)
    checks = _checks(inspector, "exercise_sets")
    if "ck_exercise_sets_side" not in checks:
        op.create_check_constraint(
            "ck_exercise_sets_side",
            "exercise_sets",
            "side IS NULL OR side IN ('left', 'right', 'both')",
        )
    if "ck_exercise_sets_position" not in checks:
        op.create_check_constraint(
            "ck_exercise_sets_position", "exercise_sets", "position >= 0"
        )

    checks = _checks(sa.inspect(connection), "set_templates")
    if "ck_set_templates_side" not in checks:
        op.create_check_constraint(
            "ck_set_templates_side",
            "set_templates",
            "side IS NULL OR side IN ('left', 'right', 'both')",
        )
    if "ck_set_templates_position" not in checks:
        op.create_check_constraint(
            "ck_set_templates_position", "set_templates", "position >= 0"
        )

    op.alter_column("exercise_sets", "position", nullable=False)
    op.alter_column("set_templates", "position", nullable=False)
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_sets_active_position
        ON exercise_sets (exercise_id, position)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_set_templates_position
        ON set_templates (exercise_template_id, position)
        """
    )

    if "exercise_set_creation_requests" not in sa.inspect(connection).get_table_names():
        op.create_table(
            "exercise_set_creation_requests",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("operation", sa.String(length=64), nullable=False),
            sa.Column("idempotency_key", sa.String(length=128), nullable=False),
            sa.Column("request_hash", sa.String(length=64), nullable=False),
            sa.Column("result_payload", postgresql.JSONB(), nullable=True),
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id",
                "operation",
                "idempotency_key",
                name="uq_exercise_set_creation_user_operation_key",
            ),
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    if "exercise_set_creation_requests" in inspector.get_table_names():
        op.drop_table("exercise_set_creation_requests")

    op.execute("DROP INDEX IF EXISTS uq_set_templates_position")
    op.execute("DROP INDEX IF EXISTS uq_exercise_sets_active_position")

    inspector = sa.inspect(connection)
    for table, checks in (
        ("set_templates", ("ck_set_templates_position", "ck_set_templates_side")),
        ("exercise_sets", ("ck_exercise_sets_position", "ck_exercise_sets_side")),
    ):
        present = _checks(inspector, table)
        for check in checks:
            if check in present:
                op.drop_constraint(check, table, type_="check")
        columns = _columns(sa.inspect(connection), table)
        if "position" in columns:
            op.drop_column(table, "position")
        if "side" in columns:
            op.drop_column(table, "side")
