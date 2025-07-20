"""add_other_workout_type_to_existing

Revision ID: 09175590e760
Revises: 3d9978befc19
Create Date: 2025-07-19 21:43:03.857208

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '09175590e760'
down_revision: Union[str, None] = '3d9978befc19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add 'Other' workout type if it doesn't exist."""
    # Check if 'Other' workout type already exists and add it if not
    op.execute("""
        INSERT INTO workout_types (name, description, created_at, updated_at)
        SELECT 'Other', 'General workout session', NOW(), NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM workout_types WHERE name = 'Other'
        )
    """)


def downgrade() -> None:
    """Remove 'Other' workout type."""
    op.execute("DELETE FROM workout_types WHERE name = 'Other'")
