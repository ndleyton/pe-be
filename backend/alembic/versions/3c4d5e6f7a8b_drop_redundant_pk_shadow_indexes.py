"""drop redundant primary-key shadow indexes

Revision ID: 3c4d5e6f7a8b
Revises: 2f6b1d8e4c3a
Create Date: 2026-03-21 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3c4d5e6f7a8b"
down_revision: Union[str, None] = "2f6b1d8e4c3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_names() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    """Drop redundant non-unique indexes on primary-key id columns."""
    table_names = _table_names()

    if "conversations" in table_names:
        op.execute("DROP INDEX IF EXISTS ix_conversations_id")

    if "conversation_messages" in table_names:
        op.execute("DROP INDEX IF EXISTS ix_conversation_messages_id")

    if "chat_attachments" in table_names:
        op.execute("DROP INDEX IF EXISTS ix_chat_attachments_id")

    if "conversation_message_parts" in table_names:
        op.execute("DROP INDEX IF EXISTS ix_conversation_message_parts_id")


def downgrade() -> None:
    """Recreate legacy non-unique indexes on primary-key id columns."""
    table_names = _table_names()

    if "conversations" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_conversations_id
            ON conversations (id)
            """
        )

    if "conversation_messages" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_conversation_messages_id
            ON conversation_messages (id)
            """
        )

    if "chat_attachments" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_chat_attachments_id
            ON chat_attachments (id)
            """
        )

    if "conversation_message_parts" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_conversation_message_parts_id
            ON conversation_message_parts (id)
            """
        )
