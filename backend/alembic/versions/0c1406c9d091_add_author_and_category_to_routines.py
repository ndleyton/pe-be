"""Add author and category to routines

Revision ID: 0c1406c9d091
Revises: 7d64e35ced2d
Create Date: 2026-04-15 18:38:32.842975

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0c1406c9d091'
down_revision: Union[str, None] = '7d64e35ced2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col["name"] for col in inspector.get_columns("recipes")]

    if "author" not in columns:
        op.add_column('recipes', sa.Column('author', sa.String(), nullable=True))
    if "category" not in columns:
        op.add_column('recipes', sa.Column('category', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col["name"] for col in inspector.get_columns("recipes")]

    if "category" in columns:
        op.drop_column('recipes', 'category')
    if "author" in columns:
        op.drop_column('recipes', 'author')
