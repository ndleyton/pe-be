"""add visibility enum + readonly flag to recipes and index

Revision ID: b9a1c2d3e4f5
Revises: d1f270090f01
Create Date: 2025-10-14 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b9a1c2d3e4f5"
down_revision: Union[str, None] = "d1f270090f01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add recipe_visibility enum, visibility column, is_readonly, and composite index."""
    op.execute("CREATE TYPE recipe_visibility AS ENUM ('private','public','link_only')")

    # Add columns with server defaults to backfill existing rows
    op.add_column(
        "recipes",
        sa.Column(
            "visibility",
            sa.Enum("private", "public", "link_only", name="recipe_visibility"),
            server_default="private",
            nullable=False,
        ),
    )
    op.add_column(
        "recipes",
        sa.Column(
            "is_readonly", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )

    # Drop server defaults to keep application in control
    op.alter_column("recipes", "visibility", server_default=None)
    op.alter_column("recipes", "is_readonly", server_default=None)

    op.create_index(
        "ix_recipes_creator_visibility",
        "recipes",
        ["creator_id", "visibility"],
        unique=False,
    )


def downgrade() -> None:
    """Drop index, columns, and enum type."""
    op.drop_index("ix_recipes_creator_visibility", table_name="recipes")
    op.drop_column("recipes", "is_readonly")
    op.drop_column("recipes", "visibility")
    op.execute("DROP TYPE IF EXISTS recipe_visibility")
