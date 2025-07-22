"""remove exercise_types_muscles table

Revision ID: 3d9978befc19
Revises: e3f5a7b8c9d1
Create Date: 2025-07-18 01:46:09.063933

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3d9978befc19'
down_revision: Union[str, None] = 'e3f5a7b8c9d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove the legacy exercise_types_muscles table.
    
    This table is redundant since we now use the exercise_muscles table
    which includes additional fields like is_primary and timestamps.
    """
    # Drop the legacy association table if it exists
    op.execute("DROP TABLE IF EXISTS exercise_types_muscles")


def downgrade() -> None:
    """Recreate the exercise_types_muscles table."""
    # Recreate the table structure
    op.create_table(
        'exercise_types_muscles',
        sa.Column('exercise_type_id', sa.Integer(), nullable=False),
        sa.Column('muscle_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['exercise_type_id'], ['exercise_types.id']),
        sa.ForeignKeyConstraint(['muscle_id'], ['muscles.id']),
        sa.PrimaryKeyConstraint('exercise_type_id', 'muscle_id')
    )
    
    # Migrate data from exercise_muscles back to exercise_types_muscles
    # (Note: This will lose the is_primary information)
    op.execute("""
        INSERT INTO exercise_types_muscles (exercise_type_id, muscle_id)
        SELECT DISTINCT exercise_type_id, muscle_id 
        FROM exercise_muscles
        ON CONFLICT DO NOTHING
    """)
