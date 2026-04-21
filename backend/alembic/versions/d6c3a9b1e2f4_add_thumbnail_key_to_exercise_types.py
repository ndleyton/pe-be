"""add thumbnail_key to exercise_types

Revision ID: d6c3a9b1e2f4
Revises: c4b1a2d3e4f5
Create Date: 2026-04-03 19:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d6c3a9b1e2f4"
down_revision: Union[str, None] = "c4b1a2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = _column_names(inspector, "exercise_types")

    if "thumbnail_key" not in columns:
        op.add_column(
            "exercise_types",
            sa.Column(
                "thumbnail_key",
                sa.String(length=32),
                nullable=True,
                server_default="other",
            ),
        )

    op.execute(
        """
        UPDATE exercise_types
        SET thumbnail_key = 'other'
        WHERE thumbnail_key IS NULL OR btrim(thumbnail_key) = ''
        """
    )

    op.alter_column(
        "exercise_types",
        "thumbnail_key",
        existing_type=sa.String(length=32),
        nullable=False,
        server_default="other",
    )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = _column_names(inspector, "exercise_types")

    if "thumbnail_key" in columns:
        op.drop_column("exercise_types", "thumbnail_key")
