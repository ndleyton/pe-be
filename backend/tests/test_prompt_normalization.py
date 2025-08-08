from src.chat.service import ChatService
from src.workouts.service import WorkoutParsingService


def test_chat_prompt_normalization_handles_list_structure():
    class FakePrompt:
        def __init__(self):
            self.prompt = [
                {"role": "system", "content": [
                    {"type": "text", "text": "Line A"},
                    {"type": "text", "text": "Line B"},
                ]}
            ]

    # Use the internal normalization indirectly by calling the method and simulating return
    svc = ChatService(user_id=1, session=None)
    # Monkeypatch instance method by injecting a lambda to return our fake
    class DummyLangfuse:
        def get_prompt(self, *args, **kwargs):
            return FakePrompt()

    svc.langfuse = DummyLangfuse()

    result = svc._get_system_prompt()
    assert "Line A" in result and "Line B" in result


def test_workout_prompt_normalization_handles_list_structure():
    class FakePrompt:
        def __init__(self):
            self.prompt = [
                {"role": "system", "content": [
                    {"type": "text", "text": "Parse workouts"},
                ]}
            ]

    normalized = WorkoutParsingService._prompt_to_string(FakePrompt())
    assert "Parse workouts" in normalized

