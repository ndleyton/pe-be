"""add exercise type ownership and release workflow

Revision ID: c4b1a2d3e4f5
Revises: b60b7cbbd60b
Create Date: 2026-04-02 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4b1a2d3e4f5"
down_revision: Union[str, None] = "b60b7cbbd60b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


EXERCISE_TYPE_STATUS = "exercise_type_status"


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _drop_single_column_unique_constraints_on_name(connection) -> None:
    rows = connection.execute(
        sa.text(
            """
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu
              ON tc.constraint_name = ccu.constraint_name
             AND tc.table_schema = ccu.table_schema
            WHERE tc.table_name = 'exercise_types'
              AND tc.constraint_type = 'UNIQUE'
            GROUP BY tc.constraint_name
            HAVING COUNT(*) = 1
               AND MIN(ccu.column_name) = 'name'
            """
        )
    ).fetchall()
    for row in rows:
        op.drop_constraint(row[0], "exercise_types", type_="unique")


def _assert_no_released_name_duplicates(connection) -> None:
    duplicates = connection.execute(
        sa.text(
            """
            SELECT lower(name) AS normalized_name, array_agg(id ORDER BY id) AS ids
            FROM exercise_types
            WHERE status = 'released'
            GROUP BY lower(name)
            HAVING COUNT(*) > 1
            ORDER BY lower(name)
            LIMIT 5
            """
        )
    ).fetchall()
    if duplicates:
        preview = "; ".join(
            f"{row.normalized_name}: {row.ids}" for row in duplicates
        )
        raise RuntimeError(
            "Cannot create released exercise type name uniqueness index because "
            f"case-insensitive duplicates already exist: {preview}"
        )


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = _column_names(inspector, "exercise_types")

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'exercise_type_status'
            ) THEN
                CREATE TYPE exercise_type_status AS ENUM (
                    'candidate',
                    'in_review',
                    'released'
                );
            END IF;
        END
        $$;
        """
    )

    if "owner_id" not in columns:
        op.add_column(
            "exercise_types",
            sa.Column(
                "owner_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )

    if "status" not in columns:
        op.add_column(
            "exercise_types",
            sa.Column(
                "status",
                sa.Enum(
                    "candidate",
                    "in_review",
                    "released",
                    name=EXERCISE_TYPE_STATUS,
                ),
                nullable=False,
                server_default="candidate",
            ),
        )

    if "review_requested_at" not in columns:
        op.add_column(
            "exercise_types",
            sa.Column("review_requested_at", sa.DateTime(timezone=True), nullable=True),
        )

    if "released_at" not in columns:
        op.add_column(
            "exercise_types",
            sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        )

    if "reviewed_by" not in columns:
        op.add_column(
            "exercise_types",
            sa.Column(
                "reviewed_by",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )

    if "review_notes" not in columns:
        op.add_column(
            "exercise_types",
            sa.Column("review_notes", sa.Text(), nullable=True),
        )

    _drop_single_column_unique_constraints_on_name(connection)

    op.execute("DROP INDEX IF EXISTS ix_exercise_types_times_used_name")

    op.execute(
        """
        UPDATE exercise_types
        SET status = 'released',
            released_at = COALESCE(released_at, created_at, now())
        WHERE owner_id IS NULL
        """
    )

    _assert_no_released_name_duplicates(connection)

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_exercise_types_released_times_used_name
        ON exercise_types (times_used DESC, name)
        WHERE status = 'released'
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_exercise_types_owner_status_updated_at_desc
        ON exercise_types (owner_id, status, updated_at DESC)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_exercise_types_in_review_requested_at_desc
        ON exercise_types (review_requested_at DESC)
        WHERE status = 'in_review'
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_types_released_lower_name
        ON exercise_types (lower(name))
        WHERE status = 'released'
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_types_owner_lower_name_nonreleased
        ON exercise_types (owner_id, lower(name))
        WHERE owner_id IS NOT NULL AND status IN ('candidate', 'in_review')
        """
    )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = _column_names(inspector, "exercise_types")

    op.execute("DROP INDEX IF EXISTS uq_exercise_types_owner_lower_name_nonreleased")
    op.execute("DROP INDEX IF EXISTS uq_exercise_types_released_lower_name")
    op.execute("DROP INDEX IF EXISTS ix_exercise_types_in_review_requested_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_exercise_types_owner_status_updated_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_exercise_types_released_times_used_name")
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_exercise_types_times_used_name
        ON exercise_types (times_used DESC, name)
        """
    )

    if "review_notes" in columns:
        op.drop_column("exercise_types", "review_notes")
    if "reviewed_by" in columns:
        op.drop_column("exercise_types", "reviewed_by")
    if "released_at" in columns:
        op.drop_column("exercise_types", "released_at")
    if "review_requested_at" in columns:
        op.drop_column("exercise_types", "review_requested_at")
    if "status" in columns:
        op.drop_column("exercise_types", "status")
    if "owner_id" in columns:
        op.drop_column("exercise_types", "owner_id")

    op.execute(f"DROP TYPE IF EXISTS {EXERCISE_TYPE_STATUS}")
