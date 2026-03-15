import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from src.chat.service import ChatService
from src.chat.llm_client import ConversationMessage

@pytest.fixture
def chat_service_no_db():
    return ChatService(user_id=1, session=None)

@pytest.fixture
def chat_service_with_db():
    session_mock = AsyncMock()
    return ChatService(user_id=1, session=session_mock)

@pytest.mark.asyncio
async def test_generate_response_no_key(chat_service_with_db):
    with patch("src.chat.service.settings.GOOGLE_AI_KEY", None):
        with pytest.raises(ValueError, match="Google AI API key not configured"):
            await chat_service_with_db.generate_response([])

@pytest.mark.asyncio
@patch("src.chat.service.get_conversation_by_id")
async def test_generate_response_invalid_conversation(mock_get_conv, chat_service_with_db):
    mock_get_conv.return_value = None
    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key"):
        with pytest.raises(ValueError, match="Conversation 123 not found"):
            await chat_service_with_db.generate_response([], conversation_id=123)

@pytest.mark.asyncio
@patch("src.chat.service.ChatService._get_llm_client")
async def test_generate_response_tool_not_found(mock_get_llm, chat_service_no_db):
    mock_llm = AsyncMock()
    
    # Send one tool call then a text message
    mock_tool_call_response = MagicMock()
    mock_tool_call = MagicMock()
    mock_tool_call.name = "non_existent_tool"
    mock_tool_call.args = {"arg": "value"}
    mock_tool_call.call_id = "call_123"
    
    mock_tool_call_response.tool_calls = [mock_tool_call]
    mock_tool_call_response.message = ConversationMessage(role="assistant", content="")
    
    mock_text_response = MagicMock()
    mock_text_response.tool_calls = None
    mock_text_response.message = ConversationMessage(role="assistant", content="Done.")
    
    mock_llm.acomplete.side_effect = [mock_tool_call_response, mock_text_response]
    mock_get_llm.return_value = mock_llm

    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key"):
        result = await chat_service_no_db.generate_response([{"role": "user", "content": "hi"}], save_to_db=False)
        assert result["message"] == "Done."
        # Verify that the tool output message containing the error was passed to the LLM in the 2nd call
        second_call_args = mock_llm.acomplete.call_args_list[1][0][0]
        tool_msg = next((msg for msg in second_call_args if msg.role == "tool"), None)
        assert tool_msg is not None
        assert "Error: Tool non_existent_tool not found." in tool_msg.content

@pytest.mark.asyncio
@patch("src.chat.service.ChatService._get_llm_client")
async def test_generate_response_tool_execution_exception(mock_get_llm, chat_service_no_db):
    mock_llm = AsyncMock()
    
    mock_tool_call_response = MagicMock()
    mock_tool_call = MagicMock()
    mock_tool_call.name = "failing_tool"
    mock_tool_call.args = {"arg": "value"}
    mock_tool_call.call_id = "call_123"
    
    mock_tool_call_response.tool_calls = [mock_tool_call]
    mock_tool_call_response.message = ConversationMessage(role="assistant", content="")
    
    mock_text_response = MagicMock()
    mock_text_response.tool_calls = None
    mock_text_response.message = ConversationMessage(role="assistant", content="Handled error.")
    
    mock_llm.acomplete.side_effect = [mock_tool_call_response, mock_text_response]
    mock_get_llm.return_value = mock_llm

    mock_tool = AsyncMock()
    mock_tool.name = "failing_tool"
    mock_tool.ainvoke.side_effect = Exception("Tool blew up")

    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key"), \
         patch("src.chat.service.ChatService._get_tools", return_value=[mock_tool]):
        result = await chat_service_no_db.generate_response([{"role": "user", "content": "hi"}], save_to_db=False)
        assert result["message"] == "Handled error."

        second_call_args = mock_llm.acomplete.call_args_list[1][0][0]
        tool_msg = next((msg for msg in second_call_args if msg.role == "tool"), None)
        assert tool_msg is not None
        assert "Error executing tool failing_tool: Tool blew up" in tool_msg.content

