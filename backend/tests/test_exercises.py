import pytest
from fastapi.testclient import TestClient
from datetime import datetime

from app.config import settings


class TestExercisesAPI:
    """Test exercises endpoints."""
    
    def test_get_exercises_in_workout_unauthorized(self, client: TestClient):
        """Test getting exercises in workout without authentication."""
        response = client.get(f"{settings.API_PREFIX}/exercises/workouts/1")
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
    #         f"{settings.API_PREFIX}/exercises/workouts/{test_workout.id}",
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
    #         f"{settings.API_PREFIX}/exercises/workouts/{other_user_workout.id}",
    #         headers={"Authorization": f"Bearer {test_user.token}"}
    #     )
    #     assert response.status_code == 404
    #     assert response.json()["detail"] == "Workout not found"
    # 
    # def test_get_exercises_in_nonexistent_workout(self, client: TestClient, test_user):
    #     """Test getting exercises in nonexistent workout."""
    #     response = client.get(
    #         f"{settings.API_PREFIX}/exercises/workouts/99999",
    #         headers={"Authorization": f"Bearer {test_user.token}"}
    #     )
    #     assert response.status_code == 404
    #     assert response.json()["detail"] == "Workout not found"