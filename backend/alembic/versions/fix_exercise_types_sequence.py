"""fix exercise_types sequence

Revision ID: fix_exercise_types_seq
Revises: 16318a1cf2bd
Create Date: 2025-06-16 03:40:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "fix_exercise_types_seq"
down_revision: Union[str, None] = "f3c08cf533ff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix the exercise_types sequence to start after existing records."""
    # Get the maximum ID from exercise_types table and update the sequence
    op.execute(
        "SELECT setval(pg_get_serial_sequence('exercise_types', 'id'), COALESCE(MAX(id), 1)) FROM exercise_types;"
    )


def downgrade() -> None:
    """Reset the sequence to 1."""
    op.execute("SELECT setval(pg_get_serial_sequence('exercise_types', 'id'), 1);")
