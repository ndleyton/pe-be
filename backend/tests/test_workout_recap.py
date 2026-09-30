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


def _extract_metrics_payload(prompt: str):
    metrics_json = prompt.split("Metrics:\n", maxsplit=1)[1].split(
        "\n\nGuidelines:", maxsplit=1
    )[0]
    return recap_module.json.loads(metrics_json)


def _build_exercise(
    *,
    notes=None,
    set_notes=None,
    intensity=165,
    side=None,
    intensity_unit_abbreviation="kg",
):
    return SimpleNamespace(
        exercise_type_id=10,
        notes=notes,
        exercise_type=SimpleNamespace(name="Bench Press"),
        exercise_sets=[
            SimpleNamespace(
                deleted_at=None,
                done=True,
                side=side,
                intensity=intensity,
                reps=6,
                notes=note,
                intensity_unit=(
                    SimpleNamespace(abbreviation=intensity_unit_abbreviation)
                    if intensity_unit_abbreviation
                    else None
                ),
            )
            for note in (set_notes or [])
        ]
        or [
            SimpleNamespace(
                deleted_at=None,
                done=True,
                side=side,
                intensity=intensity,
                reps=6,
                notes=None,
                intensity_unit=(
                    SimpleNamespace(abbreviation=intensity_unit_abbreviation)
                    if intensity_unit_abbreviation
                    else None
                ),
            )
        ],
    )


