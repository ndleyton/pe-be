from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

import src.exercise_sets.service as exercise_sets_service
from src.exercise_sets.schemas import ExerciseSetCreate, ExerciseSetUpdate
from src.exercise_sets.service import ExerciseSetService


pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_get_exercise_set_handles_success_missing_and_forbidden(monkeypatch):
    session = object()
    owned_set = SimpleNamespace(
        id=1,
        exercise=SimpleNamespace(workout=SimpleNamespace(owner_id=10)),
    )
    foreign_set = SimpleNamespace(
        id=2,
        exercise=SimpleNamespace(workout=SimpleNamespace(owner_id=99)),
    )

    fake_get_exercise_set_by_id = AsyncMock(side_effect=[None, foreign_set, owned_set])
    monkeypatch.setattr(
        exercise_sets_service, "get_exercise_set_by_id", fake_get_exercise_set_by_id
    )

    assert await ExerciseSetService.get_exercise_set(session, 1, 10) is None

    with pytest.raises(HTTPException) as forbidden:
        await ExerciseSetService.get_exercise_set(session, 2, 10)
    assert forbidden.value.status_code == 403

    result = await ExerciseSetService.get_exercise_set(session, 3, 10)
    assert result is owned_set


async def test_get_exercise_sets_for_exercise_requires_owned_exercise(monkeypatch):
    session = object()
    fake_verify_exercise_ownership = AsyncMock(
        side_effect=[None, SimpleNamespace(id=7)]
    )
    fake_get_exercise_sets = AsyncMock(return_value=[SimpleNamespace(id=1)])

    monkeypatch.setattr(
        exercise_sets_service,
        "verify_exercise_ownership",
        fake_verify_exercise_ownership,
    )
    monkeypatch.setattr(
        exercise_sets_service, "get_exercise_sets_for_exercise", fake_get_exercise_sets
    )

    with pytest.raises(HTTPException) as missing:
        await ExerciseSetService.get_exercise_sets_for_exercise(session, 7, 10)
    assert missing.value.status_code == 404

    result = await ExerciseSetService.get_exercise_sets_for_exercise(session, 7, 10)
    assert result == [SimpleNamespace(id=1)]
    fake_get_exercise_sets.assert_awaited_once_with(session, 7)


async def test_create_new_exercise_set_requires_owned_exercise(monkeypatch):
    session = object()
    payload = ExerciseSetCreate(
        reps=8,
        intensity=80,
        intensity_unit_id=3,
        exercise_id=5,
    )
    created = SimpleNamespace(id=100)

    fake_verify_exercise_ownership = AsyncMock(
        side_effect=[None, SimpleNamespace(id=payload.exercise_id)]
    )
    fake_create_exercise_set = AsyncMock(return_value=created)

    monkeypatch.setattr(
        exercise_sets_service,
        "verify_exercise_ownership",
        fake_verify_exercise_ownership,
    )
    monkeypatch.setattr(
        exercise_sets_service, "create_exercise_set", fake_create_exercise_set
    )

    with pytest.raises(HTTPException) as missing:
        await ExerciseSetService.create_new_exercise_set(session, payload, 10)
    assert missing.value.status_code == 404

    result = await ExerciseSetService.create_new_exercise_set(session, payload, 10)
    assert result is created
    fake_create_exercise_set.assert_awaited_once_with(session, payload)


async def test_update_exercise_set_data_handles_missing_forbidden_and_success(
    monkeypatch,
):
    session = object()
    payload = ExerciseSetUpdate(reps=12, done=True)
    owned_set = SimpleNamespace(
        id=7,
        exercise=SimpleNamespace(workout=SimpleNamespace(owner_id=10)),
    )
    foreign_set = SimpleNamespace(
        id=8,
        exercise=SimpleNamespace(workout=SimpleNamespace(owner_id=99)),
    )
    updated = SimpleNamespace(id=7, reps=12, done=True)

    fake_get_exercise_set_by_id = AsyncMock(side_effect=[None, foreign_set, owned_set])
    fake_update_exercise_set = AsyncMock(return_value=updated)

    monkeypatch.setattr(
        exercise_sets_service, "get_exercise_set_by_id", fake_get_exercise_set_by_id
    )
    monkeypatch.setattr(
        exercise_sets_service, "update_exercise_set", fake_update_exercise_set
    )

    with pytest.raises(HTTPException) as missing:
        await ExerciseSetService.update_exercise_set_data(session, 7, payload, 10)
    assert missing.value.status_code == 404

    with pytest.raises(HTTPException) as forbidden:
        await ExerciseSetService.update_exercise_set_data(session, 7, payload, 10)
    assert forbidden.value.status_code == 403

    result = await ExerciseSetService.update_exercise_set_data(session, 7, payload, 10)
    assert result is updated
    fake_update_exercise_set.assert_awaited_once_with(session, 7, payload)


async def test_remove_exercise_set_is_idempotent_authorized_and_rolls_back_on_failure(
    monkeypatch,
):
    session = SimpleNamespace(
        execute=AsyncMock(),
        commit=AsyncMock(),
        rollback=AsyncMock(),
    )
    fake_get_owner_and_deleted = AsyncMock(
        side_effect=[
            None,
            (99, None),
            (10, datetime(2026, 3, 8, tzinfo=timezone.utc)),
            (10, None),
        ]
    )
    monkeypatch.setattr(
        exercise_sets_service,
        "get_exercise_set_owner_and_deleted",
        fake_get_owner_and_deleted,
    )

    assert await ExerciseSetService.remove_exercise_set(session, 1, 10) is True

    with pytest.raises(HTTPException) as forbidden:
        await ExerciseSetService.remove_exercise_set(session, 2, 10)
    assert forbidden.value.status_code == 403

    assert await ExerciseSetService.remove_exercise_set(session, 3, 10) is True
    assert session.execute.await_count == 0

    assert await ExerciseSetService.remove_exercise_set(session, 4, 10) is True
    session.execute.assert_awaited_once()
    session.commit.assert_awaited_once()

    failing_session = SimpleNamespace(
        execute=AsyncMock(),
        commit=AsyncMock(side_effect=RuntimeError("commit failed")),
        rollback=AsyncMock(),
    )
    monkeypatch.setattr(
        exercise_sets_service,
        "get_exercise_set_owner_and_deleted",
        AsyncMock(return_value=(10, None)),
    )

    with pytest.raises(RuntimeError, match="commit failed"):
        await ExerciseSetService.remove_exercise_set(failing_session, 5, 10)
    failing_session.rollback.assert_awaited_once()
