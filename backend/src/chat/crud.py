from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.chat.models import (
    ChatAttachment,
    Conversation,
    ConversationMessage,
    ConversationMessagePart,
)
from src.chat.schemas import (
    ChatMessagePart,
    ConversationCreate,
    ConversationMessageCreate,
    ConversationUpdate,
)


async def create_conversation(
    session: AsyncSession, conversation_data: ConversationCreate, user_id: int
) -> Conversation:
    db_conversation = Conversation(
        title=conversation_data.title,
        user_id=user_id,
        is_active=True,
    )
    session.add(db_conversation)
    await session.commit()
    await session.refresh(db_conversation)
    return db_conversation


async def get_conversation_by_id(
    session: AsyncSession, conversation_id: int, user_id: int
) -> Optional[Conversation]:
    result = await session.execute(
        select(Conversation)
        .options(
            selectinload(Conversation.messages)
            .selectinload(ConversationMessage.parts)
            .selectinload(ConversationMessagePart.attachment)
        )
        .where(
            and_(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.is_active,
            )
        )
    )
    return result.scalar_one_or_none()


async def get_user_conversations(
    session: AsyncSession,
    user_id: int,
    limit: int = 20,
    offset: int = 0,
    include_messages: bool = False,
) -> List[Conversation]:
    query = (
        select(Conversation)
        .where(
            and_(
                Conversation.user_id == user_id,
                Conversation.is_active,
            )
        )
        .order_by(desc(Conversation.updated_at))
        .limit(limit)
        .offset(offset)
    )

    if include_messages:
        query = query.options(
            selectinload(Conversation.messages)
            .selectinload(ConversationMessage.parts)
            .selectinload(ConversationMessagePart.attachment)
        )

    result = await session.execute(query)
    return list(result.scalars().all())


async def count_user_conversations(
    session: AsyncSession,
    user_id: int,
) -> int:
    result = await session.execute(
        select(func.count(Conversation.id)).where(
            and_(
                Conversation.user_id == user_id,
                Conversation.is_active,
            )
        )
    )
    return result.scalar()


async def update_conversation(
    session: AsyncSession,
    conversation_id: int,
    conversation_data: ConversationUpdate,
    user_id: int,
) -> Optional[Conversation]:
    result = await session.execute(
        select(Conversation).where(
            and_(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.is_active,
            )
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        return None

    for field, value in conversation_data.model_dump(exclude_unset=True).items():
        setattr(conversation, field, value)

    await session.commit()
    await session.refresh(conversation)
    return conversation


async def delete_conversation(
    session: AsyncSession, conversation_id: int, user_id: int
) -> bool:
    result = await session.execute(
        select(Conversation).where(
            and_(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.is_active,
            )
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        return False

    conversation.is_active = False
    await session.commit()
    return True


async def add_message_to_conversation(
    session: AsyncSession,
    conversation_id: int,
    message_data: ConversationMessageCreate,
    user_id: int,
) -> Optional[ConversationMessage]:
    conversation_result = await session.execute(
        select(Conversation).where(
            and_(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.is_active,
            )
        )
    )
    conversation = conversation_result.scalar_one_or_none()

    if not conversation:
        return None

    db_message = ConversationMessage(
        conversation_id=conversation_id,
        role=message_data.role,
        content=message_data.content,
    )
    session.add(db_message)
    await session.flush()

    for index, part in enumerate(message_data.parts or _parts_from_content(message_data.content)):
        session.add(
            ConversationMessagePart(
                conversation_message_id=db_message.id,
                order_index=index,
                part_type=part.type,
                text_content=part.text if part.type == "text" else None,
                attachment_id=part.attachment_id if part.type == "image" else None,
            )
        )

    conversation.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(db_message)
    return db_message


async def get_conversation_messages(
    session: AsyncSession,
    conversation_id: int,
    user_id: int,
    limit: int = 50,
    offset: int = 0,
) -> List[ConversationMessage]:
    conversation_result = await session.execute(
        select(Conversation).where(
            and_(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.is_active,
            )
        )
    )
    conversation = conversation_result.scalar_one_or_none()

    if not conversation:
        return []

    result = await session.execute(
        select(ConversationMessage)
        .options(
            selectinload(ConversationMessage.parts).selectinload(
                ConversationMessagePart.attachment
            )
        )
        .where(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.created_at)
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def get_or_create_active_conversation(
    session: AsyncSession, user_id: int, title: Optional[str] = None
) -> Conversation:
    result = await session.execute(
        select(Conversation)
        .options(
            selectinload(Conversation.messages)
            .selectinload(ConversationMessage.parts)
            .selectinload(ConversationMessagePart.attachment)
        )
        .where(
            and_(
                Conversation.user_id == user_id,
                Conversation.is_active,
            )
        )
        .order_by(desc(Conversation.updated_at))
        .limit(1)
    )

    existing_conversation = result.scalar_one_or_none()

    if existing_conversation:
        return existing_conversation

    conversation_data = ConversationCreate(title=title or "New Chat")
    return await create_conversation(session, conversation_data, user_id)


async def create_chat_attachment(
    session: AsyncSession,
    *,
    user_id: int,
    original_filename: str,
    storage_key: str,
    mime_type: str,
    size_bytes: int,
    sha256: str,
    width: Optional[int],
    height: Optional[int],
) -> ChatAttachment:
    attachment = ChatAttachment(
        user_id=user_id,
        original_filename=original_filename,
        storage_key=storage_key,
        mime_type=mime_type,
        size_bytes=size_bytes,
        sha256=sha256,
        width=width,
        height=height,
    )
    session.add(attachment)
    await session.commit()
    await session.refresh(attachment)
    return attachment


async def get_chat_attachment_by_id(
    session: AsyncSession, attachment_id: int, user_id: int
) -> Optional[ChatAttachment]:
    result = await session.execute(
        select(ChatAttachment).where(
            and_(
                ChatAttachment.id == attachment_id,
                ChatAttachment.user_id == user_id,
            )
        )
    )
    return result.scalar_one_or_none()


async def update_chat_attachment_provider_ref(
    session: AsyncSession,
    attachment: ChatAttachment,
    *,
    provider_file_name: str,
    provider_file_uri: str,
) -> ChatAttachment:
    attachment.provider_file_name = provider_file_name
    attachment.provider_file_uri = provider_file_uri
    await session.commit()
    await session.refresh(attachment)
    return attachment


async def get_stale_orphaned_chat_attachments(
    session: AsyncSession,
    *,
    older_than: datetime,
    limit: int,
) -> List[ChatAttachment]:
    result = await session.execute(
        select(ChatAttachment)
        .outerjoin(
            ConversationMessagePart,
            ConversationMessagePart.attachment_id == ChatAttachment.id,
        )
        .where(
            and_(
                ChatAttachment.created_at < older_than,
                ConversationMessagePart.id.is_(None),
            )
        )
        .order_by(ChatAttachment.created_at)
        .limit(limit)
    )
    return list(result.scalars().all())


def _parts_from_content(content: str) -> list[ChatMessagePart]:
    normalized = (content or "").strip()
    if not normalized:
        return []
    return [ChatMessagePart(type="text", text=normalized)]
