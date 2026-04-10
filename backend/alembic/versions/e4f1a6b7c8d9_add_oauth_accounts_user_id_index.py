"""add oauth_accounts.user_id index

Revision ID: e4f1a6b7c8d9
Revises: add002_duration_seconds_sets, d598608f5fc4
Create Date: 2026-04-09 23:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e4f1a6b7c8d9"
down_revision: Union[str, tuple[str, str], None] = (
    "add002_duration_seconds_sets",
    "d598608f5fc4",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "oauth_accounts" not in inspector.get_table_names():
        return

    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_oauth_accounts_user_id "
            "ON oauth_accounts (user_id)"
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "oauth_accounts" not in inspector.get_table_names():
        return

    op.execute(sa.text("DROP INDEX IF EXISTS ix_oauth_accounts_user_id"))