@pytest.mark.parametrize("strict", [False, True])
async def test_generate_recap_records_langfuse_trace_and_saves(monkeypatch, strict):
    workout = SimpleNamespace(
        id=7,
        name="Push Day",
        notes="Felt strong",
        start_time=datetime(2026, 4, 3, tzinfo=timezone.utc),
        recap=None,
    )
    exercise = _build_exercise(notes="Last set moved well", set_notes=["Felt easy"])
    session = SimpleNamespace(commit=AsyncMock(), flush=AsyncMock())
    langfuse = _FakeLangfuse()
    client_holder = {}

    async def fake_get_workout_by_id(session, workout_id, user_id):
        return workout

    async def fake_get_exercises_for_workout(session, workout_id):
        return [exercise]

    async def fake_get_exercise_type_stats(
        session, exercise_type_id, user_id, **kwargs
    ):
        return {
            "sessions": [
                {
                    "workoutId": 1,
                    "date": "2026-04-02",
                    "maxWeight": 160,
                    "totalVolume": 900,
                    "sideBreakdown": {"both": {"maxWeight": 160, "totalVolume": 900}},
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

    recap = await WorkoutRecapService.generate_recap(
        session, 7, 42, raise_on_error=strict
    )

    assert recap == "Great session. Add 2.5 lb next time."
    assert workout.recap == recap
    if strict:
        session.flush.assert_awaited_once()
        session.commit.assert_not_awaited()
    else:
        session.commit.assert_awaited_once()
        session.flush.assert_not_awaited()
    assert client_holder["client"].api_key == "google-key"
    assert langfuse.trace_kwargs["name"] == "workout-recap"
    assert langfuse.trace_kwargs["user_id"] == "42"
    assert langfuse.trace_obj.generations[0]["name"] == "workout-recap-generation"
    assert "Push Day" in langfuse.trace_obj.generations[0]["input"][0]["content"]
    assert langfuse.trace_obj.generations[0]["output"] == recap
    assert langfuse.trace_obj.updates[-1]["metadata"]["status"] == "success"


async def test_generate_recap_converts_current_metrics_into_prompt_display_unit(
    monkeypatch,
):
    workout = SimpleNamespace(
        id=11,
        name="Push Day",
        notes=None,
        start_time=datetime(2026, 4, 3, tzinfo=timezone.utc),
        recap=None,
    )
    exercise = _build_exercise(intensity=225, intensity_unit_abbreviation="lb")
    session = SimpleNamespace(commit=AsyncMock())
    client_holder = {}

    async def fake_get_workout_by_id(session, workout_id, user_id):
        return workout

    async def fake_get_exercises_for_workout(session, workout_id):
        return [exercise]

    async def fake_get_exercise_type_stats(
        session, exercise_type_id, user_id, **kwargs
    ):
        return {
            "sessions": [
                {
                    "workoutId": 1,
                    "date": "2026-04-02",
                    "maxWeight": 100,
                    "totalVolume": 600,
                    "sideBreakdown": {"both": {"maxWeight": 100, "totalVolume": 600}},
                }
            ],
            "intensityUnit": {
                "id": 1,
                "name": "Kilograms",
                "abbreviation": "kg",
            },
        }

    def fake_client_factory(*, api_key):
        client = _FakeClient(response_text="Solid work.", api_key=api_key)
        client_holder["client"] = client
        return client

    monkeypatch.setattr(settings, "GOOGLE_AI_KEY", "google-key")
    monkeypatch.setattr(
        WorkoutRecapService,
        "_get_langfuse_client",
        staticmethod(lambda: None),
    )
    monkeypatch.setattr(recap_module, "get_workout_by_id", fake_get_workout_by_id)
    monkeypatch.setattr(
        recap_module, "get_exercises_for_workout", fake_get_exercises_for_workout
    )
    monkeypatch.setattr(
        recap_module, "get_exercise_type_stats", fake_get_exercise_type_stats
    )
    monkeypatch.setattr(recap_module.genai, "Client", fake_client_factory)

    recap = await WorkoutRecapService.generate_recap(session, 11, 42)

    assert recap == "Solid work."
    prompt = client_holder["client"].models.calls[0]["contents"][0]
    metrics = _extract_metrics_payload(prompt)
    assert metrics[0]["intensity_unit"] == "kg"
    assert metrics[0]["current"]["top_set_intensity_achieved"] == pytest.approx(102.058)
    assert metrics[0]["current"]["total_volume"] == pytest.approx(612.348)
    assert metrics[0]["previous"]["max_intensity"] == 100
    assert "top_set_intensity_achieved" in prompt


@pytest.mark.parametrize("strict", [False, True])
async def test_generate_recap_updates_langfuse_on_error(monkeypatch, strict):
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

    async def fake_get_exercise_type_stats(
        session, exercise_type_id, user_id, **kwargs
    ):
        return {"sessions": []}

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

    if strict:
        with pytest.raises(RuntimeError, match="quota exceeded"):
            await WorkoutRecapService.generate_recap(
                session, 9, 84, raise_on_error=True
            )
    else:
        recap = await WorkoutRecapService.generate_recap(session, 9, 84)
        assert recap == "Error generating recap: quota exceeded"
    session.commit.assert_not_called()
    assert langfuse.trace_obj.generations == []
    assert langfuse.trace_obj.updates[-1]["metadata"]["status"] == "error"
    assert langfuse.trace_obj.updates[-1]["metadata"]["error"] == "quota exceeded"


@pytest.mark.parametrize("failure", ["missing_key", "empty_response", "blank_response"])
async def test_strict_recap_does_not_save_unavailable_generation(monkeypatch, failure):
    workout = SimpleNamespace(
        id=9,
        name="Workout",
        notes=None,
        start_time=datetime(2026, 4, 3, tzinfo=timezone.utc),
        recap=None,
    )
    session = SimpleNamespace(commit=AsyncMock())
    monkeypatch.setattr(
        settings, "GOOGLE_AI_KEY", "" if failure == "missing_key" else "test-key"
    )
    monkeypatch.setattr(
        recap_module, "get_workout_by_id", AsyncMock(return_value=workout)
    )
    monkeypatch.setattr(
        recap_module,
        "get_exercises_for_workout",
        AsyncMock(return_value=[_build_exercise()]),
    )
    monkeypatch.setattr(
        recap_module,
        "get_exercise_type_stats",
        AsyncMock(return_value={"sessions": []}),
    )
    monkeypatch.setattr(
        WorkoutRecapService, "_get_langfuse_client", staticmethod(lambda: None)
    )
    monkeypatch.setattr(
        recap_module.genai,
        "Client",
        lambda **kwargs: _FakeClient(
            response_text="   " if failure == "blank_response" else None
        ),
    )

    with pytest.raises(RuntimeError, match="API key missing|returned no text"):
        await WorkoutRecapService.generate_recap(session, 9, 84, raise_on_error=True)

    assert workout.recap is None
    session.commit.assert_not_awaited()


@pytest.mark.parametrize("current_weight, is_pr", [(30, False), (45, True)])
async def test_recap_compares_records_only_with_same_side_history(
    monkeypatch, current_weight, is_pr
):
    workout = SimpleNamespace(
        id=7,
        name="Unilateral",
        notes=None,
        start_time=datetime(2026, 4, 3, tzinfo=timezone.utc),
        recap=None,
    )
    exercises = [
        _build_exercise(
            intensity=current_weight, side="right", notes="Keep a controlled tempo"
        ),
        _build_exercise(intensity=100, side="left", notes="Keep a controlled tempo"),
        _build_exercise(intensity=200, side=None, notes="Pause at the bottom"),
    ]
    client = _FakeClient(response_text="Recap")

    # The most recent overall session is left-only. The most recent right
    # session is lighter than an older right record. Current/future sessions
    # must never become historical baselines.
    def prior(workout_id, date, side, weight):
        return {
            "workoutId": workout_id,
            "date": date,
            "maxWeight": weight,
            "totalVolume": weight * 6,
            "sideBreakdown": {side: {"maxWeight": weight, "totalVolume": weight * 6}},
        }

    stats = {
        "sessions": [
            prior(1, "2026-03-30T00:00:00+00:00", "right", 40),
            prior(2, "2026-03-31T00:00:00+00:00", "right", 25),
            prior(3, "2026-04-02T00:00:00+00:00", "left", 20),
            prior(7, "2026-04-03T00:00:00+00:00", "right", current_weight),
            prior(8, "2026-04-04T00:00:00+00:00", "right", 90),
        ],
    }
    monkeypatch.setattr(settings, "GOOGLE_AI_KEY", "test-key")
    monkeypatch.setattr(WorkoutRecapService, "_get_langfuse_client", lambda: None)
    monkeypatch.setattr(recap_module.genai, "Client", lambda **kwargs: client)
    monkeypatch.setattr(
        recap_module, "get_workout_by_id", AsyncMock(return_value=workout)
    )
    monkeypatch.setattr(
        recap_module, "get_exercises_for_workout", AsyncMock(return_value=exercises)
    )
    monkeypatch.setattr(
        recap_module, "get_exercise_type_stats", AsyncMock(return_value=stats)
    )

    await WorkoutRecapService.generate_recap(SimpleNamespace(commit=AsyncMock()), 7, 42)

    metrics = {
        item["side"]: item
        for item in _extract_metrics_payload(client.models.calls[0]["contents"][0])
    }
    assert metrics["right"]["is_pr"] is is_pr
    assert metrics["right"]["previous"] == {"max_intensity": 25, "volume": 150}
    assert metrics["right"]["current"]["sets"] == 1
    assert metrics["left"]["is_pr"] is True
    assert metrics["left"]["previous"]["max_intensity"] == 20
    assert metrics["both"]["is_pr"] is False
    assert metrics["both"]["is_new_side"] is True
    assert "previous" not in metrics["both"]
    assert [
        item["exercise_notes"] for item in metrics.values() if "exercise_notes" in item
    ] == ["Keep a controlled tempo\nPause at the bottom"]


@pytest.mark.parametrize(
    "unit,intensity", [("bw", 50), ("unknown", 50), (None, 50), ("kg", None)]
)
@pytest.mark.parametrize("include_valid", [False, True])
async def test_recap_excludes_invalid_loads_but_retains_completed_counts(
    monkeypatch, unit, intensity, include_valid
):
    workout = SimpleNamespace(
        id=7,
        name="Workout",
        notes=None,
        start_time=datetime(2026, 4, 3, tzinfo=timezone.utc),
        recap=None,
    )
    exercises = [
        _build_exercise(
            intensity=intensity,
            intensity_unit_abbreviation=unit,
            side="left",
            set_notes=["Controlled tempo"],
        )
    ]
    if include_valid:
        exercises.append(_build_exercise(intensity=5, side="left"))
    stats = {
        "intensityUnit": {"abbreviation": "kg"},
        "sessions": [
            {
                "workoutId": 1,
                "date": "2026-04-02",
                "sideBreakdown": {"left": {"maxWeight": 10, "totalVolume": 60}},
            }
        ],
    }
    client = _FakeClient(response_text="Recap")
    monkeypatch.setattr(settings, "GOOGLE_AI_KEY", "test-key")
    monkeypatch.setattr(WorkoutRecapService, "_get_langfuse_client", lambda: None)
    monkeypatch.setattr(recap_module.genai, "Client", lambda **kwargs: client)
    monkeypatch.setattr(
        recap_module, "get_workout_by_id", AsyncMock(return_value=workout)
    )
    monkeypatch.setattr(
        recap_module, "get_exercises_for_workout", AsyncMock(return_value=exercises)
    )
    monkeypatch.setattr(
        recap_module, "get_exercise_type_stats", AsyncMock(return_value=stats)
    )

    await WorkoutRecapService.generate_recap(SimpleNamespace(commit=AsyncMock()), 7, 42)

    metric = _extract_metrics_payload(client.models.calls[0]["contents"][0])[0]
    assert metric["is_pr"] is False
    assert "volume_increased" not in metric
    assert metric["load_excluded_sets"] == 1
    assert metric["set_notes"] == ["Controlled tempo"]
    assert metric["current"]["sets"] == (2 if include_valid else 1)
    assert metric["current"]["total_reps"] == (12 if include_valid else 6)
    if include_valid:
        assert metric["current"]["top_set_intensity_achieved"] == 5
        assert metric["current"]["total_volume"] == 30
    else:
        assert "top_set_intensity_achieved" not in metric["current"]
        assert "total_volume" not in metric["current"]
