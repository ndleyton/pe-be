from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from src.core.config import settings
from src.core.http_cache import TTLResponseCache
from src.exercises.schemas import PaginatedExerciseTypesResponse
from src.main import app
from src.users.router import current_active_user, current_optional_user


pytestmark = pytest.mark.asyncio(loop_scope="session")


def _exercise_type_payload(exercise_type_id: int = 1) -> dict:
    now = datetime(2026, 4, 7, 12, 0, tzinfo=timezone.utc).isoformat()
    return {
        "id": exercise_type_id,
        "name": "Bench Press",
        "description": "Chest press",
        "default_intensity_unit": None,
        "times_used": 12,
        "muscles": [],
        "owner_id": None,
        "status": "released",
        "review_requested_at": None,
        "released_at": now,
        "reviewed_by": None,
        "review_notes": None,
        "images_url": None,
        "reference_images_url": None,
        "instructions": None,
        "equipment": None,
        "category": None,
        "created_at": now,
        "updated_at": now,
        "images": [],
        "reference_images": [],
    }


def _workout_type_payload(workout_type_id: int = 1) -> dict:
    now = datetime(2026, 4, 7, 12, 0, tzinfo=timezone.utc).isoformat()
    return {
        "id": workout_type_id,
        "name": "Strength",
        "description": "Heavy day",
        "created_at": now,
        "updated_at": now,
    }


@pytest.fixture
def override_optional_user():
    async def _override_user():
        return SimpleNamespace(id=123, is_superuser=False)

    app.dependency_overrides[current_optional_user] = _override_user
    try:
        yield
    finally:
        app.dependency_overrides.pop(current_optional_user, None)


@pytest.fixture
def override_active_user():
    async def _override_user():
        return SimpleNamespace(id=123, is_superuser=False)

    app.dependency_overrides[current_active_user] = _override_user
    try:
        yield
    finally:
        app.dependency_overrides.pop(current_active_user, None)


async def test_released_only_exercise_types_are_cached_and_return_not_modified(
    async_client: AsyncClient, monkeypatch
):
    fake_get_exercise_types = AsyncMock(
        return_value=PaginatedExerciseTypesResponse.model_validate(
            {"data": [_exercise_type_payload()], "next_cursor": None}
        )
    )
    monkeypatch.setattr(
        "src.exercises.router.ExerciseTypeService.get_all_exercise_types",
        fake_get_exercise_types,
    )

    url = (
        f"{settings.API_PREFIX}/exercises/exercise-types/"
        "?released_only=true&order_by=usage&offset=0&limit=100"
    )

    first_response = await async_client.get(url)
    assert first_response.status_code == 200
    assert first_response.headers["cache-control"].startswith("public, max-age=60")
    assert first_response.headers["x-cache-status"] == "MISS"
    assert "etag" in first_response.headers

    second_response = await async_client.get(url)
    assert second_response.status_code == 200
    assert second_response.headers["x-cache-status"] == "HIT"
    assert second_response.json() == first_response.json()
    fake_get_exercise_types.assert_awaited_once()

    not_modified = await async_client.get(
        url, headers={"If-None-Match": first_response.headers["etag"]}
    )
    assert not_modified.status_code == 304
    assert not_modified.headers["x-cache-status"] == "HIT"
    assert not_modified.content == b""
    fake_get_exercise_types.assert_awaited_once()


async def test_authenticated_exercise_types_bypass_shared_cache(
    async_client: AsyncClient, monkeypatch, override_optional_user
):
    fake_get_exercise_types = AsyncMock(
        return_value=PaginatedExerciseTypesResponse.model_validate(
            {"data": [_exercise_type_payload()], "next_cursor": None}
        )
    )
    monkeypatch.setattr(
        "src.exercises.router.ExerciseTypeService.get_all_exercise_types",
        fake_get_exercise_types,
    )

    url = f"{settings.API_PREFIX}/exercises/exercise-types/?order_by=usage&offset=0&limit=100"

    first_response = await async_client.get(url)
    second_response = await async_client.get(url)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.headers["cache-control"] == "private, no-store"
    assert first_response.headers["x-cache-status"] == "BYPASS"
    assert second_response.headers["x-cache-status"] == "BYPASS"
    assert first_response.headers["vary"] == "Cookie"
    assert "etag" not in first_response.headers
    assert fake_get_exercise_types.await_count == 2


async def test_workout_types_cache_is_invalidated_after_create(
    async_client: AsyncClient, monkeypatch, override_active_user
):
    fake_get_workout_types = AsyncMock(return_value=[_workout_type_payload()])
    fake_create_workout_type = AsyncMock(return_value=_workout_type_payload(2))
    monkeypatch.setattr(
        "src.workouts.router.WorkoutTypeService.get_all_workout_types",
        fake_get_workout_types,
    )
    monkeypatch.setattr(
        "src.workouts.router.WorkoutTypeService.create_new_workout_type",
        fake_create_workout_type,
    )

    url = f"{settings.API_PREFIX}/workouts/workout-types/"

    first_response = await async_client.get(url)
    second_response = await async_client.get(url)
    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.headers["cache-control"] == "public, max-age=86400"
    assert first_response.headers["x-cache-status"] == "MISS"
    assert second_response.headers["x-cache-status"] == "HIT"
    assert fake_get_workout_types.await_count == 1

    create_response = await async_client.post(
        url,
        json={"name": "Conditioning", "description": "Mixed"},
    )
    assert create_response.status_code == 201

    third_response = await async_client.get(url)
    assert third_response.status_code == 200
    assert third_response.headers["x-cache-status"] == "MISS"
    assert fake_get_workout_types.await_count == 2


async def test_cache_sweeps_expired_cold_keys_on_unrelated_access(monkeypatch):
    fake_now = 100.0

    def fake_monotonic() -> float:
        return fake_now

    monkeypatch.setattr("src.core.http_cache.monotonic", fake_monotonic)

    cache = TTLResponseCache(sweep_interval_seconds=1)
    await cache.set("stale-key", body=b"{}", ttl_seconds=1, tags=("catalog",))

    fake_now = 102.0
    await cache.set("fresh-key", body=b'{"ok":true}', ttl_seconds=10, tags=("catalog",))

    assert "stale-key" not in cache._entries
    assert "fresh-key" in cache._entries
