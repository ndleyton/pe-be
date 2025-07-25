"""add instructions equipment category to exercise_types

Revision ID: 6472d4a8c42f
Revises: 2bafb39426de
Create Date: 2025-07-25 18:39:08.098007

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6472d4a8c42f'
down_revision: Union[str, None] = '2bafb39426de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add instructions column if it doesn't exist
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('exercise_types')]
    
    if 'instructions' not in columns:
        op.add_column('exercise_types', sa.Column('instructions', sa.Text(), nullable=True))
    
    if 'equipment' not in columns:
        op.add_column('exercise_types', sa.Column('equipment', sa.String(), nullable=True))
    
    if 'category' not in columns:
        op.add_column('exercise_types', sa.Column('category', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Drop columns if they exist
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('exercise_types')]
    
    if 'category' in columns:
        op.drop_column('exercise_types', 'category')
    
    if 'equipment' in columns:
        op.drop_column('exercise_types', 'equipment')
    
    if 'instructions' in columns:
        op.drop_column('exercise_types', 'instructions')
