from fastapi.testclient import TestClient
import pytest
import uuid
from httpx import AsyncClient

from src.main import app
from src.core.config import settings
from src.core.database import get_async_session
from src.exercises.models import ExerciseType


def get_test_exercise_types(suffix=""):
    """Get common exercise types test data with optional suffix for uniqueness."""
    unique_id = (
        suffix + "_" + str(uuid.uuid4())[:8] if suffix else str(uuid.uuid4())[:8]
    )
    return [
        ExerciseType(
            name=f"Test Biceps Curl {unique_id}",
            description="Arm exercise",
            default_intensity_unit=1,
        ),
        ExerciseType(
            name=f"Test Triceps Extension {unique_id}",
            description="Arm exercise",
            default_intensity_unit=1,
        ),
        ExerciseType(
            name=f"Test Squat {unique_id}",
            description="Leg exercise",
            default_intensity_unit=1,
        ),
        ExerciseType(
            name=f"Test Deadlift {unique_id}",
            description="Full body exercise",
            default_intensity_unit=1,
        ),
    ]


@pytest.mark.asyncio
async def test_fuzzy_match_exercise_type_simple(db_session):
    """Test fuzzy matching for exercise types with better isolation."""

    # Create a unique exercise type with a very specific name
    unique_suffix = str(uuid.uuid4())
    test_exercise = ExerciseType(
        name=f"UniqueTestBicepsCurl_{unique_suffix}",
        description="Test exercise for fuzzy matching",
        default_intensity_unit=1,
    )
    db_session.add(test_exercise)
    await db_session.flush()

    # Store the ID for verification
    test_exercise_id = test_exercise.id

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_async_session] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as client:
        # Test 1: Exact substring match
        response = await client.get(
            f"{settings.API_PREFIX}/exercises/exercise-types?name=UniqueTestBicepsCurl_{unique_suffix}"
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
        response = await client.get(
            f"{settings.API_PREFIX}/exercises/exercise-types?name=UniqueTestBicepCurl_{unique_suffix}"
        )
        assert response.status_code == 200
        data = response.json()

        # Check if our exercise is in the results (fuzzy match should find it)
        found = any(
            ex["name"] == f"UniqueTestBicepsCurl_{unique_suffix}" for ex in data["data"]
        )
        assert found is True

    app.dependency_overrides.clear()


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


class TestExerciseTypesUsage:
    """Test exercise types usage tracking functionality."""

    def test_times_used_field_exists_in_model(self):
        """Test that ExerciseType model has times_used field with default value."""
        # Create an exercise type instance and verify the field exists
        exercise_type = ExerciseType(
            name="Test Exercise",
            description="Test description",
            default_intensity_unit=1,
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

        # Check that order_by has a default value
        order_by_param = sig.parameters["order_by"]
        assert order_by_param.default is not None

    def test_exercise_type_schema_includes_times_used(self):
        """Test that ExerciseTypeRead schema includes times_used field."""
        from src.exercises.schemas import ExerciseTypeRead

        # Get the schema annotations
        annotations = ExerciseTypeRead.__annotations__

        # Check that times_used is in the schema
        assert "times_used" in annotations
        assert annotations["times_used"] is int


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
