"""add other workout type

Revision ID: a1b2c3d4e5f6
Revises: fix_exercise_types_seq
Create Date: 2025-07-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fix_exercise_types_seq'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add 'Other' workout type."""
    import datetime

    now = datetime.datetime.now(datetime.timezone.utc)

    # Use raw SQL with ON CONFLICT to handle existing records
    op.execute(f"""
        INSERT INTO workout_types (id, name, description, created_at, updated_at)
        VALUES (6, 'Other', 'General workout session', '{now}', '{now}')
        ON CONFLICT (id) DO NOTHING
    """)


def downgrade() -> None:
    """Remove 'Other' workout type."""
    op.execute("DELETE FROM workout_types WHERE id = 6")
