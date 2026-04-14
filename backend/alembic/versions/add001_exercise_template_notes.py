"""add notes to exercise templates

Revision ID: add001_exercise_template_notes
Revises: b60b7cbbd60b
Create Date: 2026-04-07 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add001_exercise_template_notes"
down_revision: Union[str, None] = "c4b1a2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "exercise_templates" in inspector.get_table_names():
        columns = [col["name"] for col in inspector.get_columns("exercise_templates")]
        if "notes" not in columns:
            op.add_column(
                "exercise_templates", sa.Column("notes", sa.Text(), nullable=True)
            )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("exercise_templates", "notes")
