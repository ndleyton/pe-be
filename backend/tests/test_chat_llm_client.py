import pytest
from pydantic import BaseModel
from google.genai import types

from src.chat.llm_client import (
    GeminiGenAIClient,
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

async def test_tool_definition_to_genai_tool_declaration():
    tool = ToolDefinition(
        name="test_tool",
        description="A test tool",
        handler=_unused_handler,
        args_model=ExerciseArgs,
    )
    declaration = tool.to_genai_tool_declaration()
    assert declaration.name == "test_tool"
    assert declaration.description == "A test tool"
    assert "exercise_name" in declaration.parameters.properties

async def test_tool_clean_pydantic_schema_removes_title():
    tool = ToolDefinition(name="x", description="y", handler=_unused_handler)
    cleaned = tool._clean_pydantic_schema({"title": "Test", "type": "string"})
    assert "title" not in cleaned
    assert cleaned["type"] == "STRING"

async def test_tool_clean_pydantic_schema_nested():
    tool = ToolDefinition(name="x", description="y", handler=_unused_handler)
    schema = {
        "properties": {
            "prop1": {"type": "null", "description": "some desc"},
            "prop2": [{"type": "string", "example": "test"}]
        }
    }
    cleaned = tool._clean_pydantic_schema(schema)
    assert cleaned["properties"]["prop1"]["type"] == "STRING"
    assert "description" in cleaned["properties"]["prop1"]
    assert "example" not in cleaned["properties"]["prop2"][0]

async def test_coerce_raw_args_list_value():
    tool = ToolDefinition(name="x", description="y", handler=_unused_handler, args_model=ExerciseArgs)
    res = tool._coerce_raw_args({"some_key": "some_val"})
    assert res == {"exercise_name": "some_val"}

async def test_coerce_raw_args_unmapped():
    class TwoArgs(BaseModel):
        num1: int
        num2: int
    tool = ToolDefinition(name="x", description="y", handler=_unused_handler, args_model=TwoArgs)
    res = tool._coerce_raw_args({"num1": 1, "num2": 2})
    assert res == {"num1": 1, "num2": 2}

async def test_parse_json_dict_invalid():
    tool = ToolDefinition(name="x", description="y", handler=_unused_handler)
    assert tool._parse_json_dict(123) is None
    assert tool._parse_json_dict("invalid json") is None
    assert tool._parse_json_dict('["list", "not", "dict"]') is None

from unittest.mock import AsyncMock, patch, MagicMock
from src.chat.llm_client import ConversationMessage, ToolCall

@patch("google.genai.Client")
async def test_gemini_client_acomplete_messages(mock_client_class):
    mock_client = MagicMock()
    mock_aio = AsyncMock()
    # Need to simulate response
    mock_response = MagicMock()
    mock_response.candidates = [
        MagicMock(content=MagicMock(parts=[
            MagicMock(text="Response!", function_call=None),
            MagicMock(text=" Part 2", function_call=None)
        ]))
    ]
    mock_aio.models.generate_content = AsyncMock(return_value=mock_response)
    mock_client.aio = mock_aio
    mock_client_class.return_value = mock_client

    client = GeminiGenAIClient(api_key="test")
    client.client = mock_client # Override instance

    messages = [
        ConversationMessage(role="system", content="System instruction"),
        ConversationMessage(role="user", content="Hello"),
        ConversationMessage(role="assistant", content="Hi", tool_calls=[ToolCall(call_id="123", name="test_tool", args={"a": 1})]),
        ConversationMessage(role="tool", content="Tool result", tool_name="test_tool"),
    ]

    # Tool without args
    tool = ToolDefinition(name="test_tool", description="A tool", handler=_unused_handler)

    res = await client.acomplete(messages, [tool])
    assert res.message.content == "Response!\n Part 2"
    
    # Assert generate was called inside
    mock_aio.models.generate_content.assert_called_once()

async def test_tool_normalize_args_no_model():
    tool = ToolDefinition(name="test_tool", description="A tool", handler=_unused_handler, args_model=None)
    assert tool.normalize_args({"some": "arg"}) == {}

async def test_tool_ainvoke():
    async def sample_handler(a: int) -> str:
        return f"result_{a}"
        
    class SampleArgs(BaseModel):
        a: int
        
    tool = ToolDefinition(name="tgt", description="test", handler=sample_handler, args_model=SampleArgs)
    res = await tool.ainvoke({"a": 42})
    assert res == "result_42"
