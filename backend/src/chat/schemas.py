from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ChatMessagePart(BaseModel):
    type: Literal["text", "image"]
    text: Optional[str] = None
    attachment_id: Optional[int] = None
    mime_type: Optional[str] = None
    filename: Optional[str] = None

    @model_validator(mode="after")
    def validate_part(self) -> "ChatMessagePart":
        if self.type == "text" and not self.text:
            raise ValueError("text parts require text")
        if self.type == "image" and self.attachment_id is None:
            raise ValueError("image parts require attachment_id")
        return self


class ChatMessage(BaseModel):
    role: str
    content: Optional[str] = None
    parts: Optional[List[ChatMessagePart]] = None

    @model_validator(mode="after")
    def validate_message(self) -> "ChatMessage":
        has_content = bool((self.content or "").strip())
        has_parts = bool(self.parts)
        if not has_content and not has_parts:
            raise ValueError("message must include content or parts")
        return self


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    conversation_id: Optional[int] = None


class ChatResponse(BaseModel):
    message: str
    conversation_id: int


class ChatAttachmentUploadResponse(BaseModel):
    attachment_id: int
    mime_type: str
    filename: str
    size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None


class ConversationCreate(BaseModel):
    title: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    is_active: Optional[bool] = None


class ConversationMessageCreate(BaseModel):
    role: str
    content: str = ""
    parts: List[ChatMessagePart] = Field(default_factory=list)


class ConversationMessagePartResponse(BaseModel):
    id: int
    type: Literal["text", "image"]
    text: Optional[str] = None
    attachment_id: Optional[int] = None
    mime_type: Optional[str] = None
    filename: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ConversationMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    parts: List[ConversationMessagePartResponse] = Field(default_factory=list)
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(BaseModel):
    id: int
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool
    messages: Optional[List[ConversationMessageResponse]] = None
    model_config = ConfigDict(from_attributes=True)


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int
    limit: int
    offset: int
