"""add rpe to exercise and routine sets

Revision ID: f2a9c6d1b4e7
Revises: e3f5a7b8c9d1
Create Date: 2026-04-08 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f2a9c6d1b4e7"
down_revision = "e3f5a7b8c9d1"
branch_labels = None
depends_on = None


def _get_column_names(table_name):
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade():
    exercise_set_columns = _get_column_names("exercise_sets")
    if "rpe" not in exercise_set_columns:
        op.add_column(
            "exercise_sets",
            sa.Column("rpe", sa.Numeric(precision=3, scale=1), nullable=True),
        )

    set_template_columns = _get_column_names("set_templates")
    if "rpe" not in set_template_columns:
        op.add_column(
            "set_templates",
            sa.Column("rpe", sa.Numeric(precision=3, scale=1), nullable=True),
        )


def downgrade():
    set_template_columns = _get_column_names("set_templates")
    if "rpe" in set_template_columns:
        op.drop_column("set_templates", "rpe")

    exercise_set_columns = _get_column_names("exercise_sets")
    if "rpe" in exercise_set_columns:
        op.drop_column("exercise_sets", "rpe")