@pytest.mark.asyncio
@patch("src.chat.service.ChatService._get_llm_client")
async def test_generate_response_max_iterations_no_tools(mock_get_llm, chat_service_no_db):
    mock_llm = AsyncMock()
    
    # Send a tool call but configure service to max 1 iteration and make the iteration trigger instantly
    mock_tool_call_response = MagicMock()
    mock_tool_call_response.tool_calls = []
    mock_tool_call_response.message = ConversationMessage(role="assistant", content="")
    
    # We want max iterations to hit *before* a tool output exists to cover lines 438-439
    mock_llm.acomplete.return_value = mock_tool_call_response
    mock_get_llm.return_value = mock_llm

    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key"), \
         patch("src.chat.service.settings.CHAT_MAX_TOOL_ITERATIONS", 0):
        result = await chat_service_no_db.generate_response([{"role": "user", "content": "hi"}], save_to_db=False)
        assert result["message"] == "I completed the requested operation."


@pytest.mark.asyncio
@patch("src.chat.service.ChatService._get_llm_client")
@patch("src.chat.service.get_or_create_active_conversation")
@patch("src.chat.service.add_message_to_conversation")
async def test_generate_response_saves_to_db_with_multiple_messages(
    mock_add_message, mock_get_or_create, mock_get_llm, chat_service_with_db
):
    # Setup mock LLM completely answering instantly
    mock_llm = AsyncMock()
    mock_response = MagicMock()
    mock_response.message = ConversationMessage(role="assistant", content="llm output")
    mock_response.tool_calls = []
    mock_llm.acomplete.return_value = mock_response
    mock_get_llm.return_value = mock_llm

    mock_conv = MagicMock(id=1)
    mock_get_or_create.return_value = mock_conv

    messages = [
        {"role": "system", "content": "ignore this one in db"},
        {"role": "user", "content": "u1"},
        {"role": "assistant", "content": "a1"},
    ]

    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key"):
        result = await chat_service_with_db.generate_response(messages, save_to_db=True)

    assert result["message"] == "llm output"
    
    # Check that system prompt is skipped but others are added
    # 2 user/assistant messages from history + 1 final output = 3 calls
    assert mock_add_message.call_count == 3
    
    # Verify the final message added was the assistant LLM output
    last_call_args = mock_add_message.call_args_list[-1]
    assert last_call_args[0][2].content == "llm output"
    assert last_call_args[0][2].role == "assistant"


@pytest.mark.asyncio
@patch("src.chat.service.ChatService._get_llm_client")
@patch("src.chat.service.get_conversation_by_id")
@patch("src.chat.service.add_message_to_conversation")
async def test_generate_response_deduplicates_persisted_history(
    mock_add_message,
    mock_get_conversation,
    mock_get_llm,
    chat_service_with_db,
):
    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key"):
        mock_llm = AsyncMock()
        mock_llm.model_name = "test-model"
        mock_llm.acomplete.return_value = MagicMock(
            message=ConversationMessage(role="assistant", content="New reply"),
            tool_calls=[],
            metadata={},
        )
        mock_get_llm.return_value = mock_llm

        mock_get_conversation.return_value = MagicMock(
            id=5,
            messages=[
                MagicMock(role="user", content="old user", parts=[]),
                MagicMock(role="assistant", content="old assistant", parts=[]),
            ],
        )

        result = await chat_service_with_db.generate_response(
            messages=[
                {"role": "user", "content": "old user"},
                {"role": "assistant", "content": "old assistant"},
                {"role": "user", "content": "new user"},
            ],
            conversation_id=5,
            save_to_db=True,
        )

    assert result["message"] == "New reply"
    assert mock_add_message.call_count == 2
    assert mock_add_message.call_args_list[0][0][2].content == "new user"
    assert mock_add_message.call_args_list[1][0][2].content == "New reply"

