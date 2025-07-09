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
    
    connection = op.get_bind()
    
    # 1. Check if we need to fix the primary key (only for existing databases)
    # Check what the current primary key is
    pk_result = connection.execute(sa.text("""
        SELECT array_agg(a.attname ORDER BY a.attnum) as columns
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'oauth_accounts'::regclass AND i.indisprimary
    """))
    current_pk = pk_result.fetchone()
    
    if current_pk and current_pk[0] == ['user_id', 'oauth_name']:
        # We have the old composite primary key, need to fix it
        op.drop_constraint("oauth_accounts_pkey", "oauth_accounts", type_="primary")
        op.create_primary_key("oauth_accounts_pkey", "oauth_accounts", ["id"])
    
    # 2. The unique constraint should already exist from migration 7bb4d09b9169
    # Only add it if it doesn't exist
    constraint_result = connection.execute(sa.text("""
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = 'oauth_accounts' AND constraint_name = 'uq_oauth_accounts_oauth_name_account_id'
    """))
    if not constraint_result.fetchone():
        op.create_unique_constraint("uq_oauth_accounts_oauth_name_account_id", "oauth_accounts", ["oauth_name", "account_id"])
    
    # 3. Add user_id foreign key if it doesn't exist
    user_id_result = connection.execute(sa.text("SELECT column_name FROM information_schema.columns WHERE table_name = 'oauth_accounts' AND column_name = 'user_id'"))
    if not user_id_result.fetchone():
        # Add user_id column if it doesn't exist
        op.add_column("oauth_accounts", sa.Column("user_id", sa.Integer(), nullable=False))
    
    # 4. Ensure the foreign key constraint exists
    fk_result = connection.execute(sa.text("""
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = 'oauth_accounts' AND constraint_name = 'fk_oauth_accounts_user_id'
    """))
    if not fk_result.fetchone():
        op.create_foreign_key("fk_oauth_accounts_user_id", "oauth_accounts", "users", ["user_id"], ["id"], ondelete="CASCADE")
    
    # 5. Fix timestamp columns to use timezone-aware datetime (check current type first)
    timestamp_result = connection.execute(sa.text("""
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'oauth_accounts' AND column_name = 'created_at'
    """))
    current_type = timestamp_result.fetchone()
    
    if current_type and current_type[0] == 'timestamp without time zone':
        # Only alter if we have the wrong type
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
