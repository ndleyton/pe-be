from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from src.core.config import settings
import src.workouts.recap as recap_module
from src.workouts.recap import WorkoutRecapService


pytestmark = pytest.mark.asyncio(loop_scope="session")


class _FakeTrace:
    def __init__(self):
        self.generations = []
        self.updates = []

    def generation(self, **kwargs):
        self.generations.append(kwargs)

    def update(self, **kwargs):
        self.updates.append(kwargs)


class _FakeLangfuse:
    def __init__(self):
        self.trace_obj = _FakeTrace()
        self.trace_kwargs = None

    def trace(self, **kwargs):
        self.trace_kwargs = kwargs
        return self.trace_obj


class _FakeModels:
    def __init__(self, response_text=None, error=None):
        self.response_text = response_text
        self.error = error
        self.calls = []

    async def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return SimpleNamespace(text=self.response_text)


class _FakeClient:
    def __init__(self, response_text=None, error=None, api_key=None):
        self.api_key = api_key
        self.models = _FakeModels(response_text=response_text, error=error)
        self.aio = SimpleNamespace(models=self.models)


def _build_exercise(*, notes=None, set_notes=None):
    return SimpleNamespace(
        exercise_type_id=10,
        notes=notes,
        exercise_type=SimpleNamespace(name="Bench Press"),
        exercise_sets=[
            SimpleNamespace(
                deleted_at=None,
                intensity=165,
                reps=6,
                notes=note,
            )
            for note in (set_notes or [])
        ]
        or [
            SimpleNamespace(
                deleted_at=None,
                intensity=165,
                reps=6,
                notes=None,
            )
        ],
    )


async def test_generate_recap_records_langfuse_trace_and_saves(monkeypatch):
    workout = SimpleNamespace(
        id=7,
        name="Push Day",
        notes="Felt strong",
        start_time=datetime(2026, 4, 3, tzinfo=timezone.utc),
        recap=None,
    )
    exercise = _build_exercise(notes="Last set moved well", set_notes=["Felt easy"])
    session = SimpleNamespace(commit=AsyncMock())
    langfuse = _FakeLangfuse()
    client_holder = {}

    async def fake_get_workout_by_id(session, workout_id, user_id):
        return workout

    async def fake_get_exercises_for_workout(session, workout_id):
        return [exercise]

    async def fake_get_exercise_type_stats(session, exercise_type_id, user_id):
        return {
            "progressiveOverload": [
                {
                    "date": "2026-04-02",
                    "maxWeight": 160,
                    "totalVolume": 900,
                }
            ]
        }

    def fake_client_factory(*, api_key):
        client = _FakeClient(
            response_text="Great session. Add 2.5 lb next time.", api_key=api_key
        )
        client_holder["client"] = client
        return client

    monkeypatch.setattr(settings, "GOOGLE_AI_KEY", "google-key")
    monkeypatch.setattr(
        WorkoutRecapService,
        "_get_langfuse_client",
        staticmethod(lambda: langfuse),
    )
    monkeypatch.setattr(recap_module, "get_workout_by_id", fake_get_workout_by_id)
    monkeypatch.setattr(
        recap_module, "get_exercises_for_workout", fake_get_exercises_for_workout
    )
    monkeypatch.setattr(
        recap_module, "get_exercise_type_stats", fake_get_exercise_type_stats
    )
    monkeypatch.setattr(recap_module.genai, "Client", fake_client_factory)

    recap = await WorkoutRecapService.generate_recap(session, 7, 42)

    assert recap == "Great session. Add 2.5 lb next time."
    assert workout.recap == recap
    session.commit.assert_awaited_once()
    assert client_holder["client"].api_key == "google-key"
    assert langfuse.trace_kwargs["name"] == "workout-recap"
    assert langfuse.trace_kwargs["user_id"] == "42"
    assert langfuse.trace_obj.generations[0]["name"] == "workout-recap-generation"
    assert "Push Day" in langfuse.trace_obj.generations[0]["input"][0]["content"]
    assert langfuse.trace_obj.generations[0]["output"] == recap
    assert langfuse.trace_obj.updates[-1]["metadata"]["status"] == "success"


async def test_generate_recap_updates_langfuse_on_error(monkeypatch):
    workout = SimpleNamespace(
        id=9,
        name="Lower Body",
        notes=None,
        start_time=datetime(2026, 4, 3, tzinfo=timezone.utc),
        recap=None,
    )
    session = SimpleNamespace(commit=AsyncMock())
    langfuse = _FakeLangfuse()

    async def fake_get_workout_by_id(session, workout_id, user_id):
        return workout

    async def fake_get_exercises_for_workout(session, workout_id):
        return [_build_exercise()]

    async def fake_get_exercise_type_stats(session, exercise_type_id, user_id):
        return {"progressiveOverload": []}

    def fake_client_factory(*, api_key):
        return _FakeClient(error=RuntimeError("quota exceeded"), api_key=api_key)

    monkeypatch.setattr(settings, "GOOGLE_AI_KEY", "google-key")
    monkeypatch.setattr(
        WorkoutRecapService,
        "_get_langfuse_client",
        staticmethod(lambda: langfuse),
    )
    monkeypatch.setattr(recap_module, "get_workout_by_id", fake_get_workout_by_id)
    monkeypatch.setattr(
        recap_module, "get_exercises_for_workout", fake_get_exercises_for_workout
    )
    monkeypatch.setattr(
        recap_module, "get_exercise_type_stats", fake_get_exercise_type_stats
    )
    monkeypatch.setattr(recap_module.genai, "Client", fake_client_factory)

    recap = await WorkoutRecapService.generate_recap(session, 9, 84)

    assert recap == "Error generating recap: quota exceeded"
    session.commit.assert_not_called()
    assert langfuse.trace_obj.generations == []
    assert langfuse.trace_obj.updates[-1]["metadata"]["status"] == "error"
    assert langfuse.trace_obj.updates[-1]["metadata"]["error"] == "quota exceeded"
