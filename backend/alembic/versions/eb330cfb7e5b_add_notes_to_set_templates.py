"""add notes to set_templates

Revision ID: eb330cfb7e5b
Revises: 0c1406c9d091
Create Date: 2026-04-16 18:44:20.168470

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eb330cfb7e5b'
down_revision: Union[str, None] = '0c1406c9d091'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()

    if "set_templates" in tables:
        columns = [col["name"] for col in inspector.get_columns("set_templates")]
        if "notes" not in columns:
            op.add_column("set_templates", sa.Column("notes", sa.Text(), nullable=True))
        if "type" not in columns:
            op.add_column("set_templates", sa.Column("type", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()

    if "set_templates" in tables:
        columns = [col["name"] for col in inspector.get_columns("set_templates")]
        if "type" in columns:
            op.drop_column("set_templates", "type")
        if "notes" in columns:
            op.drop_column("set_templates", "notes")
