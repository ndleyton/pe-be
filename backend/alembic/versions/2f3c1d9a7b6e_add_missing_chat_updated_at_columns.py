"""Add missing updated_at columns to chat attachment tables

Revision ID: 2f3c1d9a7b6e
Revises: 1b2f4f77c0ad
Create Date: 2026-03-17 15:12:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2f3c1d9a7b6e"
down_revision: Union[str, None] = "1b2f4f77c0ad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_columns(inspector: sa.Inspector, table_name: str) -> set[str]:
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    chat_attachment_columns = _get_columns(inspector, "chat_attachments")
    if chat_attachment_columns and "updated_at" not in chat_attachment_columns:
        op.add_column(
            "chat_attachments",
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )

    message_part_columns = _get_columns(inspector, "conversation_message_parts")
    if message_part_columns and "updated_at" not in message_part_columns:
        op.add_column(
            "conversation_message_parts",
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    message_part_columns = _get_columns(inspector, "conversation_message_parts")
    if "updated_at" in message_part_columns:
        op.drop_column("conversation_message_parts", "updated_at")

    chat_attachment_columns = _get_columns(inspector, "chat_attachments")
    if "updated_at" in chat_attachment_columns:
        op.drop_column("chat_attachments", "updated_at")
