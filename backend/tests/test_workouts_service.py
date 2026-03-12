from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from src.core.config import settings
from src.workouts.schemas import (
    AddExerciseRequest,
    ExerciseSetInput,
    ParsedExercise,
    ParsedExerciseSet,
    WorkoutCreate,
    WorkoutParseResponse,
    WorkoutTypeCreate,
    WorkoutUpdate,
)
from src.workouts.service import (
    DEFAULT_STRENGTH_TRAINING_WORKOUT_TYPE_ID,
    WorkoutParsingService,
    WorkoutService,
    WorkoutTypeService,
)


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
    def __init__(self, prompt=None, prompt_error=None):
        self.prompt = prompt
        self.prompt_error = prompt_error
        self.trace_obj = _FakeTrace()

    def trace(self, **kwargs):
        self.trace_kwargs = kwargs
        return self.trace_obj

    def get_prompt(self, *args, **kwargs):
        if self.prompt_error:
            raise self.prompt_error
        return self.prompt


class _FakeLLM:
    def __init__(self, response_text=None, error=None, **kwargs):
        self.response_text = response_text
        self.error = error
        self.kwargs = kwargs
        self.messages = None

    async def ainvoke(self, messages):
        self.messages = messages
        if self.error:
            raise self.error
        return SimpleNamespace(content=self.response_text)


async def test_workout_service_crud_wrappers_forward_calls(monkeypatch):
    workout = SimpleNamespace(id=10)
    workouts = [SimpleNamespace(id=1), SimpleNamespace(id=2)]
    workout_type = SimpleNamespace(id=4)

    fake_get_workout_by_id = AsyncMock(return_value=workout)
    fake_get_user_workouts = AsyncMock(return_value=workouts)
    fake_create_workout = AsyncMock(return_value=workout)
    fake_update_workout = AsyncMock(return_value=workout)
    fake_get_workout_types = AsyncMock(return_value=[workout_type])
    fake_create_workout_type = AsyncMock(return_value=workout_type)

    monkeypatch.setattr(
        "src.workouts.service.get_workout_by_id", fake_get_workout_by_id
    )
    monkeypatch.setattr(
        "src.workouts.service.get_user_workouts", fake_get_user_workouts
    )
    monkeypatch.setattr("src.workouts.service.create_workout", fake_create_workout)
    monkeypatch.setattr("src.workouts.service.update_workout", fake_update_workout)
    monkeypatch.setattr(
        "src.workouts.service.get_workout_types", fake_get_workout_types
    )
    monkeypatch.setattr(
        "src.workouts.service.create_workout_type", fake_create_workout_type
    )

    session = object()
    workout_create = WorkoutCreate(name="Lift", workout_type_id=4)
    workout_update = WorkoutUpdate(name="Updated")
    workout_type_create = WorkoutTypeCreate(name="Strength", description="Heavy")

    assert await WorkoutService.get_workout(session, 10, 7) is workout
    assert (
        await WorkoutService.get_my_workouts(session, 7, limit=5, cursor=2) == workouts
    )
    assert (
        await WorkoutService.create_new_workout(session, workout_create, 7) is workout
    )
    assert (
        await WorkoutService.update_workout_data(session, 10, workout_update, 7)
        is workout
    )
    assert await WorkoutTypeService.get_all_workout_types(session) == [workout_type]
    assert (
        await WorkoutTypeService.create_new_workout_type(session, workout_type_create)
        is workout_type
    )

    fake_get_workout_by_id.assert_any_await(session, 10, 7)
    fake_get_user_workouts.assert_awaited_once_with(session, 7, 5, 2)
    fake_create_workout.assert_awaited_once_with(session, workout_create, 7)
    fake_update_workout.assert_awaited_once_with(session, 10, workout_update, 7)
    fake_get_workout_types.assert_awaited_once_with(session)
    fake_create_workout_type.assert_awaited_once_with(session, workout_type_create)


async def test_remove_workout_is_idempotent_and_rolls_back_on_failure():
    success_session = SimpleNamespace(
        execute=AsyncMock(),
        commit=AsyncMock(),
        rollback=AsyncMock(),
    )
    assert await WorkoutService.remove_workout(success_session, 12, 34) is True
    success_session.execute.assert_awaited_once()
    success_session.commit.assert_awaited_once()
    success_session.rollback.assert_not_called()

    failing_session = SimpleNamespace(
        execute=AsyncMock(),
        commit=AsyncMock(side_effect=RuntimeError("commit failed")),
        rollback=AsyncMock(),
    )
    with pytest.raises(RuntimeError, match="commit failed"):
        await WorkoutService.remove_workout(failing_session, 12, 34)
    failing_session.rollback.assert_awaited_once()


