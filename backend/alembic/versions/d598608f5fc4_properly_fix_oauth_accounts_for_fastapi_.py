"""properly fix oauth_accounts for fastapi-users v12

Revision ID: d598608f5fc4
Revises: 7bb4d09b9169
Create Date: 2025-07-08 20:00:40.471914

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd598608f5fc4'
down_revision: Union[str, None] = '7bb4d09b9169'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Fix the oauth_accounts table to properly work with FastAPI-Users v12
    
    # 1. Drop the old composite primary key if it exists
    op.drop_constraint("oauth_accounts_pkey", "oauth_accounts", type_="primary")
    
    # 2. Make the id column the primary key (should already exist from previous migration)
    op.create_primary_key("oauth_accounts_pkey", "oauth_accounts", ["id"])
    
    # 3. Ensure we have the required unique constraint
    op.create_unique_constraint("uq_oauth_accounts_oauth_name_account_id", "oauth_accounts", ["oauth_name", "account_id"])
    
    # 4. Add user_id foreign key if it doesn't exist
    # Check the current table structure first
    connection = op.get_bind()
    result = connection.execute(sa.text("SELECT column_name FROM information_schema.columns WHERE table_name = 'oauth_accounts' AND column_name = 'user_id'"))
    if not result.fetchone():
        # Add user_id column if it doesn't exist
        op.add_column("oauth_accounts", sa.Column("user_id", sa.Integer(), nullable=False))
        op.create_foreign_key("fk_oauth_accounts_user_id", "oauth_accounts", "users", ["user_id"], ["id"], ondelete="CASCADE")
    else:
        # Just recreate the foreign key constraint if user_id exists
        op.create_foreign_key("fk_oauth_accounts_user_id", "oauth_accounts", "users", ["user_id"], ["id"], ondelete="CASCADE")
    
    # 5. Fix timestamp columns to use timezone-aware datetime
    op.alter_column('oauth_accounts', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('oauth_accounts', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))


def downgrade() -> None:
    """Downgrade schema."""
    # Reverse timestamp column changes
    op.alter_column('oauth_accounts', 'updated_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('oauth_accounts', 'created_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    
    # Reverse other changes
    op.drop_constraint("fk_oauth_accounts_user_id", "oauth_accounts", type_="foreignkey")
    op.drop_constraint("uq_oauth_accounts_oauth_name_account_id", "oauth_accounts", type_="unique")
    op.drop_constraint("oauth_accounts_pkey", "oauth_accounts", type_="primary")
    op.create_primary_key("oauth_accounts_pkey", "oauth_accounts", ["user_id", "oauth_name"])
