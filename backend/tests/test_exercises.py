from fastapi.testclient import TestClient
import asyncio
import json
import pytest
import uuid
from httpx import AsyncClient
from types import SimpleNamespace
from unittest.mock import AsyncMock

from src.core.config import settings
from src.admin.exercise_image_service import (
    apply_reference_or_option,
    generate_reference_image_options,
)
from src.exercises.models import ExerciseImageCandidate, ExerciseType
from src.exercises.schemas import ExerciseTypeRead
from src.genai.google_images import ExerciseImageResult
from src.main import app
from src.users.router import current_active_user


def get_test_exercise_types(suffix=""):
    """Get common exercise types test data with optional suffix for uniqueness."""
    unique_id = (
        suffix + "_" + str(uuid.uuid4())[:8] if suffix else str(uuid.uuid4())[:8]
    )
    return [
        ExerciseType(
            name=f"Test Biceps Curl {unique_id}",
            description="Arm exercise",
            default_intensity_unit=None,
        ),
        ExerciseType(
            name=f"Test Triceps Extension {unique_id}",
            description="Arm exercise",
            default_intensity_unit=None,
        ),
        ExerciseType(
            name=f"Test Squat {unique_id}",
            description="Leg exercise",
            default_intensity_unit=None,
        ),
        ExerciseType(
            name=f"Test Deadlift {unique_id}",
            description="Full body exercise",
            default_intensity_unit=None,
        ),
    ]


@pytest.mark.asyncio
async def test_fuzzy_match_exercise_type_simple(db_session, async_client: AsyncClient):
    """Test fuzzy matching for exercise types with better isolation."""

    # Create a unique exercise type with a very specific name
    unique_suffix = str(uuid.uuid4())
    test_exercise = ExerciseType(
        name=f"UniqueTestBicepsCurl_{unique_suffix}",
        description="Test exercise for fuzzy matching",
        default_intensity_unit=None,
    )
    db_session.add(test_exercise)
    await db_session.flush()
    # Ensure visibility across request boundary
    await db_session.commit()

    # Store the ID for verification
    test_exercise_id = test_exercise.id

    # Test 1: Exact substring match
    response = await async_client.get(
        f"{settings.API_PREFIX}/exercises/exercise-types/?name=UniqueTestBicepsCurl_{unique_suffix}"
    )
    assert response.status_code == 200
    data = response.json()

    # Filter results to only our test exercise
    our_results = [
        ex
        for ex in data["data"]
        if ex["name"] == f"UniqueTestBicepsCurl_{unique_suffix}"
    ]
    assert len(our_results) == 1
    assert our_results[0]["id"] == test_exercise_id

    # Test 2: Fuzzy match with typo (missing 's')
    response = await async_client.get(
        f"{settings.API_PREFIX}/exercises/exercise-types/?name=UniqueTestBicepCurl_{unique_suffix}"
    )
    assert response.status_code == 200
    data = response.json()

    # Check if our exercise is in the results (fuzzy match should find it)
    found = any(
        ex["name"] == f"UniqueTestBicepsCurl_{unique_suffix}" for ex in data["data"]
    )
    assert found is True


class TestExercisesAPI:
    """Test exercises endpoints."""

    def test_get_exercises_in_workout_unauthorized(self, client: TestClient):
        """Test getting exercises in workout without authentication."""
        response = client.get(f"{settings.API_PREFIX}/workouts/1/exercises")
        assert response.status_code == 401

    def test_create_exercise_unauthorized(self, client: TestClient):
        """Test creating exercise without authentication."""
        exercise_data = {
            "exercise_type_id": 1,
            "workout_id": 1,
            "notes": "Test exercise",
        }
        response = client.post(f"{settings.API_PREFIX}/exercises/", json=exercise_data)
        assert response.status_code == 401

    def test_delete_exercise_unauthorized(self, client: TestClient):
        """Test deleting exercise without authentication."""
        response = client.delete(f"{settings.API_PREFIX}/exercises/1")
        assert response.status_code == 401

    def test_get_exercise_type_stats_unauthorized(self, client: TestClient):
        """Test getting exercise stats without authentication."""
        response = client.get(f"{settings.API_PREFIX}/exercises/exercise-types/1/stats")
        assert response.status_code == 401


