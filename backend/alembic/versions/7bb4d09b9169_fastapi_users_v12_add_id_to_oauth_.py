"""FastAPI-Users v12 – add id to oauth_accounts

Revision ID: 7bb4d09b9169
Revises: d559e60121f4
Create Date: 2025-07-08 15:53:47.569081

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7bb4d09b9169'
down_revision: Union[str, None] = '8130ebb5cf0a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("oauth_accounts_pkey", "oauth_accounts", type_="primary")
    op.add_column("oauth_accounts", sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True))
    op.create_primary_key("pk_oauth_accounts_id", "oauth_accounts", ["id"])
    op.create_unique_constraint("uq_oauth_accounts_oauth_name_account_id", "oauth_accounts", ["oauth_name", "account_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_oauth_accounts_oauth_name_account_id", "oauth_accounts", type_="unique")
    op.drop_constraint("pk_oauth_accounts_id", "oauth_accounts", type_="primary")
    op.drop_column("oauth_accounts", "id")
    op.create_primary_key("oauth_accounts_pkey", "oauth_accounts", ["user_id", "oauth_name"])
