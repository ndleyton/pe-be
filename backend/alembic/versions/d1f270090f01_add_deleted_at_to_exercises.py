"""add_deleted_at_to_exercises

Revision ID: d1f270090f01
Revises: cb93f7d5492e
Create Date: 2025-08-30 20:20:28.161674

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1f270090f01'
down_revision: Union[str, None] = 'cb93f7d5492e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add deleted_at column idempotently
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('exercises')]
    
    if 'deleted_at' not in columns:
        op.add_column('exercises', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Drop deleted_at column idempotently
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('exercises')]
    
    if 'deleted_at' in columns:
        op.drop_column('exercises', 'deleted_at')
