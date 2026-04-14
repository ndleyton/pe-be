"""Add chat attachments and multimodal message parts

Revision ID: 1b2f4f77c0ad
Revises: 6f2a9d1c4b7e
Create Date: 2026-03-13 01:35:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1b2f4f77c0ad"
down_revision: Union[str, None] = "6f2a9d1c4b7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    table_names = inspector.get_table_names()

    if "chat_attachments" not in table_names:
        op.create_table(
            "chat_attachments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("original_filename", sa.String(length=255), nullable=False),
            sa.Column("storage_key", sa.String(length=512), nullable=False),
            sa.Column("mime_type", sa.String(length=100), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("sha256", sa.String(length=64), nullable=False),
            sa.Column("width", sa.Integer(), nullable=True),
            sa.Column("height", sa.Integer(), nullable=True),
            sa.Column("provider_file_name", sa.String(length=255), nullable=True),
            sa.Column("provider_file_uri", sa.String(length=1024), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="cascade"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("storage_key"),
        )
        op.create_index(
            op.f("ix_chat_attachments_id"),
            "chat_attachments",
            ["id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_chat_attachments_user_id"),
            "chat_attachments",
            ["user_id"],
            unique=False,
        )

    if "conversation_message_parts" not in table_names:
        op.create_table(
            "conversation_message_parts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("conversation_message_id", sa.Integer(), nullable=False),
            sa.Column("order_index", sa.Integer(), nullable=False),
            sa.Column("part_type", sa.String(length=20), nullable=False),
            sa.Column("text_content", sa.Text(), nullable=True),
            sa.Column("attachment_id", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["attachment_id"], ["chat_attachments.id"], ondelete="set null"
            ),
            sa.ForeignKeyConstraint(
                ["conversation_message_id"],
                ["conversation_messages.id"],
                ondelete="cascade",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_conversation_message_parts_id"),
            "conversation_message_parts",
            ["id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_conversation_message_parts_conversation_message_id"),
            "conversation_message_parts",
            ["conversation_message_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_conversation_message_parts_attachment_id"),
            "conversation_message_parts",
            ["attachment_id"],
            unique=False,
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    table_names = inspector.get_table_names()

    if "conversation_message_parts" in table_names:
        op.drop_index(
            op.f("ix_conversation_message_parts_attachment_id"),
            table_name="conversation_message_parts",
        )
        op.drop_index(
            op.f("ix_conversation_message_parts_conversation_message_id"),
            table_name="conversation_message_parts",
        )
        op.drop_index(
            op.f("ix_conversation_message_parts_id"),
            table_name="conversation_message_parts",
        )
        op.drop_table("conversation_message_parts")

    if "chat_attachments" in table_names:
        op.drop_index(
            op.f("ix_chat_attachments_user_id"), table_name="chat_attachments"
        )
        op.drop_index(op.f("ix_chat_attachments_id"), table_name="chat_attachments")
        op.drop_table("chat_attachments")
