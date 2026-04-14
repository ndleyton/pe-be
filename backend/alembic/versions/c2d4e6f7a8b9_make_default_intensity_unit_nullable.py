"""make default_intensity_unit nullable

Revision ID: c2d4e6f7a8b9
Revises: b1c34d5e6f7b
Create Date: 2025-07-13 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c2d4e6f7a8b9"
down_revision = "b1c34d5e6f7b"
branch_labels = None
depends_on = None


def upgrade():
    # Alter column to be nullable and drop default
    op.alter_column(
        "exercise_types",
        "default_intensity_unit",
        existing_type=sa.Integer(),
        nullable=True,
        server_default=None,
    )


def downgrade():
    # Revert column to NOT NULL with default 1 (matches original state)
    op.alter_column(
        "exercise_types",
        "default_intensity_unit",
        existing_type=sa.Integer(),
        nullable=False,
        server_default="1",
    )