@pytest.mark.asyncio
@patch("src.chat.service.ChatService._get_llm_client")
async def test_generate_response_empty_final_message_gets_tool_fallback(mock_get_llm, chat_service_no_db):
    mock_llm = AsyncMock()
    mock_llm.model_name = "test-model"
    
    # We want max iterations to hit *after* a tool output exists to cover lines 434-437 and 551-554
    mock_tool_call_response = MagicMock()
    mock_tool_call = MagicMock()
    mock_tool_call.name = "test_tool"
    mock_tool_call_response.tool_calls = [mock_tool_call]
    mock_tool_call_response.message = ConversationMessage(role="assistant", content="")
    
    mock_llm.acomplete.return_value = mock_tool_call_response
    mock_get_llm.return_value = mock_llm

    # Fake a tool in the registry
    mock_tool = AsyncMock()
    mock_tool.ainvoke.return_value = "Tool result string"
    mock_tool_def = MagicMock()
    mock_tool_def.name = "test_tool"

    with patch.object(chat_service_no_db, '_get_tools', return_value=[mock_tool_def]), \
         patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key"), \
         patch("src.chat.service.settings.CHAT_MAX_TOOL_ITERATIONS", 1):
         
        # Make the tool registry look up our mock
        # We need to monkeypatch the internal local `tool_registry` implicitly created inside generate_response
        # Better yet, just let the real tool registry pick it up
        
        # Override the tool registry inline
        chat_service_no_db._get_tools = MagicMock(return_value=[mock_tool_def])
        
        # Mock behavior: first call returns tool, second call returns tool again to trigger max iterations break
        # But wait, max iterations counts `while True` loop iterations.
        # If max is 1, it will run exactly 1 time, make the tool call, then at start of loop 2, hit `if iteration_count > max_tool_iterations:` and break.
        # It will then evaluate `last_tool_outputs_texts` which will contain the output of 1 tool call.
        # Let's mock ainvoke properly.
        mock_tool_def.ainvoke = AsyncMock(return_value="Valid specific tool output text")

        result = await chat_service_no_db.generate_response([{"role": "user", "content": "hi"}], save_to_db=False)
        assert result["message"] == "Here is the result from the requested tool:\nValid specific tool output text"


@pytest.mark.asyncio
@patch("src.chat.service.ChatService._get_llm_client")
async def test_generate_response_empty_final_message_no_tool_fallback(mock_get_llm, chat_service_no_db):
    mock_llm = AsyncMock()
    
    # Setup mock LLM answering with empty string to trigger fallback
    mock_response = MagicMock()
    mock_response.message = ConversationMessage(role="assistant", content="")
    mock_response.tool_calls = []
    mock_llm.acomplete.return_value = mock_response
    mock_get_llm.return_value = mock_llm

    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key"):
        result = await chat_service_no_db.generate_response([{"role": "user", "content": "hi"}], save_to_db=False)
        assert result["message"] == "I completed the requested operation."
        
        
