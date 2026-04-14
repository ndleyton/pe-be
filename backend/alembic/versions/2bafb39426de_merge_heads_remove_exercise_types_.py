"""merge heads: remove_exercise_types_muscles and add_other_workout_type

Revision ID: 2bafb39426de
Revises: 3d9978befc19, a1b2c3d4e5f6
Create Date: 2025-07-23 18:12:44.658463

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "2bafb39426de"
down_revision: Union[str, None] = ("3d9978befc19", "a1b2c3d4e5f6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