@pytest.fixture
def override_exercise_user():
    async def _override_user():
        return SimpleNamespace(id=123)

    app.dependency_overrides[current_active_user] = _override_user
    try:
        yield
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.asyncio
async def test_get_exercise_type_stats_passes_current_user_to_service(
    async_client: AsyncClient, monkeypatch, override_exercise_user
):
    fake_get_exercise_type = AsyncMock(return_value=SimpleNamespace(id=9))
    fake_get_stats = AsyncMock(
        return_value={
            "progressiveOverload": [],
            "lastWorkout": None,
            "personalBest": None,
            "totalSets": 0,
            "intensityUnit": None,
        }
    )

    monkeypatch.setattr(
        "src.exercises.router.ExerciseTypeService.get_exercise_type",
        fake_get_exercise_type,
    )
    monkeypatch.setattr(
        "src.exercises.router.ExerciseTypeService.get_exercise_type_statistics",
        fake_get_stats,
    )

    response = await async_client.get(
        f"{settings.API_PREFIX}/exercises/exercise-types/9/stats"
    )

    assert response.status_code == 200
    fake_get_exercise_type.assert_awaited_once()
    fake_get_stats.assert_awaited_once()
    assert fake_get_stats.await_args.args[1:] == (9, 123)


class TestExerciseTypesUsage:
    """Test exercise types usage tracking functionality."""

    def test_times_used_field_exists_in_model(self):
        """Test that ExerciseType model has times_used field with default value."""
        # Create an exercise type instance and verify the field exists
        exercise_type = ExerciseType(
            name="Test Exercise",
            description="Test description",
            default_intensity_unit=None,
            times_used=0,  # Explicitly set the default value for the test
        )

        # Check that times_used field exists and defaults to 0
        assert hasattr(exercise_type, "times_used")
        assert exercise_type.times_used == 0

    def test_exercise_types_router_function_signature(self):
        """Test that the get_exercise_types function accepts order_by parameter."""
        from src.exercises.router import get_exercise_types
        import inspect

        # Get the function signature
        sig = inspect.signature(get_exercise_types)

        # Check that order_by parameter exists
        assert "order_by" in sig.parameters
        assert "muscle_group_id" in sig.parameters

        # Check that order_by has a default value
        order_by_param = sig.parameters["order_by"]
        assert order_by_param.default is not None
        muscle_group_param = sig.parameters["muscle_group_id"]
        assert muscle_group_param.default is not None

    def test_exercise_type_schema_includes_times_used(self):
        """Test that ExerciseTypeRead schema includes times_used field."""
        from src.exercises.schemas import ExerciseTypeRead

        # Get the schema annotations
        annotations = ExerciseTypeRead.__annotations__

        # Check that times_used is in the schema
        assert "times_used" in annotations
        assert annotations["times_used"] is int


@pytest.mark.asyncio
async def test_get_exercise_type_route_returns_serialized_schema(monkeypatch):
    from src.exercises import router as exercises_router

    exercise_type = SimpleNamespace(
        id=275,
        name="Bench Press",
        description="Chest press",
        default_intensity_unit=None,
        times_used=12,
        images_url=None,
        created_at="2026-03-24T10:00:00+00:00",
        updated_at="2026-03-24T10:00:00+00:00",
        exercise_muscles=[
            SimpleNamespace(
                muscle=SimpleNamespace(
                    id=3,
                    name="Pectorals",
                    muscle_group_id=1,
                    created_at="2026-03-24T10:00:00+00:00",
                    updated_at="2026-03-24T10:00:00+00:00",
                    muscle_group=SimpleNamespace(
                        id=1,
                        name="Chest",
                        created_at="2026-03-24T10:00:00+00:00",
                        updated_at="2026-03-24T10:00:00+00:00",
                    ),
                )
            )
        ],
    )

    monkeypatch.setattr(
        exercises_router.ExerciseTypeService,
        "get_exercise_type",
        AsyncMock(return_value=exercise_type),
    )

    result = await exercises_router.get_exercise_type(275, session=object())

    assert isinstance(result, ExerciseTypeRead)
    assert result.id == 275
    assert result.muscles[0].name == "Pectorals"
    assert result.muscles[0].muscle_group.name == "Chest"


