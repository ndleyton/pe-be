import pytest
from src.chat.service import ChatService

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_tool_execution_fallback_message_on_no_model_response(monkeypatch):
    # Ensure model key is present to bypass early guard
    monkeypatch.setattr(
        "src.chat.service.settings.GOOGLE_AI_KEY", "test-key", raising=False
    )

    svc = ChatService(user_id=1, session=None)

    # Prepare a dummy tool list with a simple tool
    async def dummy_tool() -> str:
        return "dummy output"

    # Monkeypatch _get_tools to return a single tool
    from langchain_core.tools import Tool

    svc._get_tools = lambda: [
        Tool(name="dummy_tool", func=dummy_tool, description="test tool")
    ]

    class FakeResponse:
        def __init__(self, tool_calls):
            self.tool_calls = tool_calls
            self.content = ""  # simulate no final text from model

    # First return a tool call, then a response without content
    calls = [
        FakeResponse(
            [{"name": "dummy_tool", "args": {}, "id": "1", "type": "tool_call"}]
        ),
        FakeResponse([]),
    ]

    async def fake_ainvoke(_):
        return calls.pop(0)

    # Monkeypatch model creation to inject our fake ainvoke
    class DummyLLM:
        def bind_tools(self, _tools):
            return self

        async def ainvoke(self, _msgs):
            return await fake_ainvoke(_msgs)

    def fake_llm(*args, **kwargs):
        return DummyLLM()

    monkeypatch.setattr("src.chat.service.ChatGoogleGenerativeAI", fake_llm)

    result = await svc.generate_response(
        messages=[{"role": "user", "content": "hi"}], save_to_db=False
    )
    assert "Here is the result from the requested tool" in result["message"]
