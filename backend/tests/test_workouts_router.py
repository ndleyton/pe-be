from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from src.core.config import settings
from src.main import app
from src.users.router import current_active_user


pytestmark = pytest.mark.asyncio(loop_scope="session")


def _workout_payload(workout_id: int, owner_id: int = 123) -> dict:
    now = datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc).isoformat()
    return {
        "id": workout_id,
        "name": f"Workout {workout_id}",
        "notes": "notes",
        "start_time": now,
        "end_time": None,
        "workout_type_id": 4,
        "owner_id": owner_id,
        "created_at": now,
        "updated_at": now,
    }


def _exercise_payload(exercise_id: int, workout_id: int) -> dict:
    now = datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc).isoformat()
    return {
        "id": exercise_id,
        "timestamp": now,
        "notes": "exercise notes",
        "exercise_type_id": 9,
        "workout_id": workout_id,
        "created_at": now,
        "updated_at": now,
        "exercise_type": {
            "id": 9,
            "name": "Bench Press",
            "description": "Pressing movement",
            "default_intensity_unit": None,
            "times_used": 0,
            "muscles": [],
            "images_url": None,
            "created_at": now,
            "updated_at": now,
            "images": [],
        },
        "exercise_sets": [],
    }


@pytest.fixture
def override_workout_user():
    async def _override_user():
        return SimpleNamespace(id=123)

    app.dependency_overrides[current_active_user] = _override_user
    try:
        yield
    finally:
        app.dependency_overrides.pop(current_active_user, None)


async def test_get_my_workouts_returns_next_cursor(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    fake_get_my_workouts = AsyncMock(
        return_value=[
            SimpleNamespace(**_workout_payload(3)),
            SimpleNamespace(**_workout_payload(2)),
        ]
    )
    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.get_my_workouts", fake_get_my_workouts
    )

    response = await async_client.get(
        f"{settings.API_PREFIX}/workouts/mine?limit=2&cursor=5"
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["data"]] == [3, 2]
    assert body["next_cursor"] == 2
    fake_get_my_workouts.assert_awaited_once()


async def test_get_my_workouts_returns_no_cursor_for_partial_page(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    fake_get_my_workouts = AsyncMock(return_value=[_workout_payload(1)])
    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.get_my_workouts", fake_get_my_workouts
    )

    response = await async_client.get(f"{settings.API_PREFIX}/workouts/mine?limit=2")

    assert response.status_code == 200
    assert response.json()["next_cursor"] is None


async def test_workout_router_create_and_types_endpoints(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    created_workout = _workout_payload(10)
    workout_types = [
        {
            "id": 1,
            "name": "Strength",
            "description": "Heavy",
            "created_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc).isoformat(),
            "updated_at": datetime(2026, 3, 12, 12, 0, tzinfo=timezone.utc).isoformat(),
        }
    ]
    created_workout_type = workout_types[0]
    add_exercise_result = _workout_payload(11)

    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.create_new_workout",
        AsyncMock(return_value=created_workout),
    )
    monkeypatch.setattr(
        "src.workouts.router.WorkoutTypeService.get_all_workout_types",
        AsyncMock(return_value=workout_types),
    )
    monkeypatch.setattr(
        "src.workouts.router.WorkoutTypeService.create_new_workout_type",
        AsyncMock(return_value=created_workout_type),
    )
    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.add_exercise_to_current_workout",
        AsyncMock(return_value=add_exercise_result),
    )

    create_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/",
        json={"name": "Push Day", "workout_type_id": 4},
    )
    assert create_response.status_code == 201
    assert create_response.json()["id"] == 10

    types_response = await async_client.get(
        f"{settings.API_PREFIX}/workouts/workout-types/"
    )
    assert types_response.status_code == 200
    assert types_response.json()[0]["name"] == "Strength"

    create_type_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/workout-types/",
        json={"name": "Conditioning", "description": "Mixed"},
    )
    assert create_type_response.status_code == 201
    assert create_type_response.json()["id"] == 1

    add_exercise_response = await async_client.post(
        f"{settings.API_PREFIX}/workouts/add-exercise",
        json={"exercise_type_id": 9},
    )
    assert add_exercise_response.status_code == 201
    assert add_exercise_response.json()["id"] == 11


async def test_get_workout_and_update_workout_handle_not_found(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    fake_get_workout = AsyncMock(side_effect=[None, _workout_payload(7)])
    fake_update_workout = AsyncMock(side_effect=[None, _workout_payload(7)])

    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.get_workout", fake_get_workout
    )
    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.update_workout_data", fake_update_workout
    )

    missing_get = await async_client.get(f"{settings.API_PREFIX}/workouts/7")
    assert missing_get.status_code == 404
    assert missing_get.json()["detail"] == "Workout not found"

    found_get = await async_client.get(f"{settings.API_PREFIX}/workouts/7")
    assert found_get.status_code == 200
    assert found_get.json()["id"] == 7

    missing_patch = await async_client.patch(
        f"{settings.API_PREFIX}/workouts/7",
        json={"name": "Updated"},
    )
    assert missing_patch.status_code == 404
    assert missing_patch.json()["detail"] == "Workout not found"

    found_patch = await async_client.patch(
        f"{settings.API_PREFIX}/workouts/7",
        json={"name": "Updated"},
    )
    assert found_patch.status_code == 200
    assert found_patch.json()["id"] == 7


async def test_delete_workout_returns_204(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    fake_remove_workout = AsyncMock(return_value=True)
    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.remove_workout", fake_remove_workout
    )

    response = await async_client.delete(f"{settings.API_PREFIX}/workouts/12")

    assert response.status_code == 204
    fake_remove_workout.assert_awaited_once()


async def test_get_exercises_in_workout_handles_not_found_and_success(
    async_client: AsyncClient, monkeypatch, override_workout_user
):
    fake_get_workout = AsyncMock(side_effect=[None, _workout_payload(8)])
    fake_get_workout_exercises = AsyncMock(return_value=[_exercise_payload(1, 8)])

    monkeypatch.setattr(
        "src.workouts.router.WorkoutService.get_workout", fake_get_workout
    )
    monkeypatch.setattr(
        "src.workouts.router.ExerciseService.get_workout_exercises",
        fake_get_workout_exercises,
    )

    missing = await async_client.get(f"{settings.API_PREFIX}/workouts/8/exercises")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Workout not found"

    found = await async_client.get(f"{settings.API_PREFIX}/workouts/8/exercises")
    assert found.status_code == 200
    assert found.json()[0]["id"] == 1
