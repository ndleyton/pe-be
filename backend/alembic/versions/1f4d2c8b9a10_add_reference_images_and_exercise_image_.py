"""add reference images and exercise image candidates

Revision ID: 1f4d2c8b9a10
Revises: e3f5a7b8c9d1
Create Date: 2026-03-30 13:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1f4d2c8b9a10"
down_revision: Union[str, None] = "e3f5a7b8c9d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    exercise_type_columns = {
        column["name"] for column in inspector.get_columns("exercise_types")
    }
    if "reference_images_url" not in exercise_type_columns:
        op.add_column(
            "exercise_types",
            sa.Column("reference_images_url", sa.Text(), nullable=True),
        )

    op.execute(
        """
        UPDATE exercise_types
        SET reference_images_url = images_url
        WHERE reference_images_url IS NULL
          AND images_url IS NOT NULL
        """
    )

    inspector = sa.inspect(connection)
    if "exercise_image_candidates" not in inspector.get_table_names():
        op.create_table(
            "exercise_image_candidates",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("exercise_type_id", sa.Integer(), nullable=False),
            sa.Column("generation_key", sa.String(length=64), nullable=False),
            sa.Column("pipeline_key", sa.String(length=64), nullable=False),
            sa.Column("option_key", sa.String(length=64), nullable=False),
            sa.Column("option_label", sa.String(length=255), nullable=False),
            sa.Column("option_description", sa.Text(), nullable=True),
            sa.Column("source_image_index", sa.Integer(), nullable=False),
            sa.Column("source_image_url", sa.Text(), nullable=False),
            sa.Column("model_name", sa.String(length=128), nullable=False),
            sa.Column("prompt_version", sa.String(length=32), nullable=False),
            sa.Column("prompt_summary", sa.Text(), nullable=True),
            sa.Column(
                "mime_type",
                sa.String(length=64),
                nullable=False,
                server_default="image/png",
            ),
            sa.Column("storage_path", sa.String(length=512), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["exercise_type_id"],
                ["exercise_types.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("generation_key"),
            sa.UniqueConstraint("storage_path"),
        )
        op.create_index(
            "ix_exercise_image_candidates_exercise_type_option_source",
            "exercise_image_candidates",
            ["exercise_type_id", "option_key", "source_image_index"],
            unique=False,
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "exercise_image_candidates" in inspector.get_table_names():
        op.drop_index(
            "ix_exercise_image_candidates_exercise_type_option_source",
            table_name="exercise_image_candidates",
        )
        op.drop_table("exercise_image_candidates")

    inspector = sa.inspect(connection)
    exercise_type_columns = {
        column["name"] for column in inspector.get_columns("exercise_types")
    }
    if "reference_images_url" in exercise_type_columns:
        op.drop_column("exercise_types", "reference_images_url")