async def test_add_exercise_to_current_workout_reuses_existing_exercise(monkeypatch):
    workout = SimpleNamespace(id=100)
    exercise = SimpleNamespace(id=200, exercise_type_id=3)
    final_workout = SimpleNamespace(id=100, name="Today")

    fake_get_workout_by_date = AsyncMock(return_value=workout)
    fake_get_exercises_for_workout = AsyncMock(return_value=[exercise])
    fake_get_workout_by_id = AsyncMock(return_value=final_workout)
    fake_create_workout = AsyncMock()
    fake_create_exercise = AsyncMock()
    fake_create_exercise_set = AsyncMock()

    monkeypatch.setattr(
        "src.workouts.service.get_workout_by_date", fake_get_workout_by_date
    )
    monkeypatch.setattr(
        "src.workouts.service.get_exercises_for_workout", fake_get_exercises_for_workout
    )
    monkeypatch.setattr(
        "src.workouts.service.get_workout_by_id", fake_get_workout_by_id
    )
    monkeypatch.setattr("src.workouts.service.create_workout", fake_create_workout)
    monkeypatch.setattr("src.workouts.service.create_exercise", fake_create_exercise)
    monkeypatch.setattr(
        "src.workouts.service.create_exercise_set", fake_create_exercise_set
    )

    result = await WorkoutService.add_exercise_to_current_workout(
        session=object(),
        user_id=8,
        payload=AddExerciseRequest(exercise_type_id=3),
    )

    assert result is final_workout
    fake_create_workout.assert_not_called()
    fake_create_exercise.assert_not_called()
    fake_create_exercise_set.assert_not_called()


async def test_add_exercise_to_current_workout_creates_missing_workout_and_set(
    monkeypatch,
):
    created_workout = SimpleNamespace(id=101)
    created_exercise = SimpleNamespace(id=202)
    final_workout = SimpleNamespace(id=101, name="Workout")
    create_exercise_set_calls = []

    fake_get_workout_by_date = AsyncMock(return_value=None)
    fake_create_workout = AsyncMock(return_value=created_workout)
    fake_get_exercises_for_workout = AsyncMock(return_value=[])
    fake_create_exercise = AsyncMock(return_value=created_exercise)
    fake_get_workout_by_id = AsyncMock(return_value=final_workout)

    async def fake_create_exercise_set(session, payload):
        create_exercise_set_calls.append(payload)
        return SimpleNamespace(id=303)

    monkeypatch.setattr(
        "src.workouts.service.get_workout_by_date", fake_get_workout_by_date
    )
    monkeypatch.setattr("src.workouts.service.create_workout", fake_create_workout)
    monkeypatch.setattr(
        "src.workouts.service.get_exercises_for_workout", fake_get_exercises_for_workout
    )
    monkeypatch.setattr("src.workouts.service.create_exercise", fake_create_exercise)
    monkeypatch.setattr(
        "src.workouts.service.create_exercise_set", fake_create_exercise_set
    )
    monkeypatch.setattr(
        "src.workouts.service.get_workout_by_id", fake_get_workout_by_id
    )

    payload = AddExerciseRequest(
        exercise_type_id=5,
        initial_set=ExerciseSetInput(
            reps=8,
            intensity=80,
            intensity_unit_id=9,
            rest_time_seconds=120,
        ),
    )

    result = await WorkoutService.add_exercise_to_current_workout(
        session=object(),
        user_id=6,
        payload=payload,
    )

    assert result is final_workout
    created_payload = fake_create_workout.await_args.args[1]
    assert created_payload.workout_type_id == DEFAULT_STRENGTH_TRAINING_WORKOUT_TYPE_ID
    assert created_payload.name.startswith("Workout ")

    exercise_payload = fake_create_exercise.await_args.args[1]
    assert exercise_payload.exercise_type_id == 5
    assert exercise_payload.workout_id == created_workout.id

    assert len(create_exercise_set_calls) == 1
    set_payload = create_exercise_set_calls[0]
    assert set_payload.exercise_id == created_exercise.id
    assert set_payload.done is False
    assert set_payload.intensity_unit_id == 9


