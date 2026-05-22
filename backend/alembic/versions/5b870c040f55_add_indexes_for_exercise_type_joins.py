"""add indexes for exercise type joins

Revision ID: 5b870c040f55
Revises: 20260503_0001
Create Date: 2026-05-11 01:12:50.245917

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5b870c040f55'
down_revision: Union[str, None] = '20260503_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Index on muscles.muscle_group_id
    op.execute("CREATE INDEX IF NOT EXISTS ix_muscles_muscle_group_id ON muscles (muscle_group_id)")
    # Index on exercise_muscles.exercise_type_id
    op.execute("CREATE INDEX IF NOT EXISTS ix_exercise_muscles_exercise_type_id ON exercise_muscles (exercise_type_id)")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_muscles_muscle_group_id")
    op.execute("DROP INDEX IF EXISTS ix_exercise_muscles_exercise_type_id")
