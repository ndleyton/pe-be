"""alter_workout_start_end_time_to_timestamptz

Revision ID: 16318a1cf2bd
Revises: a4a2341f82ad
Create Date: 2025-05-07 18:26:43.335893

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '16318a1cf2bd'
down_revision: Union[str, None] = 'a4a2341f82ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('workouts', 'start_time',
               existing_type=postgresql.TIMESTAMP(), # or sa.DateTime()
               type_=sa.DateTime(timezone=True),
               existing_nullable=True)
    op.alter_column('workouts', 'end_time',
               existing_type=postgresql.TIMESTAMP(), # or sa.DateTime()
               type_=sa.DateTime(timezone=True),
               existing_nullable=True)

def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('workouts', 'end_time',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(), # or sa.DateTime()
               existing_nullable=True)
    op.alter_column('workouts', 'start_time',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(), # or sa.DateTime()
               existing_nullable=True)
