"""properly fix oauth_accounts for fastapi-users v12

Revision ID: d598608f5fc4
Revises: 7bb4d09b9169
Create Date: 2025-07-08 20:00:40.471914

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


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
    
    # 4. Ensure the foreign key constraint exists (check for any FK from user_id to users.id)
    fk_result = connection.execute(sa.text("""
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'oauth_accounts' 
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'user_id'
        AND ccu.table_name = 'users'
        AND ccu.column_name = 'id'
    """))
    if not fk_result.fetchone():
        op.create_foreign_key("fk_oauth_accounts_user_id", "oauth_accounts", "users", ["user_id"], ["id"], ondelete="CASCADE")
    
    # Note: Timestamp columns are handled by separate migration d0ed48d5a1b9


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    
    # Note: Timestamp columns are handled by separate migration d0ed48d5a1b9
    
    # Drop our foreign key constraint if it exists
    fk_result = connection.execute(sa.text("""
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = 'oauth_accounts' AND constraint_name = 'fk_oauth_accounts_user_id'
    """))
    if fk_result.fetchone():
        op.drop_constraint("fk_oauth_accounts_user_id", "oauth_accounts", type_="foreignkey")
    
    # Drop unique constraint if it exists
    constraint_result = connection.execute(sa.text("""
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = 'oauth_accounts' AND constraint_name = 'uq_oauth_accounts_oauth_name_account_id'
    """))
    if constraint_result.fetchone():
        op.drop_constraint("uq_oauth_accounts_oauth_name_account_id", "oauth_accounts", type_="unique")
    
    # Only change primary key if it's currently set to 'id'
    pk_result = connection.execute(sa.text("""
        SELECT array_agg(a.attname ORDER BY a.attnum) as columns
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'oauth_accounts'::regclass AND i.indisprimary
    """))
    current_pk = pk_result.fetchone()
    
    if current_pk and current_pk[0] == ['id']:
        op.drop_constraint("oauth_accounts_pkey", "oauth_accounts", type_="primary")
        op.create_primary_key("oauth_accounts_pkey", "oauth_accounts", ["user_id", "oauth_name"])
