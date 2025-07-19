"""add other workout type

Revision ID: a1b2c3d4e5f6
Revises: fix_exercise_types_seq
Create Date: 2025-07-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fix_exercise_types_seq'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add 'Other' workout type."""
    from sqlalchemy.sql import table, column
    import datetime

    # Workout Types
    workout_type_table = table(
        'workout_types',
        column('id', sa.Integer),
        column('name', sa.String),
        column('description', sa.String),
        column('created_at', sa.DateTime),
        column('updated_at', sa.DateTime),
    )
    
    now = datetime.datetime.now()
    op.bulk_insert(
        workout_type_table,
        [
            {'id': 6, 'name': 'Other', 'description': 'General workout session', 'created_at': now, 'updated_at': now},
        ]
    )


def downgrade() -> None:
    """Remove 'Other' workout type."""
    op.execute("DELETE FROM workout_types WHERE id = 6")