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
    tables = inspector.get_table_names()
    if "exercise_image_candidates" not in tables:
        return

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

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_exercise_image_candidates_kind_status_type
        ON exercise_image_candidates (asset_kind, status, exercise_type_id)
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_image_candidates_active_upload_hash
        ON exercise_image_candidates (exercise_type_id, asset_kind, sha256)
        WHERE status = 'active'
        """
    )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    if "exercise_image_candidates" not in tables:
        return

    op.execute("DROP INDEX IF EXISTS uq_exercise_image_candidates_active_upload_hash")
    op.execute("DROP INDEX IF EXISTS ix_exercise_image_candidates_kind_status_type")

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
