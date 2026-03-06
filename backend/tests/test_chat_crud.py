import pytest

from src.chat.crud import (
    add_message_to_conversation,
    count_user_conversations,
    create_conversation,
    delete_conversation,
    get_conversation_by_id,
    get_conversation_messages,
    get_or_create_active_conversation,
    get_user_conversations,
    update_conversation,
)
from src.chat.schemas import (
    ConversationCreate,
    ConversationMessageCreate,
    ConversationUpdate,
)
from src.users.models import User


pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _seed_user(db_session, email: str) -> User:
    user = User(
        email=email,
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def test_chat_crud_conversation_lifecycle(db_session):
    owner = await _seed_user(db_session, "chat-owner@example.com")
    other_user = await _seed_user(db_session, "chat-other@example.com")

    conversation = await create_conversation(
        db_session, ConversationCreate(title="Leg Day"), owner.id
    )
    assert conversation.id is not None
    assert conversation.user_id == owner.id
    assert conversation.is_active is True

    found_for_owner = await get_conversation_by_id(
        db_session, conversation.id, owner.id
    )
    assert found_for_owner is not None
    assert found_for_owner.id == conversation.id

    not_found_for_other = await get_conversation_by_id(
        db_session, conversation.id, other_user.id
    )
    assert not_found_for_other is None

    updated = await update_conversation(
        db_session,
        conversation.id,
        ConversationUpdate(title="Leg Day Updated"),
        owner.id,
    )
    assert updated is not None
    assert updated.title == "Leg Day Updated"

    added_message = await add_message_to_conversation(
        db_session,
        conversation.id,
        ConversationMessageCreate(role="user", content="What did I do last time?"),
        owner.id,
    )
    assert added_message is not None
    assert added_message.role == "user"

    messages = await get_conversation_messages(db_session, conversation.id, owner.id)
    assert len(messages) == 1
    assert messages[0].content == "What did I do last time?"

    user_conversations = await get_user_conversations(
        db_session, owner.id, include_messages=True
    )
    assert len(user_conversations) == 1
    assert user_conversations[0].id == conversation.id
    assert len(user_conversations[0].messages) == 1

    assert await count_user_conversations(db_session, owner.id) == 1

    deleted = await delete_conversation(db_session, conversation.id, owner.id)
    assert deleted is True
    assert await count_user_conversations(db_session, owner.id) == 0
    assert await get_conversation_by_id(db_session, conversation.id, owner.id) is None
    assert await get_conversation_messages(db_session, conversation.id, owner.id) == []


async def test_chat_crud_not_found_paths(db_session):
    user = await _seed_user(db_session, "chat-missing@example.com")

    assert (
        await update_conversation(
            db_session,
            99999,
            ConversationUpdate(title="Missing"),
            user.id,
        )
        is None
    )
    assert await delete_conversation(db_session, 99999, user.id) is False
    assert (
        await add_message_to_conversation(
            db_session,
            99999,
            ConversationMessageCreate(role="assistant", content="hi"),
            user.id,
        )
        is None
    )
    assert await get_conversation_messages(db_session, 99999, user.id) == []


async def test_get_or_create_active_conversation_reuses_then_recreates(db_session):
    user = await _seed_user(db_session, "chat-reuse@example.com")

    first = await get_or_create_active_conversation(
        db_session, user.id, title="Starting Title"
    )
    assert first.title == "Starting Title"
    assert first.is_active is True

    second = await get_or_create_active_conversation(
        db_session, user.id, title="Ignored New Title"
    )
    assert second.id == first.id
    assert second.title == "Starting Title"

    first.is_active = False
    await db_session.commit()

    third = await get_or_create_active_conversation(
        db_session, user.id, title="Fresh Chat"
    )
    assert third.id != first.id
    assert third.title == "Fresh Chat"
