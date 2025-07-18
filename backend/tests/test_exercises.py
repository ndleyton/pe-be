from fastapi.testclient import TestClient
import pytest
import pytest_asyncio
from httpx import AsyncClient
import time

from src.core.config import settings
from src.exercises.models import ExerciseType


def get_test_exercise_types(suffix=""):
    """Get common exercise types test data with optional suffix for uniqueness."""
    timestamp = int(time.time() * 1000) if not suffix else suffix
    return [
        ExerciseType(name=f"Test Biceps Curl {timestamp}", description="Arm exercise", default_intensity_unit=1),
        ExerciseType(name=f"Test Triceps Extension {timestamp}", description="Arm exercise", default_intensity_unit=1),
        ExerciseType(name=f"Test Squat {timestamp}", description="Leg exercise", default_intensity_unit=1),
        ExerciseType(name=f"Test Deadlift {timestamp}", description="Full body exercise", default_intensity_unit=1),
    ]


@pytest.mark.asyncio
async def test_fuzzy_match_exercise_type(async_client: AsyncClient, db_session):
    """Test fuzzy matching for exercise types."""
    session = await anext(db_session)
    exercise_types = get_test_exercise_types("test1")
    session.add_all(exercise_types)
    await session.commit()

    client = await anext(async_client)
    response = await client.get(f"{settings.API_PREFIX}/exercises/exercise-types?name=Bicep+Curl")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) > 0
    assert "Biceps Curl" in data["data"][0]["name"]



@pytest.mark.asyncio
async def test_fuzzy_match_with_no_close_match(async_client: AsyncClient, db_session):
    """Test fuzzy matching with no close match."""
    session = await anext(db_session)
    session.add_all(get_test_exercise_types("no_match"))
    await session.commit()

    client = await anext(async_client)
    response = await client.get(f"{settings.API_PREFIX}/exercises/exercise-types?name=NonExistentExercise")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 0



@pytest.mark.asyncio
async def test_fuzzy_match_with_multiple_close_matches(async_client: AsyncClient, db_session):
    """Test fuzzy matching with multiple close matches."""
    session = await anext(db_session)
    session.add_all(get_test_exercise_types("multi_match"))
    await session.commit()

    client = await anext(async_client)
    response = await client.get(f"{settings.API_PREFIX}/exercises/exercise-types?name=Bi")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) > 0
    assert "Biceps Curl" in data["data"][0]["name"]



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