from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from src.chat.service import ChatService


pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_get_last_exercise_performance_happy_path(monkeypatch):
    svc = ChatService(user_id=123, session=object())

    async def _fake_get_exercise_types(session, name, limit):
        assert name == "Deadlift"
        assert limit == 1
        return SimpleNamespace(data=[SimpleNamespace(id=9)])

    async def _fake_get_exercise_type_stats(session, exercise_type_id):
        assert exercise_type_id == 9
        return {
            "lastWorkout": {"date": "2026-02-28", "sets": 5, "maxWeight": 315},
            "intensityUnit": {"abbreviation": "lbs"},
        }

    monkeypatch.setattr("src.chat.service.get_exercise_types", _fake_get_exercise_types)
    monkeypatch.setattr(
        "src.chat.service.get_exercise_type_stats", _fake_get_exercise_type_stats
    )

    summary = await svc._get_last_exercise_performance("Deadlift")
    assert "2026-02-28" in summary
    assert "5 sets" in summary
    assert "315 lbs" in summary


async def test_get_last_workout_summary_happy_path(monkeypatch):
    svc = ChatService(user_id=222, session=object())
    workout = SimpleNamespace(
        id=7,
        name="Upper Strength",
        start_time=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )
    exercise = SimpleNamespace(
        exercise_type=SimpleNamespace(name="Bench Press"),
        exercise_sets=[
            SimpleNamespace(
                id=1,
                reps=8,
                intensity=185,
                intensity_unit=SimpleNamespace(abbreviation="lbs"),
            )
        ],
    )

    async def _fake_get_latest_workout_for_user(session, user_id):
        assert user_id == 222
        return workout

    async def _fake_get_exercises_for_workout(session, workout_id):
        assert workout_id == 7
        return [exercise]

    monkeypatch.setattr(
        "src.chat.service.get_latest_workout_for_user", _fake_get_latest_workout_for_user
    )
    monkeypatch.setattr(
        "src.chat.service.get_exercises_for_workout", _fake_get_exercises_for_workout
    )

    summary = await svc._get_last_workout_summary()
    assert "Upper Strength" in summary
    assert "Bench Press" in summary
    assert "8 reps at 185 lbs" in summary


async def test_get_workout_summary_by_date_happy_path(monkeypatch):
    svc = ChatService(user_id=333, session=object())
    workout = SimpleNamespace(id=5, name="Conditioning")
    exercise = SimpleNamespace(
        exercise_type=SimpleNamespace(name="Row"),
        exercise_sets=[
            SimpleNamespace(
                id=10,
                reps=15,
                intensity=50,
                intensity_unit=SimpleNamespace(abbreviation="kg"),
            )
        ],
    )

    async def _fake_get_workout_by_date(session, user_id, parsed_date):
        assert user_id == 333
        assert parsed_date.isoformat() == "2026-02-20"
        return workout

    async def _fake_get_exercises_for_workout(session, workout_id):
        assert workout_id == 5
        return [exercise]

    monkeypatch.setattr("src.chat.service.get_workout_by_date", _fake_get_workout_by_date)
    monkeypatch.setattr(
        "src.chat.service.get_exercises_for_workout", _fake_get_exercises_for_workout
    )

    summary = await svc._get_workout_summary_by_date("2026-02-20")
    assert "Conditioning" in summary
    assert "Row" in summary
    assert "15 reps at 50 kg" in summary


async def test_generate_response_happy_path_without_persistence(monkeypatch):
    monkeypatch.setattr(
        "src.chat.service.settings.GOOGLE_AI_KEY", "test-key", raising=False
    )

    svc = ChatService(user_id=1, session=None)
    svc._get_system_prompt = lambda: "system prompt"

    class FakeResponse:
        def __init__(self, content):
            self.tool_calls = []
            self.content = content

    class DummyLLM:
        def bind_tools(self, _tools):
            return self

        async def ainvoke(self, _messages):
            return FakeResponse("Use progressive overload.")

    monkeypatch.setattr("src.chat.service.ChatGoogleGenerativeAI", lambda **_: DummyLLM())

    result = await svc.generate_response(
        messages=[{"role": "user", "content": "How do I progress?"}],
        save_to_db=False,
    )
    assert result["message"] == "Use progressive overload."
    assert result["conversation_id"] is None


async def test_generate_response_happy_path_with_persistence(monkeypatch):
    monkeypatch.setattr(
        "src.chat.service.settings.GOOGLE_AI_KEY", "test-key", raising=False
    )

    svc = ChatService(user_id=77, session=object())
    svc._get_system_prompt = lambda: "system prompt"
    saved_messages = []

    async def _fake_get_or_create_active_conversation(session, user_id, title):
        assert user_id == 77
        assert title == "Log my pull day"
        return SimpleNamespace(id=88)

    async def _fake_add_message_to_conversation(
        session, conversation_id, message_data, user_id
    ):
        saved_messages.append((conversation_id, message_data.role, message_data.content))
        return SimpleNamespace(id=len(saved_messages))

    class FakeResponse:
        def __init__(self, content):
            self.tool_calls = []
            self.content = content

    class DummyLLM:
        def bind_tools(self, _tools):
            return self

        async def ainvoke(self, _messages):
            return FakeResponse("Pull day logged.")

    monkeypatch.setattr(
        "src.chat.service.get_or_create_active_conversation",
        _fake_get_or_create_active_conversation,
    )
    monkeypatch.setattr(
        "src.chat.service.add_message_to_conversation",
        _fake_add_message_to_conversation,
    )
    monkeypatch.setattr("src.chat.service.ChatGoogleGenerativeAI", lambda **_: DummyLLM())

    result = await svc.generate_response(
        messages=[{"role": "user", "content": "Log my pull day"}],
        save_to_db=True,
    )
    assert result["conversation_id"] == 88
    assert result["message"] == "Pull day logged."
    assert saved_messages == [
        (88, "user", "Log my pull day"),
        (88, "assistant", "Pull day logged."),
    ]


async def test_chat_service_history_and_conversation_list_happy_path(monkeypatch):
    svc = ChatService(user_id=10, session=object())
    conversation = SimpleNamespace(
        messages=[
            SimpleNamespace(role="user", content="hello"),
            SimpleNamespace(role="assistant", content="hi"),
        ]
    )
    conversations = [
        SimpleNamespace(
            id=1,
            title="Chat 1",
            created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
            updated_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
            is_active=True,
        )
    ]

    async def _fake_get_conversation_by_id(session, conversation_id, user_id):
        assert conversation_id == 5
        assert user_id == 10
        return conversation

    async def _fake_get_user_conversations(session, user_id, limit, offset):
        assert user_id == 10
        assert limit == 20
        assert offset == 0
        return conversations

    monkeypatch.setattr(
        "src.chat.service.get_conversation_by_id", _fake_get_conversation_by_id
    )
    monkeypatch.setattr(
        "src.chat.service.get_user_conversations", _fake_get_user_conversations
    )

    history = await svc.load_conversation_history(5)
    assert history == [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": "hi"},
    ]

    conv_list = await svc.get_user_conversation_list()
    assert conv_list[0]["id"] == 1
    assert conv_list[0]["title"] == "Chat 1"
    assert conv_list[0]["is_active"] is True
