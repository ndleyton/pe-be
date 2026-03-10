import pytest
from src.chat.llm_client import (
    ConversationMessage,
    LLMResponse,
    ToolCall,
    ToolDefinition,
)
from src.chat.service import ChatService

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_tool_execution_fallback_message_on_no_model_response(monkeypatch):
    # Ensure model key is present to bypass early guard
    monkeypatch.setattr(
        "src.chat.service.settings.GOOGLE_AI_KEY", "test-key", raising=False
    )

    async def dummy_tool() -> str:
        return "dummy output"

    class FakeClient:
        model_name = "test-model"

        def __init__(self):
            self._responses = [
                LLMResponse(
                    message=ConversationMessage(
                        role="assistant",
                        content="",
                        tool_calls=[ToolCall(call_id="1", name="dummy_tool", args={})],
                    )
                ),
                LLMResponse(message=ConversationMessage(role="assistant", content="")),
            ]

        async def acomplete(self, _messages, _tools):
            return self._responses.pop(0)

    svc = ChatService(user_id=1, session=None, llm_client=FakeClient())
    svc._get_tools = lambda: [
        ToolDefinition(name="dummy_tool", handler=dummy_tool, description="test tool")
    ]

    result = await svc.generate_response(
        messages=[{"role": "user", "content": "hi"}], save_to_db=False
    )
    assert "Here is the result from the requested tool" in result["message"]
