"""Add notes and type columns to exercise_set table

Revision ID: faeb1ea2b3de
Revises: 2bafb39426de
Create Date: 2025-07-23 21:39:55.450807

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'faeb1ea2b3de'
down_revision: Union[str, None] = '2bafb39426de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add notes column (text type) to exercise_sets table
    op.add_column('exercise_sets', sa.Column('notes', sa.Text(), nullable=True))
    
    # Add type column (varchar type) to exercise_sets table for enum values
    op.add_column('exercise_sets', sa.Column('type', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove the added columns in reverse order
    op.drop_column('exercise_sets', 'type')
    op.drop_column('exercise_sets', 'notes')
