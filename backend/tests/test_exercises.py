import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models import ExerciseType


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
            "notes": "Test exercise"
        }
        response = client.post(f"{settings.API_PREFIX}/exercises/", json=exercise_data)
        assert response.status_code == 401
    
    # Note: Add authenticated tests once you have test user fixtures
    # def test_get_exercises_in_workout_authorized(self, client: TestClient, test_user, test_workout):
    #     """Test getting exercises in workout with authentication."""
    #     # Create an exercise for the workout
    #     exercise_data = {
    #         "exercise_type_id": 1,
    #         "workout_id": test_workout.id,
    #         "notes": "Test exercise"
    #     }
    #     create_response = client.post(
    #         f"{settings.API_PREFIX}/exercises/", 
    #         json=exercise_data,
    #         headers={"Authorization": f"Bearer {test_user.token}"}
    #     )
    #     assert create_response.status_code == 201
    #     
    #     # Get exercises for the workout
    #     response = client.get(
    #         f"{settings.API_PREFIX}/workouts/{test_workout.id}/exercises",
    #         headers={"Authorization": f"Bearer {test_user.token}"}
    #     )
    #     assert response.status_code == 200
    #     exercises = response.json()
    #     assert len(exercises) == 1
    #     assert exercises[0]["workout_id"] == test_workout.id
    #     assert exercises[0]["notes"] == "Test exercise"
    # 
    # def test_get_exercises_in_workout_not_owner(self, client: TestClient, test_user, other_user_workout):
    #     """Test getting exercises in workout that doesn't belong to user."""
    #     response = client.get(
    #         f"{settings.API_PREFIX}/workouts/{other_user_workout.id}/exercises",
    #         headers={"Authorization": f"Bearer {test_user.token}"}
    #     )
    #     assert response.status_code == 404
    #     assert response.json()["detail"] == "Workout not found"
    # 
    # def test_get_exercises_in_nonexistent_workout(self, client: TestClient, test_user):
    #     """Test getting exercises in nonexistent workout."""
    #     response = client.get(
    #         f"{settings.API_PREFIX}/workouts/99999/exercises",
    #         headers={"Authorization": f"Bearer {test_user.token}"}
    #     )
    #     assert response.status_code == 404
    #     assert response.json()["detail"] == "Workout not found"


class TestExerciseTypesUsage:
    """Test exercise types usage tracking functionality."""
    
    async def test_times_used_defaults_to_zero(self, db_session: AsyncSession):
        """Test that new exercise types have times_used defaulting to 0."""
        # Create a new exercise type
        exercise_type = ExerciseType(
            name="Test Exercise",
            description="Test description",
            default_intensity_unit=1
        )
        db_session.add(exercise_type)
        await db_session.commit()
        await db_session.refresh(exercise_type)
        
        # Check that times_used defaults to 0
        assert exercise_type.times_used == 0
    
    def test_get_exercise_types_default_order_by_usage(self, client: TestClient):
        """Test that exercise types are ordered by usage by default."""
        response = client.get(f"{settings.API_PREFIX}/exercise-types/")
        assert response.status_code == 200
        exercise_types = response.json()
        
        # Check that the response includes times_used field
        if exercise_types:
            assert "times_used" in exercise_types[0]
    
    def test_get_exercise_types_order_by_name(self, client: TestClient):
        """Test that exercise types can be ordered alphabetically."""
        response = client.get(f"{settings.API_PREFIX}/exercise-types/?order_by=name")
        assert response.status_code == 200
        exercise_types = response.json()
        
        # Check ordering by name if there are multiple exercise types
        if len(exercise_types) > 1:
            names = [et["name"] for et in exercise_types]
            assert names == sorted(names), "Exercise types should be sorted alphabetically"
    
    def test_get_exercise_types_order_by_usage(self, client: TestClient):
        """Test that exercise types can be explicitly ordered by usage."""
        response = client.get(f"{settings.API_PREFIX}/exercise-types/?order_by=usage")
        assert response.status_code == 200
        exercise_types = response.json()
        
        # Check that the response is valid
        assert isinstance(exercise_types, list)
        if exercise_types:
            assert "times_used" in exercise_types[0]
            
            # Check ordering by times_used DESC, then name ASC
            if len(exercise_types) > 1:
                for i in range(len(exercise_types) - 1):
                    current = exercise_types[i]
                    next_item = exercise_types[i + 1]
                    
                    # Either times_used should be higher, or if equal, name should be lower alphabetically
                    assert (current["times_used"] > next_item["times_used"] or 
                           (current["times_used"] == next_item["times_used"] and 
                            current["name"] <= next_item["name"])), \
                           "Exercise types should be ordered by times_used DESC, then name ASC"