async def test_create_workout_from_parsed_prefers_exact_match_and_fallback_unit(
    monkeypatch,
):
    parsed = WorkoutParseResponse(
        name="Parsed Workout",
        notes="notes",
        workout_type_id=4,
        exercises=[
            ParsedExercise(
                exercise_type_name="Bench Press",
                notes="heavy",
                sets=[
                    ParsedExerciseSet(
                        reps=5,
                        intensity=100,
                        intensity_unit="",
                        rest_time_seconds=180,
                    )
                ],
            ),
            ParsedExercise(
                exercise_type_name="Odd Lift",
                notes=None,
                sets=[],
            ),
        ],
    )

    units = [
        SimpleNamespace(id=91, name="time-based", abbreviation="time"),
        SimpleNamespace(id=92, name="Pounds", abbreviation="lbs"),
    ]
    created_sets = []
    created_types = []
    created_exercises = []

    async def fake_create_workout(session, workout_create, user_id):
        return SimpleNamespace(id=501)

    async def fake_get_intensity_units(session):
        return units

    async def fake_get_exercise_types(
        session, name=None, order_by="usage", offset=0, limit=100
    ):
        if name == "Bench Press":
            return SimpleNamespace(
                data=[SimpleNamespace(id=2, name="Bench Press")],
                next_cursor=None,
            )
        return SimpleNamespace(data=[], next_cursor=None)

    async def fake_create_exercise_type(session, exercise_type_create):
        created_types.append(exercise_type_create)
        return SimpleNamespace(id=77, name=exercise_type_create.name)

    async def fake_create_exercise(session, exercise_create):
        created_exercises.append(exercise_create)
        return SimpleNamespace(id=600 + len(created_exercises))

    async def fake_create_exercise_set(session, exercise_set_create):
        created_sets.append(exercise_set_create)
        return SimpleNamespace(id=700 + len(created_sets))

    async def fake_get_workout_by_id(session, workout_id, user_id):
        return SimpleNamespace(id=workout_id, user_id=user_id, exercises=[])

    monkeypatch.setattr("src.workouts.service.create_workout", fake_create_workout)
    monkeypatch.setattr(
        "src.workouts.service.get_intensity_units", fake_get_intensity_units
    )
    monkeypatch.setattr(
        "src.workouts.service.get_exercise_types", fake_get_exercise_types
    )
    monkeypatch.setattr(
        "src.workouts.service.create_exercise_type", fake_create_exercise_type
    )
    monkeypatch.setattr("src.workouts.service.create_exercise", fake_create_exercise)
    monkeypatch.setattr(
        "src.workouts.service.create_exercise_set", fake_create_exercise_set
    )
    monkeypatch.setattr(
        "src.workouts.service.get_workout_by_id", fake_get_workout_by_id
    )

    result = await WorkoutService.create_workout_from_parsed(
        session=object(), user_id=11, parsed=parsed
    )

    assert result.id == 501
    assert created_exercises[0].exercise_type_id == 2
    assert created_exercises[1].exercise_type_id == 77
    assert created_types[0].default_intensity_unit == 91
    assert created_types[0].description == "Created from chat parsed workout"
    assert created_sets[0].intensity_unit_id == 91
    assert created_sets[0].done is True


async def test_create_workout_from_parsed_uses_empty_units_list_and_errors_on_set(
    monkeypatch,
):
    parsed = WorkoutParseResponse(
        name="Parsed Workout",
        notes=None,
        workout_type_id=4,
        exercises=[
            ParsedExercise(
                exercise_type_name="Bench Press",
                notes=None,
                sets=[
                    ParsedExerciseSet(
                        reps=5,
                        intensity=100,
                        intensity_unit="",
                        rest_time_seconds=None,
                    )
                ],
            )
        ],
    )

    async def fake_create_workout(session, workout_create, user_id):
        return SimpleNamespace(id=901)

    async def fake_get_intensity_units(session):
        return None

    async def fake_get_exercise_types(
        session, name=None, order_by="usage", offset=0, limit=100
    ):
        return SimpleNamespace(data=[SimpleNamespace(id=10, name="Bench Press")])

    async def fake_create_exercise(session, exercise_create):
        return SimpleNamespace(id=902)

    monkeypatch.setattr("src.workouts.service.create_workout", fake_create_workout)
    monkeypatch.setattr(
        "src.workouts.service.get_intensity_units", fake_get_intensity_units
    )
    monkeypatch.setattr(
        "src.workouts.service.get_exercise_types", fake_get_exercise_types
    )
    monkeypatch.setattr("src.workouts.service.create_exercise", fake_create_exercise)

    with pytest.raises(
        ValueError,
        match="Cannot create exercise set: no intensity units are configured",
    ):
        await WorkoutService.create_workout_from_parsed(
            session=object(), user_id=3, parsed=parsed
        )


