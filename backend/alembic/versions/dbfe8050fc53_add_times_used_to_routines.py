"""add times_used to routines

Revision ID: dbfe8050fc53
Revises: eb330cfb7e5b
Create Date: 2026-04-20 00:04:29.574519

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dbfe8050fc53'
down_revision: Union[str, None] = 'eb330cfb7e5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col["name"] for col in inspector.get_columns("recipes")]

    if "times_used" not in columns:
        op.add_column('recipes', sa.Column('times_used', sa.Integer(), server_default='0', nullable=False))

    op.execute("CREATE INDEX IF NOT EXISTS ix_recipes_times_used_desc ON recipes (times_used DESC)")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_recipes_times_used_desc")

    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col["name"] for col in inspector.get_columns("recipes")]

    if "times_used" in columns:
        op.drop_column('recipes', 'times_used')
