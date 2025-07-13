"""add unique constraints to name columns

Revision ID: e3f5a7b8c9d1
Revises: c2d4e6f7a8b9
Create Date: 2025-07-13 00:25:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e3f5a7b8c9d1'
down_revision = 'c2d4e6f7a8b9'
branch_labels = None
depends_on = None

def upgrade():
    # Add unique constraints to name columns
    op.create_unique_constraint('uq_intensity_units_name', 'intensity_units', ['name'])
    op.create_unique_constraint('uq_muscle_groups_name', 'muscle_groups', ['name'])
    op.create_unique_constraint('uq_muscles_name', 'muscles', ['name'])


def downgrade():
    # Drop unique constraints
    op.drop_constraint('uq_muscles_name', 'muscles', type_='unique')
    op.drop_constraint('uq_muscle_groups_name', 'muscle_groups', type_='unique')
    op.drop_constraint('uq_intensity_units_name', 'intensity_units', type_='unique') 