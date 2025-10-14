"""add is_primary column to exercise_muscles

Revision ID: b1c34d5e6f7b
Revises: 148a1c691036
Create Date: 2025-07-13 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b1c34d5e6f7b'
down_revision = '148a1c691036'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('exercise_muscles', sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'))
    op.alter_column('exercise_muscles', 'is_primary', server_default=None)


def downgrade():
    op.drop_column('exercise_muscles', 'is_primary')
