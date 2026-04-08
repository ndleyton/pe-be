"""add duration_seconds to set tables

Revision ID: add002_add_duration_seconds_to_sets
Revises: add001_exercise_template_notes
Create Date: 2026-04-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add002_add_duration_seconds_to_sets"
down_revision: Union[str, None] = "add001_exercise_template_notes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _backfill_duration_from_legacy_reps(table_name: str) -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            f"""
            UPDATE {table_name}
            SET duration_seconds = reps * 60
            WHERE duration_seconds IS NULL
              AND reps IS NOT NULL
              AND intensity_unit_id IN (
                  SELECT id
                  FROM intensity_units
                  WHERE lower(name) = 'time-based'
                     OR lower(abbreviation) = 'time'
              )
            """
        )
    )


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    for table_name in ("exercise_sets", "set_templates"):
        if table_name not in inspector.get_table_names():
            continue

        columns = _column_names(inspector, table_name)
        if "duration_seconds" not in columns:
            op.add_column(
                table_name,
                sa.Column("duration_seconds", sa.Integer(), nullable=True),
            )
        _backfill_duration_from_legacy_reps(table_name)


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    for table_name in ("exercise_sets", "set_templates"):
        if table_name not in inspector.get_table_names():
            continue
        columns = _column_names(inspector, table_name)
        if "duration_seconds" in columns:
            op.drop_column(table_name, "duration_seconds")
