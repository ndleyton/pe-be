import pytest
from types import SimpleNamespace

from src.workouts.service import WorkoutService
from src.workouts.schemas import (
    WorkoutParseResponse,
    ParsedExercise,
    ParsedExerciseSet,
)


@pytest.mark.asyncio
async def test_create_workout_from_parsed_calls_persistence_pipeline(monkeypatch):
    # Arrange parsed payload
    parsed = WorkoutParseResponse(
        name="Walking",
        notes=None,
        workout_type_id=2,
        exercises=[
            ParsedExercise(
                exercise_type_name="Walking",
                notes=None,
                sets=[
                    ParsedExerciseSet(
                        reps=None,
                        duration_seconds=1800,
                        intensity=30.0,
                        intensity_unit="minutes",
                        rest_time_seconds=None,
                        notes="Easy pace",
                    )
                ],
            )
        ],
    )

    # Capture calls
    calls = {
        "create_workout": None,
        "get_intensity_units": None,
        "get_exercise_types": None,
        "create_exercise_type": None,
        "create_exercise": None,
        "create_exercise_set": [],
        "get_workout_by_id": None,
    }

    # Stubs
    async def fake_create_workout(session, workout_create, user_id):
        calls["create_workout"] = (workout_create, user_id)
        return SimpleNamespace(id=123)

    async def fake_get_intensity_units(session):
        calls["get_intensity_units"] = True
        return [SimpleNamespace(id=99, name="time-based", abbreviation="time")]

    async def fake_get_exercise_types(
        session, name=None, order_by="usage", offset=0, limit=100, **kwargs
    ):
        calls["get_exercise_types"] = name
        # Simulate not found so we create one
        return SimpleNamespace(data=[], next_cursor=None)

    async def fake_create_exercise_type(session, exercise_type_create, **kwargs):
        calls["create_exercise_type"] = exercise_type_create
        return SimpleNamespace(id=77, name=exercise_type_create.name)

    async def fake_create_exercise(session, exercise_create, **kwargs):
        calls["create_exercise"] = exercise_create
        return SimpleNamespace(id=555)

    async def fake_create_exercise_set(session, exercise_set_create):
        calls["create_exercise_set"].append(exercise_set_create)
        return SimpleNamespace(id=888)

    async def fake_get_workout_by_id(session, workout_id, user_id):
        calls["get_workout_by_id"] = (workout_id, user_id)
        # Return a minimal loaded workout structure
        set_obj = SimpleNamespace(
            reps=None,
            intensity=30.0,
            intensity_unit=SimpleNamespace(abbreviation="time"),
            done=True,
            id=1,
        )
        ex_obj = SimpleNamespace(
            exercise_type=SimpleNamespace(name="Walking"), exercise_sets=[set_obj]
        )
        return SimpleNamespace(id=workout_id, name="Walking", exercises=[ex_obj])

    # Patch module-level functions used by WorkoutService
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

    # Act
    result = await WorkoutService.create_workout_from_parsed(
        session=object(), user_id=42, parsed=parsed
    )

    # Assert calls
    assert calls["create_workout"][1] == 42
    assert calls["get_intensity_units"] is True
    assert calls["create_exercise_type"].name == "Walking"
    # One set created, marked done, with mapped time-based unit id
    assert len(calls["create_exercise_set"]) == 1
    set_payload = calls["create_exercise_set"][0]
    assert set_payload.done is True
    assert set_payload.duration_seconds == 1800
    assert set_payload.intensity == 30.0
    assert set_payload.intensity_unit_id == 99
    assert set_payload.notes == "Easy pace"
    # Final return comes from get_workout_by_id
    assert result.name == "Walking"


@pytest.mark.asyncio
async def test_create_workout_from_parsed_raises_when_no_intensity_units(monkeypatch):
    parsed = WorkoutParseResponse(
        name="Test",
        notes=None,
        workout_type_id=2,
        exercises=[
            ParsedExercise(
                exercise_type_name="TestEx",
                notes=None,
                sets=[
                    ParsedExerciseSet(
                        reps=None,
                        duration_seconds=600,
                        intensity=10.0,
                        intensity_unit="minutes",
                        rest_time_seconds=None,
                    )
                ],
            )
        ],
    )

    # Stubs forcing no intensity units
    async def fake_create_workout(session, workout_create, user_id):
        return SimpleNamespace(id=1)

    async def fake_get_intensity_units(session):
        return []

    async def fake_get_exercise_types(
        session, name=None, order_by="usage", offset=0, limit=100, **kwargs
    ):
        return SimpleNamespace(data=[], next_cursor=None)

    async def fake_create_exercise_type(session, exercise_type_create, **kwargs):
        return SimpleNamespace(id=2, name=exercise_type_create.name)

    async def fake_create_exercise(session, exercise_create, **kwargs):
        return SimpleNamespace(id=3)

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

    with pytest.raises(ValueError):
        await WorkoutService.create_workout_from_parsed(
            session=object(), user_id=1, parsed=parsed
        )
