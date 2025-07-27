from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from sqlalchemy.orm import selectinload

from src.chat.models import Conversation, ConversationMessage
from src.chat.schemas import ConversationCreate, ConversationUpdate, ConversationMessageCreate


async def create_conversation(
    session: AsyncSession, conversation_data: ConversationCreate, user_id: int
) -> Conversation:
    """Create a new conversation."""
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
    """Get a conversation by ID for a specific user."""
    result = await session.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
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
    """Get conversations for a user with pagination."""
    query = select(Conversation).where(
        and_(
            Conversation.user_id == user_id,
            Conversation.is_active,
        )
    ).order_by(desc(Conversation.updated_at)).limit(limit).offset(offset)
    
    if include_messages:
        query = query.options(selectinload(Conversation.messages))
    
    result = await session.execute(query)
    return list(result.scalars().all())


async def count_user_conversations(
    session: AsyncSession,
    user_id: int,
) -> int:
    """Get the total count of conversations for a user."""
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
    """Update a conversation."""
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
    """Soft delete a conversation (mark as inactive)."""
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
    """Add a message to an existing conversation."""
    # First verify the conversation exists and belongs to the user
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
    
    # Create the message
    db_message = ConversationMessage(
        conversation_id=conversation_id,
        role=message_data.role,
        content=message_data.content,
    )
    session.add(db_message)
    
    # Update conversation's updated_at timestamp
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
    """Get messages for a conversation with pagination."""
    # First verify the conversation exists and belongs to the user
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
    
    # Get messages
    result = await session.execute(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.created_at)
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def get_or_create_active_conversation(
    session: AsyncSession, user_id: int, title: Optional[str] = None
) -> Conversation:
    """Get the most recent active conversation for a user, or create a new one."""
    # Try to get the most recent conversation
    result = await session.execute(
        select(Conversation)
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
    
    # Create a new conversation if none exists
    conversation_data = ConversationCreate(title=title or "New Chat")
    return await create_conversation(session, conversation_data, user_id)