async def test_prompt_to_string_handles_to_string_dict_and_exception_paths():
    class PromptWithToString:
        def to_string(self):
            return "from helper"

    assert (
        WorkoutParsingService._prompt_to_string(PromptWithToString()) == "from helper"
    )
    assert (
        WorkoutParsingService._prompt_to_string(SimpleNamespace(prompt="raw prompt"))
        == "raw prompt"
    )
    assert (
        WorkoutParsingService._prompt_to_string(
            [
                {"content": "line from dict"},
                {"content": [{"type": "text", "text": "nested text"}, "plain item"]},
                "top level string",
            ]
        )
        == "line from dict\nnested text\nplain item\ntop level string"
    )
    assert (
        WorkoutParsingService._prompt_to_string({"content": "direct dict content"})
        == "direct dict content"
    )
    assert WorkoutParsingService._prompt_to_string({"content": ["a", "b"]}) == "a\nb"
    assert WorkoutParsingService._prompt_to_string(123) == "123"

    class PromptWithBrokenToString:
        def to_string(self):
            raise RuntimeError("boom")

        def __str__(self):
            return "string fallback"

    assert (
        WorkoutParsingService._prompt_to_string(PromptWithBrokenToString())
        == "string fallback"
    )
    assert "fitness expert assistant" in WorkoutParsingService._get_fallback_prompt()


async def test_get_langfuse_client_handles_configured_and_missing_keys(monkeypatch):
    captured = {}

    class FakeLangfuse:
        def __init__(self, public_key, secret_key, host):
            captured["args"] = (public_key, secret_key, host)

    monkeypatch.setattr("src.workouts.service.Langfuse", FakeLangfuse)
    monkeypatch.setattr(settings, "LANGFUSE_PUBLIC_KEY", "pub")
    monkeypatch.setattr(settings, "LANGFUSE_SECRET_KEY", "sec")
    monkeypatch.setattr(settings, "LANGFUSE_HOST", "https://langfuse.test")

    client = WorkoutParsingService._get_langfuse_client()
    assert isinstance(client, FakeLangfuse)
    assert captured["args"] == ("pub", "sec", "https://langfuse.test")

    monkeypatch.setattr(settings, "LANGFUSE_PUBLIC_KEY", "")
    monkeypatch.setattr(settings, "LANGFUSE_SECRET_KEY", "")
    assert WorkoutParsingService._get_langfuse_client() is None


async def test_parse_workout_text_uses_langfuse_prompt_and_records_success(monkeypatch):
    trace_langfuse = _FakeLangfuse(
        prompt=SimpleNamespace(to_string=lambda: "Prompt body")
    )
    llm_holder = {}

    def fake_llm_factory(**kwargs):
        llm = _FakeLLM(
            response_text="""```json
{"name":"Leg Day","notes":null,"workout_type_id":4,"exercises":[]}
```""",
            **kwargs,
        )
        llm_holder["llm"] = llm
        return llm

    monkeypatch.setattr(settings, "GOOGLE_AI_KEY", "google-key")
    monkeypatch.setattr(
        WorkoutParsingService,
        "_get_langfuse_client",
        staticmethod(lambda: trace_langfuse),
    )
    monkeypatch.setattr("src.workouts.service.ChatGoogleGenerativeAI", fake_llm_factory)

    result = await WorkoutParsingService.parse_workout_text("squat 3x5")

    assert result.name == "Leg Day"
    assert trace_langfuse.trace_kwargs["name"] == "workout-parsing"
    assert trace_langfuse.trace_obj.generations[0]["name"] == "prompt-fetch"
    assert (
        trace_langfuse.trace_obj.generations[1]["name"] == "workout-parsing-generation"
    )
    assert trace_langfuse.trace_obj.updates[-1]["metadata"]["status"] == "success"
    assert llm_holder["llm"].kwargs["google_api_key"] == "google-key"
    assert llm_holder["llm"].messages[0].content == "Prompt body"


