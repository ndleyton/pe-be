import pytest
from pydantic import BaseModel
from google.genai import types

from src.chat.llm_client import (
    ConversationMessage,
    GeminiGenAIClient,
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

    normalized = tool.normalize_args({"__arg1": '{"name":"Upper","workout_type_id":4}'})

    assert normalized == {"name": "Upper", "workout_type_id": 4}


async def test_gemini_client_normalizes_provider_response():
    client = GeminiGenAIClient(api_key="test-key", rate_limiter=None)
    response = types.GenerateContentResponse(
        candidates=[
            types.Candidate(
                content=types.Content(
                    parts=[
                        types.Part.from_text(text="Ready"),
                        types.Part.from_function_call(
                            name="get_last_workout_summary", args={}
                        ),
                    ]
                )
            )
        ]
    )

    normalized = client._normalize_response(response)

    assert normalized.message.role == "assistant"
    assert normalized.message.content == "Ready"
    assert len(normalized.tool_calls) == 1
    assert normalized.tool_calls[0].name == "get_last_workout_summary"
    assert normalized.tool_calls[0].args == {}
