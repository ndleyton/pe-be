"""add oauth_accounts.user_id index

Revision ID: e4f1a6b7c8d9
Revises: 148a1c691036
Create Date: 2026-04-09 23:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e4f1a6b7c8d9"
down_revision: Union[str, None] = "148a1c691036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "oauth_accounts" not in inspector.get_table_names():
        return

    indexes = {index["name"] for index in inspector.get_indexes("oauth_accounts")}
    if "ix_oauth_accounts_user_id" not in indexes:
        op.create_index(
            "ix_oauth_accounts_user_id",
            "oauth_accounts",
            ["user_id"],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "oauth_accounts" not in inspector.get_table_names():
        return

    indexes = {index["name"] for index in inspector.get_indexes("oauth_accounts")}
    if "ix_oauth_accounts_user_id" in indexes:
        op.drop_index("ix_oauth_accounts_user_id", table_name="oauth_accounts")