def test_get_system_prompt_handling(chat_service_no_db):
    chat_service_no_db.langfuse = MagicMock()

    # Case 1: String prompt
    # Note: langfuse's Prompt._get_prompt() internally is returning string, we set the `.prompt` attribute
    # but the logic in `_get_system_prompt()` looks at `getattr(prompt, "prompt", prompt)`
    # Since the mock returns a MagicMock, getattr returns the `.prompt` MagicMock itself, NOT the string value
    # We must properly configure the nested MagicMock, or better just use a simple object
    class SimplePrompt:
        def __init__(self, p):
            self.prompt = p

    chat_service_no_db.langfuse.get_prompt.return_value = SimplePrompt("simple string prompt")
    assert chat_service_no_db._get_system_prompt() == "simple string prompt"
    
    # Case 2: List of strings
    chat_service_no_db.langfuse.get_prompt.return_value = SimplePrompt(["item 1", "item 2"])
    assert chat_service_no_db._get_system_prompt() == "item 1\nitem 2"

    # Case 3: List of dicts with content strings
    chat_service_no_db.langfuse.get_prompt.return_value = SimplePrompt([{"content": "block 1"}, {"content": "block 2"}])
    assert chat_service_no_db._get_system_prompt() == "block 1\nblock 2"

    # Case 4: List of dicts with content lists
    chat_service_no_db.langfuse.get_prompt.return_value = SimplePrompt([{"content": [{"type": "text", "text": "deep1"}, "deep2"]}])
    assert chat_service_no_db._get_system_prompt() == "deep1\ndeep2"

    # Case 4.5: Object fallback
    class MockObjectPrompt:
        def __str__(self):
            return "mock object str"
            
    chat_service_no_db.langfuse.get_prompt.return_value = SimplePrompt(MockObjectPrompt())
    assert chat_service_no_db._get_system_prompt() == "mock object str"

    # Case 5: Exception fallback
    chat_service_no_db.langfuse.get_prompt.side_effect = Exception("Langfuse down")
    assert "You are a friendly and encouraging fitness coach" in chat_service_no_db._get_system_prompt()

@pytest.mark.asyncio
@patch("src.chat.service.ChatService._get_llm_client")
async def test_generate_response_general_exception(mock_get_llm, chat_service_no_db):
    mock_llm = AsyncMock()
    mock_llm.acomplete.side_effect = Exception("General LLM error")
    mock_get_llm.return_value = mock_llm

    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key"):
        with pytest.raises(ValueError, match="Error generating response with Gemini: General LLM error"):
            await chat_service_no_db.generate_response([{"role": "user", "content": "hi"}], save_to_db=False)

@pytest.mark.asyncio
@patch("src.chat.service.ChatService._get_llm_client")
async def test_generate_response_quota_exceeded(mock_get_llm, chat_service_no_db):
    mock_llm = AsyncMock()
    mock_llm.acomplete.side_effect = Exception("429 Too Many Requests")
    mock_get_llm.return_value = mock_llm

    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key"):
        with pytest.raises(ValueError, match="The AI service is currently busy"):
            await chat_service_no_db.generate_response([{"role": "user", "content": "hi"}], save_to_db=False)

@pytest.mark.asyncio
async def test_load_conversation_history_no_db(chat_service_no_db):
    with pytest.raises(ValueError, match="Database session required"):
        await chat_service_no_db.load_conversation_history(123)

@pytest.mark.asyncio
@patch("src.chat.service.get_conversation_by_id")
async def test_load_conversation_history_not_found(mock_get_conv, chat_service_with_db):
    mock_get_conv.return_value = None
    with pytest.raises(ValueError, match="Conversation 123 not found"):
        await chat_service_with_db.load_conversation_history(123)

@pytest.mark.asyncio
async def test_get_user_conversation_list_no_db(chat_service_no_db):
    with pytest.raises(ValueError, match="Database session required"):
        await chat_service_no_db.get_user_conversation_list()

@pytest.mark.asyncio
@patch("src.chat.service.ChatService._get_llm_client")
async def test_generate_response_langfuse_trace_error(mock_get_llm, chat_service_no_db):
    # simulate trace object and mock exception inside loop
    mock_llm = AsyncMock()
    mock_llm.acomplete.side_effect = Exception("General error")
    mock_get_llm.return_value = mock_llm
    
    mock_trace = MagicMock()
    chat_service_no_db.langfuse = MagicMock()
    chat_service_no_db.langfuse.trace.return_value = mock_trace
    
    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key"), \
         patch("src.chat.service.settings.LANGFUSE_PUBLIC_KEY", "test"), \
         patch("src.chat.service.settings.LANGFUSE_SECRET_KEY", "test"):
        with pytest.raises(ValueError, match="Error generating response"):
            await chat_service_no_db.generate_response([{"role": "user", "content": "hi"}], save_to_db=False)
            
    mock_trace.update.assert_called_once_with(metadata={"status": "error", "error": "General error"})
