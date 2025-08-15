from pydantic import ConfigDict, BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    conversation_id: Optional[int] = None


class ChatResponse(BaseModel):
    message: str
    conversation_id: int


# Conversation schemas
class ConversationCreate(BaseModel):
    title: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    is_active: Optional[bool] = None


class ConversationMessageCreate(BaseModel):
    role: str
    content: str


class ConversationMessageResponse(BaseModel):
    id: int
    role: str
    content: str
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


# Tool schemas for function calling
class ExerciseInput(BaseModel):
    """Schema for exercise input in routine creation"""

    exercise_name: str = Field(..., description="The name of the exercise")
    sets: Optional[int] = Field(3, description="Number of sets", ge=1, le=10)
    reps: Optional[int] = Field(
        10, description="Number of repetitions per set", ge=1, le=100
    )
    weight: Optional[float] = Field(
        50.0, description="Weight/intensity for the exercise", ge=0
    )


class CreateRoutineSchema(BaseModel):
    """Schema for creating workout routines via tool calling"""

    name: str = Field(
        ..., description="The name of the workout routine", min_length=1, max_length=255
    )
    exercises: List[ExerciseInput] = Field(
        ..., description="List of exercises in the routine", min_items=1
    )
    description: Optional[str] = Field(
        None, description="Optional description of the routine"
    )
