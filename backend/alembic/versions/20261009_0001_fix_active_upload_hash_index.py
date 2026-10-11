"""fix active upload hash index to target uploaded references only

Revision ID: 20261009_0001
Revises: 20260922_0001
Create Date: 2026-10-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261009_0001"
down_revision: Union[str, None] = "20260922_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    if "exercise_image_candidates" not in tables:
        return

    op.execute("DROP INDEX IF EXISTS uq_exercise_image_candidates_active_upload_hash")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_image_candidates_active_upload_hash
        ON exercise_image_candidates (exercise_type_id, asset_kind, sha256)
        WHERE status = 'active' AND asset_kind = 'uploaded_reference'
        """
    )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    if "exercise_image_candidates" not in tables:
        return

    # Generated hashes were nullable before this release and may now be duplicates.
    op.execute(
        """
        UPDATE exercise_image_candidates
        SET sha256 = NULL
        WHERE status = 'active' AND asset_kind = 'generated_candidate'
        """
    )
    op.execute("DROP INDEX IF EXISTS uq_exercise_image_candidates_active_upload_hash")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_image_candidates_active_upload_hash
        ON exercise_image_candidates (exercise_type_id, asset_kind, sha256)
        WHERE status = 'active'
        """
    )
