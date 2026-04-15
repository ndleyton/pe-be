"""add rir to sets and templates

Revision ID: 7d64e35ced2d
Revises: 922e7a803726
Create Date: 2026-04-14 20:58:22.335310

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7d64e35ced2d"
down_revision = "922e7a803726"
branch_labels = None
depends_on = None


def _get_column_names(table_name):
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade():
    exercise_set_columns = _get_column_names("exercise_sets")
    if "rir" not in exercise_set_columns:
        op.add_column(
            "exercise_sets",
            sa.Column("rir", sa.Numeric(precision=3, scale=1), nullable=True),
        )

    set_template_columns = _get_column_names("set_templates")
    if "rir" not in set_template_columns:
        op.add_column(
            "set_templates",
            sa.Column("rir", sa.Numeric(precision=3, scale=1), nullable=True),
        )


def downgrade():
    set_template_columns = _get_column_names("set_templates")
    if "rir" in set_template_columns:
        op.drop_column("set_templates", "rir")

    exercise_set_columns = _get_column_names("exercise_sets")
    if "rir" in exercise_set_columns:
        op.drop_column("exercise_sets", "rir")
