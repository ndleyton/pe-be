"""update_canonical_exercise_names

Revision ID: 3a6db27a297a
Revises: 20260514_0001
Create Date: 2026-06-21 21:48:02.680116

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a6db27a297a'
down_revision: Union[str, None] = '20260514_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    connection.execute(
        sa.text("""
            UPDATE exercise_types
            SET name = 'Barbell Squat'
            WHERE id = 2 AND name = 'Squat'
            AND NOT EXISTS (
                SELECT 1 FROM exercise_types
                WHERE lower(name) = 'barbell squat' AND status = 'released' AND id != 2
            )
        """)
    )
    connection.execute(
        sa.text("""
            UPDATE exercise_types
            SET name = 'Barbell Deadlift'
            WHERE id = 3 AND name = 'Deadlift'
            AND NOT EXISTS (
                SELECT 1 FROM exercise_types
                WHERE lower(name) = 'barbell deadlift' AND status = 'released' AND id != 3
            )
        """)
    )


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    connection.execute(
        sa.text("""
            UPDATE exercise_types
            SET name = 'Squat'
            WHERE id = 2 AND name = 'Barbell Squat'
            AND NOT EXISTS (
                SELECT 1 FROM exercise_types
                WHERE lower(name) = 'squat' AND status = 'released' AND id != 2
            )
        """)
    )
    connection.execute(
        sa.text("""
            UPDATE exercise_types
            SET name = 'Deadlift'
            WHERE id = 3 AND name = 'Barbell Deadlift'
            AND NOT EXISTS (
                SELECT 1 FROM exercise_types
                WHERE lower(name) = 'deadlift' AND status = 'released' AND id != 3
            )
        """)
    )
