from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from pydantic import BaseModel

from src.chat.llm_client import (
    ConversationMessage,
    GeminiLangChainClient,
    ToolCall,
    ToolDefinition,
)


pytestmark = pytest.mark.asyncio(loop_scope="session")


class ExerciseArgs(BaseModel):
    exercise_name: str


class WorkoutArgs(BaseModel):
    name: str
    workout_type_id: int


async def _unused_handler(**_kwargs) -> str:
    return "ok"


async def test_tool_definition_normalizes_single_argument_payload():
    tool = ToolDefinition(
        name="get_last_exercise_performance",
        description="test",
        handler=_unused_handler,
        args_model=ExerciseArgs,
    )

    normalized = tool.normalize_args({"__arg1": "Deadlift"})

    assert normalized == {"exercise_name": "Deadlift"}


async def test_tool_definition_normalizes_json_payload():
    tool = ToolDefinition(
        name="parse_workout",
        description="test",
        handler=_unused_handler,
        args_model=WorkoutArgs,
    )

    normalized = tool.normalize_args(
        {"__arg1": '{"name":"Upper","workout_type_id":4}'}
    )

    assert normalized == {"name": "Upper", "workout_type_id": 4}


async def test_gemini_client_normalizes_provider_response():
    client = GeminiLangChainClient(api_key="test-key", rate_limiter=None)
    response = SimpleNamespace(
        content=[{"text": "Ready"}],
        tool_calls=[
            {
                "name": "get_last_workout_summary",
                "args": {},
                "id": "call-1",
            }
        ],
    )

    normalized = client._normalize_response(response)

    assert normalized.message.role == "assistant"
    assert normalized.message.content == "Ready"
    assert normalized.tool_calls == [
        ToolCall(call_id="call-1", name="get_last_workout_summary", args={})
    ]


async def test_gemini_client_converts_internal_messages_to_langchain_messages():
    client = GeminiLangChainClient(api_key="test-key", rate_limiter=None)
    messages = [
        ConversationMessage(role="system", content="system prompt"),
        ConversationMessage(role="user", content="hi"),
        ConversationMessage(
            role="assistant",
            content="",
            tool_calls=[ToolCall(call_id="tool-1", name="lookup", args={"x": 1})],
        ),
        ConversationMessage(
            role="tool",
            content="result",
            tool_call_id="tool-1",
            tool_name="lookup",
        ),
    ]

    converted = client._to_langchain_messages(messages)

    assert isinstance(converted[0], SystemMessage)
    assert isinstance(converted[1], HumanMessage)
    assert isinstance(converted[2], AIMessage)
    assert converted[2].tool_calls[0]["name"] == "lookup"
    assert isinstance(converted[3], ToolMessage)
    assert converted[3].tool_call_id == "tool-1"
