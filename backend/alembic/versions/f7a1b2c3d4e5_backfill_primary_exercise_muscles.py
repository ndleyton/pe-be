"""backfill primary exercise_muscles rows

Revision ID: f7a1b2c3d4e5
Revises: dbfe8050fc53
Create Date: 2026-04-21 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7a1b2c3d4e5"
down_revision: Union[str, None] = "dbfe8050fc53"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "exercise_muscles" not in inspector.get_table_names():
        return

    columns = {
        column["name"] for column in inspector.get_columns("exercise_muscles")
    }
    required_columns = {"id", "exercise_type_id", "is_primary", "created_at"}
    if not required_columns.issubset(columns):
        return

    op.execute(
        """
        WITH ranked_rows AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY exercise_type_id
                    ORDER BY created_at ASC, id ASC
                ) AS row_number,
                BOOL_OR(is_primary) OVER (
                    PARTITION BY exercise_type_id
                ) AS has_primary
            FROM exercise_muscles
        )
        UPDATE exercise_muscles AS exercise_muscles_to_update
        SET is_primary = TRUE
        FROM ranked_rows
        WHERE exercise_muscles_to_update.id = ranked_rows.id
          AND ranked_rows.row_number = 1
          AND ranked_rows.has_primary = FALSE
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Data backfill is intentionally left in place.
    return