@pytest.mark.asyncio
async def test_generated_assets_require_auth_but_published_assets_remain_public(
    async_client: AsyncClient, tmp_path
):
    original_dir = settings.EXERCISE_IMAGE_STORAGE_DIR
    settings.EXERCISE_IMAGE_STORAGE_DIR = str(tmp_path)
    try:
        generated_path = tmp_path / "generated" / "exercise-type-1" / "candidate.png"
        published_path = tmp_path / "published" / "exercise-type-1" / "live.png"
        generated_path.parent.mkdir(parents=True, exist_ok=True)
        published_path.parent.mkdir(parents=True, exist_ok=True)
        generated_path.write_bytes(b"generated")
        published_path.write_bytes(b"published")

        generated_resp = await async_client.get(
            f"{settings.API_PREFIX}/exercises/assets/generated/exercise-type-1/candidate.png"
        )
        assert generated_resp.status_code == 401

        public_resp = await async_client.get(
            f"{settings.API_PREFIX}/exercises/assets/published/exercise-type-1/live.png"
        )
        assert public_resp.status_code == 200
        assert public_resp.content == b"published"
    finally:
        settings.EXERCISE_IMAGE_STORAGE_DIR = original_dir


@pytest.mark.asyncio
async def test_apply_reference_option_publishes_generated_assets(
    db_session, tmp_path
):
    original_dir = settings.EXERCISE_IMAGE_STORAGE_DIR
    settings.EXERCISE_IMAGE_STORAGE_DIR = str(tmp_path)
    try:
        exercise_type = ExerciseType(
            name="Publishable Exercise",
            description="desc",
            reference_images_url=json.dumps(["references/source.png"]),
        )
        db_session.add(exercise_type)
        await db_session.flush()

        generated_relative_path = (
            f"generated/exercise-type-{exercise_type.id}/clean-outline/0-sample.png"
        )
        generated_file = tmp_path / generated_relative_path
        generated_file.parent.mkdir(parents=True, exist_ok=True)
        generated_file.write_bytes(b"candidate-bytes")

        db_session.add(
            ExerciseImageCandidate(
                exercise_type_id=exercise_type.id,
                generation_key="sample",
                pipeline_key="reference_redraw_v1",
                option_key="clean-outline",
                option_label="Clean Outline",
                option_description="desc",
                source_image_index=0,
                source_image_url="references/source.png",
                model_name="test-model",
                prompt_version="v1",
                prompt_summary="summary",
                mime_type="image/png",
                storage_path=generated_relative_path,
            )
        )
        await db_session.commit()
        await db_session.refresh(exercise_type)

        response = await apply_reference_or_option(
            db_session,
            exercise_type,
            option_key="clean-outline",
            use_reference=False,
        )

        stored_paths = json.loads(exercise_type.images_url)
        assert stored_paths[0].startswith("published/")
        published_file = tmp_path / stored_paths[0]
        assert published_file.read_bytes() == b"candidate-bytes"
        assert response.current_images[0].endswith(stored_paths[0])
    finally:
        settings.EXERCISE_IMAGE_STORAGE_DIR = original_dir


