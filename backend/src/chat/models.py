from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.core.database import Base

if TYPE_CHECKING:
    from src.users.models import User


class Conversation(Base):
    """Conversation model for chat sessions."""

    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="cascade"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    messages: Mapped[List["ConversationMessage"]] = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConversationMessage.created_at",
    )
    user: Mapped["User"] = relationship("User", back_populates="conversations")


class ConversationMessage(Base):
    """Individual message within a conversation."""

    __tablename__ = "conversation_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("conversations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="messages"
    )
    parts: Mapped[List["ConversationMessagePart"]] = relationship(
        "ConversationMessagePart",
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="ConversationMessagePart.order_index",
    )


class ChatAttachment(Base):
    """Server-managed attachment used in chat messages."""

    __tablename__ = "chat_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="cascade"), nullable=False, index=True
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    provider_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    provider_file_uri: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    message_parts: Mapped[List["ConversationMessagePart"]] = relationship(
        "ConversationMessagePart",
        back_populates="attachment",
    )


class ConversationMessagePart(Base):
    """Ordered multimodal parts for a conversation message."""

    __tablename__ = "conversation_message_parts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_message_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("conversation_messages.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    part_type: Mapped[str] = mapped_column(String(20), nullable=False)
    text_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attachment_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("chat_attachments.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    message: Mapped["ConversationMessage"] = relationship(
        "ConversationMessage", back_populates="parts"
    )
    attachment: Mapped[Optional["ChatAttachment"]] = relationship(
        "ChatAttachment", back_populates="message_parts"
    )
