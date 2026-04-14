"""Add conversation and conversation_message tables

Revision ID: e99108c5936e
Revises: 660a3f8b29cf
Create Date: 2025-07-26 17:29:09.369096

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e99108c5936e"
down_revision: Union[str, None] = "660a3f8b29cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
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
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_conversations_id"), "conversations", ["id"], unique=False)
    op.create_index(
        op.f("ix_conversations_user_id"), "conversations", ["user_id"], unique=False
    )
    op.create_table(
        "conversation_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
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
            ["conversation_id"], ["conversations.id"], ondelete="cascade"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_conversation_messages_conversation_id"),
        "conversation_messages",
        ["conversation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_conversation_messages_id"),
        "conversation_messages",
        ["id"],
        unique=False,
    )
    op.alter_column("recipes", "name", existing_type=sa.VARCHAR(), nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column("recipes", "name", existing_type=sa.VARCHAR(), nullable=True)
    op.drop_index(
        op.f("ix_conversation_messages_id"), table_name="conversation_messages"
    )
    op.drop_index(
        op.f("ix_conversation_messages_conversation_id"),
        table_name="conversation_messages",
    )
    op.drop_table("conversation_messages")
    op.drop_index(op.f("ix_conversations_user_id"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_id"), table_name="conversations")
    op.drop_table("conversations")
