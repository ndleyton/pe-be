"""Change intensity column to Numeric(7,3)

Revision ID: cb93f7d5492e
Revises: 8fe769cc294e
Create Date: 2025-08-29 18:39:38.657423

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cb93f7d5492e'
down_revision: Union[str, None] = '8fe769cc294e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Check if column needs to be converted to NUMERIC(7,3)
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = inspector.get_columns('exercise_sets')
    intensity_col = next((col for col in columns if col['name'] == 'intensity'), None)
    
    if intensity_col:
        # Check if column is already NUMERIC(7,3)
        col_type = str(intensity_col['type']).upper()
        if 'NUMERIC(7,3)' not in col_type and 'DECIMAL(7,3)' not in col_type:
            op.execute("ALTER TABLE exercise_sets ALTER COLUMN intensity TYPE NUMERIC(7,3) USING intensity::NUMERIC(7,3)")
    else:
        # Column doesn't exist, this shouldn't happen but add for safety
        raise Exception("intensity column not found in exercise_sets table")


def downgrade() -> None:
    """Downgrade schema."""
    # Check if column needs to be converted back to DOUBLE PRECISION
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = inspector.get_columns('exercise_sets')
    intensity_col = next((col for col in columns if col['name'] == 'intensity'), None)
    
    if intensity_col:
        # Check if column is currently NUMERIC(7,3) and needs to be reverted
        col_type = str(intensity_col['type']).upper()
        if 'NUMERIC(7,3)' in col_type or 'DECIMAL(7,3)' in col_type:
            op.execute("ALTER TABLE exercise_sets ALTER COLUMN intensity TYPE DOUBLE PRECISION USING intensity::DOUBLE PRECISION")
    else:
        # Column doesn't exist, this shouldn't happen but add for safety
        raise Exception("intensity column not found in exercise_sets table")
