"""add times_used to exercise_types

Revision ID: c9de8cd9d9f6
Revises: fix_exercise_types_seq
Create Date: 2025-06-17 23:09:29.068514

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9de8cd9d9f6'
down_revision: Union[str, None] = 'fix_exercise_types_seq'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add times_used column to exercise_types table with default value 0
    op.add_column('exercise_types', sa.Column('times_used', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove times_used column from exercise_types table
    op.drop_column('exercise_types', 'times_used')