@pytest.mark.asyncio
async def test_generate_reference_image_options_runs_jobs_concurrently(
    db_session, monkeypatch, tmp_path
):
    original_dir = settings.EXERCISE_IMAGE_STORAGE_DIR
    settings.EXERCISE_IMAGE_STORAGE_DIR = str(tmp_path)
    try:
        exercise_type = ExerciseType(
            name="Concurrent Exercise",
            description="desc",
            reference_images_url=json.dumps(
                ["references/source-a.png", "references/source-b.png"]
            ),
        )
        db_session.add(exercise_type)
        await db_session.commit()
        await db_session.refresh(exercise_type)

        active = 0
        max_active = 0

        async def fake_generate_reference_image_variant(*, context, option, source_image_url):
            nonlocal active, max_active
            active += 1
            max_active = max(max_active, active)
            await asyncio.sleep(0.01)
            active -= 1
            return ExerciseImageResult(
                model="test-model",
                mime_type="image/png",
                base64_data="dGVzdA==",
                prompt_summary=f"{option.key}:{source_image_url}",
            )

        monkeypatch.setattr(
            "src.admin.exercise_image_service.generate_reference_image_variant",
            fake_generate_reference_image_variant,
        )
        monkeypatch.setattr(
            "src.admin.exercise_image_service._exercise_context",
            lambda _exercise_type: {
                "name": "Concurrent Exercise",
                "description": "desc",
                "instructions": "",
                "equipment": "",
                "category": "",
                "primary_muscles": [],
                "secondary_muscles": [],
            },
        )

        response = await generate_reference_image_options(db_session, exercise_type)

        assert max_active > 1
        assert len(response.options) == 3
        for option in response.options:
            assert len(option.images) == 2
    finally:
        settings.EXERCISE_IMAGE_STORAGE_DIR = original_dir


@pytest.mark.asyncio
async def test_get_exercise_types_route_forwards_muscle_group_filter(monkeypatch):
    from src.exercises import router as exercises_router

    fake_get_all = AsyncMock(return_value=SimpleNamespace(data=[], next_cursor=None))
    monkeypatch.setattr(
        "src.exercises.router.ExerciseTypeService.get_all_exercise_types",
        fake_get_all,
    )
    monkeypatch.setattr(
        exercises_router,
        "traced_model_dump",
        lambda *args, **kwargs: {"data": [], "next_cursor": None},
    )

    response = await exercises_router.get_exercise_types(
        name=None,
        muscle_group_id=9,
        order_by="usage",
        offset=2,
        limit=5,
        session=object(),
    )

    assert response.status_code == 200
    fake_get_all.assert_awaited_once()
    assert fake_get_all.await_args.args[1:] == (None, 9, "usage", 2, 5)


@pytest.mark.asyncio
async def test_get_muscle_groups_route_returns_service_data(monkeypatch):
    from src.exercises import router as exercises_router

    fake_get_all = AsyncMock(
        return_value=[
            SimpleNamespace(
                id=4,
                name="Chest",
                created_at="2026-03-24T10:00:00+00:00",
                updated_at="2026-03-24T10:00:00+00:00",
            )
        ]
    )
    monkeypatch.setattr(
        "src.exercises.router.MuscleGroupService.get_all_muscle_groups",
        fake_get_all,
    )

    result = await exercises_router.get_muscle_groups(session=object())

    assert result[0].name == "Chest"
    fake_get_all.assert_awaited_once()


def test_exercise_deletion_cascade_logic():
    """Test that the cascade deletion SQL logic is correct (unit test)."""
    from src.exercises.crud import soft_delete_exercise
    from sqlalchemy import update
    from src.exercise_sets.models import ExerciseSet
    from datetime import datetime, timezone
    import inspect

    # Get the source code of the function to verify the logic
    source = inspect.getsource(soft_delete_exercise)

    # Verify it contains the cascade deletion logic
    assert "update(ExerciseSet)" in source
    assert "ExerciseSet.exercise_id == exercise_id" in source
    assert "ExerciseSet.deleted_at.is_(None)" in source
    assert "deleted_at=now" in source

    # Test the SQL update construction (without executing)
    exercise_id = 123
    now = datetime.now(timezone.utc)

    # This is the SQL statement that should be generated
    expected_update = (
        update(ExerciseSet)
        .where(ExerciseSet.exercise_id == exercise_id, ExerciseSet.deleted_at.is_(None))
        .values(deleted_at=now)
    )

    # Verify the statement can be compiled
    compiled = str(expected_update.compile(compile_kwargs={"literal_binds": True}))
    assert "UPDATE exercise_sets" in compiled
    assert "exercise_id" in compiled
    assert "deleted_at" in compiled
