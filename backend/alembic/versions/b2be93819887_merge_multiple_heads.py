"""Merge multiple heads

Revision ID: b2be93819887
Revises: 1f4d2c8b9a10, 3c4d5e6f7a8b
Create Date: 2026-03-31 14:58:54.728050

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'b2be93819887'
down_revision: Union[str, None] = ('1f4d2c8b9a10', '3c4d5e6f7a8b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
