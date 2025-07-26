"""merge migration heads

Revision ID: 660a3f8b29cf
Revises: 6472d4a8c42f, faeb1ea2b3de
Create Date: 2025-07-26 03:26:06.933471

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '660a3f8b29cf'
down_revision: Union[str, None] = ('6472d4a8c42f', 'faeb1ea2b3de')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
