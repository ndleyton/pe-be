"""add upload metadata to exercise image candidates

Revision ID: 20260428_0001
Revises: 20260424_0001
Create Date: 2026-04-28 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260428_0001"
down_revision: Union[str, None] = "20260424_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = {
        column["name"] for column in inspector.get_columns("exercise_image_candidates")
    }

    if "asset_kind" not in columns:
        op.add_column(
            "exercise_image_candidates",
            sa.Column(
                "asset_kind",
                sa.String(length=64),
                nullable=False,
                server_default="generated_candidate",
            ),
        )
    if "status" not in columns:
        op.add_column(
            "exercise_image_candidates",
            sa.Column(
                "status",
                sa.String(length=32),
                nullable=False,
                server_default="active",
            ),
        )
    if "deleted_at" not in columns:
        op.add_column(
            "exercise_image_candidates",
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "original_filename" not in columns:
        op.add_column(
            "exercise_image_candidates",
            sa.Column("original_filename", sa.String(length=255), nullable=True),
        )
    if "sha256" not in columns:
        op.add_column(
            "exercise_image_candidates",
            sa.Column("sha256", sa.String(length=64), nullable=True),
        )

    op.execute(
        """
        UPDATE exercise_image_candidates
        SET asset_kind = 'generated_candidate'
        WHERE asset_kind IS NULL
        """
    )
    op.execute(
        """
        UPDATE exercise_image_candidates
        SET status = 'active'
        WHERE status IS NULL
        """
    )

    inspector = sa.inspect(connection)
    indexes = {
        index["name"] for index in inspector.get_indexes("exercise_image_candidates")
    }
    if "ix_exercise_image_candidates_kind_status_type" not in indexes:
        op.create_index(
            "ix_exercise_image_candidates_kind_status_type",
            "exercise_image_candidates",
            ["asset_kind", "status", "exercise_type_id"],
            unique=False,
        )
    if "ix_exercise_image_candidates_upload_hash" not in indexes:
        op.create_index(
            "ix_exercise_image_candidates_upload_hash",
            "exercise_image_candidates",
            ["exercise_type_id", "asset_kind", "status", "sha256"],
            unique=False,
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    indexes = {
        index["name"] for index in inspector.get_indexes("exercise_image_candidates")
    }
    if "ix_exercise_image_candidates_upload_hash" in indexes:
        op.drop_index(
            "ix_exercise_image_candidates_upload_hash",
            table_name="exercise_image_candidates",
        )
    if "ix_exercise_image_candidates_kind_status_type" in indexes:
        op.drop_index(
            "ix_exercise_image_candidates_kind_status_type",
            table_name="exercise_image_candidates",
        )

    columns = {
        column["name"] for column in inspector.get_columns("exercise_image_candidates")
    }
    for column_name in (
        "sha256",
        "original_filename",
        "deleted_at",
        "status",
        "asset_kind",
    ):
        if column_name in columns:
            op.drop_column("exercise_image_candidates", column_name)
