from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

import src.exercises.service as exercises_service
from src.exercises.schemas import ExerciseCreate, ExerciseTypeCreate
from src.exercises.service import (
    ExerciseService,
    ExerciseTypeService,
    IntensityUnitService,
    MuscleService,
    MuscleGroupService,
)


pytestmark = pytest.mark.asyncio(loop_scope="session")


class _Orig(Exception):
    def __init__(self, pgcode=None):
        super().__init__("db error")
        if pgcode is not None:
            self.pgcode = pgcode


def _integrity_error(pgcode=None) -> IntegrityError:
    return IntegrityError("INSERT", {}, _Orig(pgcode=pgcode))


async def test_exercise_service_wrappers_forward_calls(monkeypatch):
    exercise = SimpleNamespace(id=10)
    exercises = [SimpleNamespace(id=1), SimpleNamespace(id=2)]
    created = SimpleNamespace(id=11)

    fake_get_exercise_by_id = AsyncMock(return_value=exercise)
    fake_get_exercises_for_workout = AsyncMock(return_value=exercises)
    fake_create_exercise = AsyncMock(return_value=created)

    monkeypatch.setattr(
        exercises_service, "get_exercise_by_id", fake_get_exercise_by_id
    )
    monkeypatch.setattr(
        exercises_service, "get_exercises_for_workout", fake_get_exercises_for_workout
    )
    monkeypatch.setattr(exercises_service, "create_exercise", fake_create_exercise)

    session = object()
    payload = ExerciseCreate(
        exercise_type_id=3,
        workout_id=4,
        notes="top set",
    )

    assert await ExerciseService.get_exercise(session, 10) is exercise
    assert await ExerciseService.get_workout_exercises(session, 4) == exercises
    assert await ExerciseService.create_new_exercise(session, payload) is created

    fake_get_exercise_by_id.assert_awaited_once_with(session, 10)
    fake_get_exercises_for_workout.assert_awaited_once_with(session, 4)
    fake_create_exercise.assert_awaited_once_with(session, payload)


async def test_remove_exercise_is_idempotent_forbidden_and_rolls_back(monkeypatch):
    session = SimpleNamespace(
        execute=AsyncMock(),
        commit=AsyncMock(),
        rollback=AsyncMock(),
    )
    fake_get_exercise_owner_id = AsyncMock(side_effect=[None, 99, 10])
    monkeypatch.setattr(
        exercises_service, "get_exercise_owner_id", fake_get_exercise_owner_id
    )

    assert await ExerciseService.remove_exercise(session, 1, 10) is True
    assert session.execute.await_count == 0

    with pytest.raises(HTTPException) as forbidden:
        await ExerciseService.remove_exercise(session, 2, 10)
    assert forbidden.value.status_code == status.HTTP_403_FORBIDDEN
    assert session.execute.await_count == 0

    assert await ExerciseService.remove_exercise(session, 3, 10) is True
    assert session.execute.await_count == 2
    session.commit.assert_awaited_once()

    failing_session = SimpleNamespace(
        execute=AsyncMock(),
        commit=AsyncMock(side_effect=RuntimeError("commit failed")),
        rollback=AsyncMock(),
    )
    monkeypatch.setattr(
        exercises_service,
        "get_exercise_owner_id",
        AsyncMock(return_value=10),
    )

    with pytest.raises(RuntimeError, match="commit failed"):
        await ExerciseService.remove_exercise(failing_session, 4, 10)
    failing_session.rollback.assert_awaited_once()


async def test_exercise_type_and_intensity_unit_service_wrappers(monkeypatch):
    paginated = SimpleNamespace(data=[SimpleNamespace(id=1)], next_cursor=None)
    exercise_type = SimpleNamespace(id=5)
    stats = {"totalSets": 3}
    created_type = SimpleNamespace(id=6)
    units = [SimpleNamespace(id=1, name="kg")]
    muscles = [SimpleNamespace(id=3, name="Biceps")]
    muscle_groups = [SimpleNamespace(id=2, name="Chest")]

    fake_get_exercise_types = AsyncMock(return_value=paginated)
    fake_get_exercise_type_by_id = AsyncMock(return_value=exercise_type)
    fake_get_exercise_type_stats = AsyncMock(return_value=stats)
    fake_create_exercise_type = AsyncMock(return_value=created_type)
    fake_get_intensity_units = AsyncMock(return_value=units)
    fake_get_muscles = AsyncMock(return_value=muscles)
    fake_get_muscle_groups = AsyncMock(return_value=muscle_groups)

    monkeypatch.setattr(
        exercises_service, "get_exercise_types", fake_get_exercise_types
    )
    monkeypatch.setattr(
        exercises_service, "get_exercise_type_by_id", fake_get_exercise_type_by_id
    )
    monkeypatch.setattr(
        exercises_service, "get_exercise_type_stats", fake_get_exercise_type_stats
    )
    monkeypatch.setattr(
        exercises_service, "create_exercise_type", fake_create_exercise_type
    )
    monkeypatch.setattr(
        exercises_service, "get_intensity_units", fake_get_intensity_units
    )
    monkeypatch.setattr(exercises_service, "get_muscles", fake_get_muscles)
    monkeypatch.setattr(
        exercises_service,
        "get_muscle_groups",
        fake_get_muscle_groups,
    )

    session = object()
    payload = ExerciseTypeCreate(name="Rows", description="Back")

    assert (
        await ExerciseTypeService.get_all_exercise_types(
            session,
            name="row",
            muscle_group_id=7,
            order_by="name",
            offset=5,
            limit=10,
        )
        is paginated
    )
    assert await ExerciseTypeService.get_exercise_type(session, 5) is exercise_type
    assert (
        await ExerciseTypeService.get_exercise_type_statistics(session, 5, 12) == stats
    )
    assert (
        await ExerciseTypeService.create_new_exercise_type(session, payload)
        is created_type
    )
    assert await IntensityUnitService.get_all_intensity_units(session) == units
    assert await MuscleService.get_all_muscles(session) == muscles
    assert await MuscleGroupService.get_all_muscle_groups(session) == muscle_groups

    fake_get_exercise_types.assert_awaited_once_with(session, "row", 7, "name", 5, 10)
    fake_get_exercise_type_by_id.assert_awaited_once_with(session, 5)
    fake_get_exercise_type_stats.assert_awaited_once_with(session, 5, 12)
    fake_create_exercise_type.assert_awaited_once_with(session, payload)
    fake_get_intensity_units.assert_awaited_once_with(session)
    fake_get_muscles.assert_awaited_once_with(session)
    fake_get_muscle_groups.assert_awaited_once_with(session)


@pytest.mark.parametrize(
    ("side_effect", "status_code", "detail_fragment"),
    [
        (_integrity_error("23505"), status.HTTP_400_BAD_REQUEST, "already exists"),
        (
            _integrity_error(),
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "database constraint",
        ),
        (ValueError("Missing muscles"), status.HTTP_400_BAD_REQUEST, "Missing muscles"),
    ],
)
async def test_create_new_exercise_type_maps_errors(
    monkeypatch, side_effect, status_code, detail_fragment
):
    monkeypatch.setattr(
        exercises_service,
        "create_exercise_type",
        AsyncMock(side_effect=side_effect),
    )

    with pytest.raises(HTTPException) as exc_info:
        await ExerciseTypeService.create_new_exercise_type(
            object(),
            ExerciseTypeCreate(name="Rows", description="Back"),
        )

    assert exc_info.value.status_code == status_code
    assert detail_fragment in exc_info.value.detail
