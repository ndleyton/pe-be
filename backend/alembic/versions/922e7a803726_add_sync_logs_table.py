"""add sync logs table

Revision ID: 922e7a803726
Revises: e4f1a6b7c8d9
Create Date: 2026-04-14 01:13:52.466803

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '922e7a803726'
down_revision: Union[str, None] = 'e4f1a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()

    # Guard table creation
    if 'sync_logs' not in tables:
        op.create_table('sync_logs',
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('idempotency_key', sa.String(), nullable=False),
            sa.Column('success', sa.Boolean(), nullable=False),
            sa.Column('synced_workouts', sa.Integer(), nullable=True),
            sa.Column('synced_exercises', sa.Integer(), nullable=True),
            sa.Column('synced_sets', sa.Integer(), nullable=True),
            sa.Column('synced_routines', sa.Integer(), nullable=True),
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'idempotency_key', name='uq_sync_logs_user_idempotency')
        )

    # Guard column alteration for exercise_types.name
    if 'exercise_types' in tables:
        columns = {col["name"]: col for col in inspector.get_columns("exercise_types")}
        if "name" in columns and columns["name"]["nullable"] is True:
            # Ensure no NULL values exist before enforcing NOT NULL
            op.execute("UPDATE exercise_types SET name = 'Unnamed Exercise' WHERE name IS NULL")
            op.alter_column('exercise_types', 'name',
                       existing_type=sa.VARCHAR(),
                       nullable=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()

    # Guard column alteration for exercise_types.name
    if 'exercise_types' in tables:
        columns = {col["name"]: col for col in inspector.get_columns("exercise_types")}
        if "name" in columns and columns["name"]["nullable"] is False:
            op.alter_column('exercise_types', 'name',
                       existing_type=sa.VARCHAR(),
                       nullable=True)

    # Guard table drop
    if 'sync_logs' in tables:
        op.drop_table('sync_logs')
