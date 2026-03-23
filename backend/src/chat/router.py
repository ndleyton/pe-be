import logging

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.chat.crud import (
    count_user_conversations,
    create_conversation,
    delete_conversation,
    get_conversation_by_id,
    get_user_conversations,
    update_conversation,
)
from src.chat.schemas import (
    ChatAttachmentUploadResponse,
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationListResponse,
    ConversationMessagePartResponse,
    ConversationMessageResponse,
    ConversationResponse,
    ConversationUpdate,
)
from src.chat.service import ChatService
from src.core.config import settings
from src.core.database import get_async_session
from src.core.rate_limit import RateLimitExceededError, rate_limiter
from src.users.models import User
from src.users.router import current_active_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _to_part_response(part) -> ConversationMessagePartResponse:
    attachment = getattr(part, "attachment", None)
    return ConversationMessagePartResponse(
        id=part.id,
        type=part.part_type,
        text=part.text_content,
        attachment_id=part.attachment_id,
        mime_type=attachment.mime_type if attachment else None,
        filename=attachment.original_filename if attachment else None,
    )


def _to_message_response(message) -> ConversationMessageResponse:
    return ConversationMessageResponse(
        id=message.id,
        role=message.role,
        content=message.content,
        created_at=message.created_at,
        parts=[_to_part_response(part) for part in getattr(message, "parts", []) or []],
    )


def _to_conversation_response(
    conversation, include_messages: bool = False
) -> ConversationResponse:
    payload = {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "is_active": conversation.is_active,
        "messages": None,
    }

    if include_messages:
        try:
            payload["messages"] = [
                _to_message_response(message)
                for message in getattr(conversation, "messages", []) or []
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
    try:
        await rate_limiter.check(
            scope="chat",
            key=str(user.id),
            limit=settings.CHAT_RATE_LIMIT_MAX_REQUESTS,
            window_seconds=settings.CHAT_RATE_LIMIT_WINDOW_SECONDS,
        )
        chat_service = ChatService(user_id=user.id, session=session)
        result = await chat_service.generate_response(
            messages=[
                message.model_dump(exclude_none=True) for message in request.messages
            ],
            conversation_id=request.conversation_id,
            save_to_db=True,
        )
        return ChatResponse(
            message=result["message"], conversation_id=result["conversation_id"]
        )
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=429,
            detail="Too many chat requests. Please slow down.",
            headers={"Retry-After": str(exc.retry_after_seconds)},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Chat request failed user_id=%s", user.id)
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred."
        ) from exc


@router.post("/chat/attachments", response_model=ChatAttachmentUploadResponse)
async def upload_chat_attachment(
    file: UploadFile = File(...),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await rate_limiter.check(
            scope="chat-attachment",
            key=str(user.id),
            limit=settings.CHAT_ATTACHMENT_RATE_LIMIT_MAX_REQUESTS,
            window_seconds=settings.CHAT_ATTACHMENT_RATE_LIMIT_WINDOW_SECONDS,
        )
        await ChatService.cleanup_orphaned_attachments(session)
        chat_service = ChatService(user_id=user.id, session=session)
        attachment = await chat_service.save_uploaded_attachment(
            filename=file.filename or "upload",
            content_type=file.content_type or "",
            data=await file.read(),
        )
        return ChatAttachmentUploadResponse(
            attachment_id=attachment.id,
            mime_type=attachment.mime_type,
            filename=attachment.original_filename,
            size_bytes=attachment.size_bytes,
            width=attachment.width,
            height=attachment.height,
        )
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=429,
            detail="Too many attachment uploads. Please slow down.",
            headers={"Retry-After": str(exc.retry_after_seconds)},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Chat attachment upload failed user_id=%s", user.id)
        raise HTTPException(
            status_code=500, detail="Failed to upload attachment"
        ) from exc


@router.get("/chat/attachments/{attachment_id}")
async def download_chat_attachment(
    attachment_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        chat_service = ChatService(user_id=user.id, session=session)
        attachment = await chat_service.get_attachment(attachment_id)
        file_path = chat_service._attachment_file_path(attachment.storage_key)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Attachment file not found")

        return FileResponse(
            path=file_path,
            media_type=attachment.mime_type,
            filename=attachment.original_filename,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Chat attachment download failed user_id=%s attachment_id=%s",
            user.id,
            attachment_id,
        )
        raise HTTPException(
            status_code=500, detail="Failed to load attachment"
        ) from exc


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        conversations = await get_user_conversations(
            session, user.id, limit, offset, include_messages=False
        )
        total = await count_user_conversations(session, user.id)
        return ConversationListResponse(
            conversations=[
                _to_conversation_response(conversation)
                for conversation in conversations
            ],
            total=total,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:
        logger.exception("Conversation list retrieval failed user_id=%s", user.id)
        raise HTTPException(
            status_code=500, detail="Failed to retrieve conversations"
        ) from exc


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        conversation = await get_conversation_by_id(session, conversation_id, user.id)

        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        return _to_conversation_response(conversation, include_messages=True)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Conversation retrieval failed user_id=%s conversation_id=%s",
            user.id,
            conversation_id,
        )
        raise HTTPException(
            status_code=500, detail="Failed to retrieve conversation"
        ) from exc


@router.post("/conversations/", response_model=ConversationResponse)
async def create_new_conversation(
    request: ConversationCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        conversation = await create_conversation(session, request, user.id)
        return _to_conversation_response(conversation)
    except Exception as exc:
        logger.exception("Conversation creation failed user_id=%s", user.id)
        raise HTTPException(
            status_code=500, detail="Failed to create conversation"
        ) from exc


@router.put("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation_endpoint(
    conversation_id: int,
    request: ConversationUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        conversation = await update_conversation(
            session, conversation_id, request, user.id
        )

        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        return _to_conversation_response(conversation)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Conversation update failed user_id=%s conversation_id=%s",
            user.id,
            conversation_id,
        )
        raise HTTPException(
            status_code=500, detail="Failed to update conversation"
        ) from exc


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation_endpoint(
    conversation_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await delete_conversation(session, conversation_id, user.id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Conversation deletion failed user_id=%s conversation_id=%s",
            user.id,
            conversation_id,
        )
        raise HTTPException(
            status_code=500, detail="Failed to delete conversation"
        ) from exc