async def test_parse_workout_text_falls_back_when_prompt_fetch_fails(monkeypatch):
    langfuse = _FakeLangfuse(prompt_error=RuntimeError("prompt unavailable"))
    llm_holder = {}

    def fake_llm_factory(**kwargs):
        llm = _FakeLLM(
            response_text="""```
{"name":"Run","notes":"tempo","workout_type_id":1,"exercises":[]}
```""",
            **kwargs,
        )
        llm_holder["llm"] = llm
        return llm

    monkeypatch.setattr(settings, "GOOGLE_AI_KEY", "google-key")
    monkeypatch.setattr(
        WorkoutParsingService,
        "_get_langfuse_client",
        staticmethod(lambda: langfuse),
    )
    monkeypatch.setattr(
        WorkoutParsingService,
        "_get_fallback_prompt",
        staticmethod(lambda: "fallback prompt"),
    )
    monkeypatch.setattr("src.workouts.service.ChatGoogleGenerativeAI", fake_llm_factory)

    result = await WorkoutParsingService.parse_workout_text("run")

    assert result.name == "Run"
    assert len(langfuse.trace_obj.generations) == 1
    assert langfuse.trace_obj.generations[0]["name"] == "workout-parsing-generation"
    assert llm_holder["llm"].messages[0].content == "fallback prompt"


async def test_parse_workout_text_without_langfuse_uses_fallback_prompt(monkeypatch):
    llm_holder = {}

    def fake_llm_factory(**kwargs):
        llm = _FakeLLM(
            response_text='{"name":"Swim","notes":null,"workout_type_id":3,"exercises":[]}',
            **kwargs,
        )
        llm_holder["llm"] = llm
        return llm

    monkeypatch.setattr(settings, "GOOGLE_AI_KEY", "google-key")
    monkeypatch.setattr(
        WorkoutParsingService,
        "_get_langfuse_client",
        staticmethod(lambda: None),
    )
    monkeypatch.setattr("src.workouts.service.ChatGoogleGenerativeAI", fake_llm_factory)

    result = await WorkoutParsingService.parse_workout_text("swim session")

    assert result.name == "Swim"
    assert "fitness expert assistant" in llm_holder["llm"].messages[0].content


async def test_parse_workout_text_raises_when_google_key_missing(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_AI_KEY", "")
    with pytest.raises(ValueError, match="Google AI API key not configured"):
        await WorkoutParsingService.parse_workout_text("anything")


async def test_parse_workout_text_wraps_json_decode_errors(monkeypatch):
    langfuse = _FakeLangfuse(prompt=SimpleNamespace(to_string=lambda: "Prompt"))

    def fake_llm_factory(**kwargs):
        return _FakeLLM(response_text="not json", **kwargs)

    monkeypatch.setattr(settings, "GOOGLE_AI_KEY", "google-key")
    monkeypatch.setattr(
        WorkoutParsingService,
        "_get_langfuse_client",
        staticmethod(lambda: langfuse),
    )
    monkeypatch.setattr("src.workouts.service.ChatGoogleGenerativeAI", fake_llm_factory)

    with pytest.raises(ValueError, match="Failed to parse LLM response as JSON"):
        await WorkoutParsingService.parse_workout_text("bad output")

    assert langfuse.trace_obj.updates[-1]["metadata"]["status"] == "error"


async def test_parse_workout_text_wraps_general_errors(monkeypatch):
    langfuse = _FakeLangfuse(prompt=SimpleNamespace(to_string=lambda: "Prompt"))

    def fake_llm_factory(**kwargs):
        return _FakeLLM(error=RuntimeError("network issue"), **kwargs)

    monkeypatch.setattr(settings, "GOOGLE_AI_KEY", "google-key")
    monkeypatch.setattr(
        WorkoutParsingService,
        "_get_langfuse_client",
        staticmethod(lambda: langfuse),
    )
    monkeypatch.setattr("src.workouts.service.ChatGoogleGenerativeAI", fake_llm_factory)

    with pytest.raises(
        ValueError, match="Error parsing workout with Gemini: network issue"
    ):
        await WorkoutParsingService.parse_workout_text("bad output")

    assert langfuse.trace_obj.updates[-1]["metadata"]["status"] == "error"
