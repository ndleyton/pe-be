"""add missing created_at and updated_at columns to oauth_accounts

Revision ID: d0ed48d5a1b9
Revises: d598608f5fc4
Create Date: 2025-07-08 20:56:09.374552

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0ed48d5a1b9'
down_revision: Union[str, None] = 'd598608f5fc4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    
    # Add missing timestamp columns to oauth_accounts if they don't exist
    # This handles the case where the table was created by migration without these columns
    timestamp_result = connection.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'oauth_accounts' AND column_name IN ('created_at', 'updated_at')
    """))
    existing_columns = {row[0] for row in timestamp_result.fetchall()}
    
    # Add created_at column if it doesn't exist
    if 'created_at' not in existing_columns:
        op.add_column('oauth_accounts', sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))
    
    # Add updated_at column if it doesn't exist
    if 'updated_at' not in existing_columns:
        op.add_column('oauth_accounts', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    
    # Check if columns exist before dropping them
    timestamp_result = connection.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'oauth_accounts' AND column_name IN ('created_at', 'updated_at')
    """))
    existing_columns = {row[0] for row in timestamp_result.fetchall()}
    
    # Drop columns if they exist
    if 'updated_at' in existing_columns:
        op.drop_column('oauth_accounts', 'updated_at')
    if 'created_at' in existing_columns:
        op.drop_column('oauth_accounts', 'created_at')
