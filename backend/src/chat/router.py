from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_async_session
from src.chat.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationResponse,
    ConversationMessageResponse,
    ConversationListResponse,
    ConversationCreate,
    ConversationUpdate,
)
from src.chat.service import ChatService
from src.chat.crud import (
    get_conversation_by_id,
    get_user_conversations,
    count_user_conversations,
    create_conversation,
    update_conversation,
    delete_conversation,
)
from src.users.models import User
from src.users.router import current_active_user

router = APIRouter()


def _to_conversation_response(
    conv, include_messages: bool = False
) -> ConversationResponse:
    """Convert ORM conversation to response without forcing lazy loads."""
    payload = {
        "id": conv.id,
        "title": conv.title,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "is_active": conv.is_active,
        "messages": None,
    }

    if include_messages:
        try:
            payload["messages"] = [
                ConversationMessageResponse.model_validate(msg) for msg in conv.messages
            ]
        except Exception:
            payload["messages"] = []

    return ConversationResponse(**payload)


@router.post("/chat", response_model=ChatResponse)
async def handle_chat(
    request: ChatRequest,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Endpoint to handle chat messages with conversation persistence."""
    try:
        chat_service = ChatService(user_id=user.id, session=session)

        # Convert Pydantic models to dictionaries for the service
        messages_as_dicts = [msg.model_dump() for msg in request.messages]

        result = await chat_service.generate_response(
            messages=messages_as_dicts,
            conversation_id=request.conversation_id,
            save_to_db=True,
        )

        return ChatResponse(
            message=result["message"], conversation_id=result["conversation_id"]
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get user's conversations with pagination."""
    try:
        conversations = await get_user_conversations(
            session, user.id, limit, offset, include_messages=False
        )

        # Get total count efficiently using a separate COUNT query
        total = await count_user_conversations(session, user.id)

        return ConversationListResponse(
            conversations=[_to_conversation_response(conv) for conv in conversations],
            total=total,
            limit=limit,
            offset=offset,
        )

    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve conversations")


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get a specific conversation with its messages."""
    try:
        conversation = await get_conversation_by_id(session, conversation_id, user.id)

        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        return _to_conversation_response(conversation, include_messages=True)

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve conversation")


@router.post("/conversations/", response_model=ConversationResponse)
async def create_new_conversation(
    request: ConversationCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new conversation."""
    try:
        conversation = await create_conversation(session, request, user.id)
        return _to_conversation_response(conversation)

    except Exception:
        raise HTTPException(status_code=500, detail="Failed to create conversation")


@router.put("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation_endpoint(
    conversation_id: int,
    request: ConversationUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Update a conversation (e.g., change title)."""
    try:
        conversation = await update_conversation(
            session, conversation_id, request, user.id
        )

        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        return _to_conversation_response(conversation)

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update conversation")


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation_endpoint(
    conversation_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Delete (deactivate) a conversation."""
    try:
        # Idempotent delete: 204 for missing or already inactive
        await delete_conversation(session, conversation_id, user.id)

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete conversation")
