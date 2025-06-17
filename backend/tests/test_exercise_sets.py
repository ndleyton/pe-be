import pytest
from fastapi.testclient import TestClient
from app.config import settings


class TestExerciseSetsAPI:
    """Test exercise sets endpoints."""
    
    def test_create_exercise_set_unauthorized(self, client: TestClient):
        """Test creating an exercise set without authentication."""
        exercise_set_data = {
            "reps": 10,
            "intensity": 50.0,
            "intensity_unit_id": 1,
            "exercise_id": 1,
            "rest_time_seconds": 60,
            "done": False
        }
        response = client.post(f"{settings.API_PREFIX}/exercise-sets/", json=exercise_set_data)
        assert response.status_code == 401
    
    def test_get_exercise_sets_unauthorized(self, client: TestClient):
        """Test getting exercise sets without authentication."""
        response = client.get(f"{settings.API_PREFIX}/exercise-sets/exercise/1")
        assert response.status_code == 401
    
    def test_update_exercise_set_unauthorized(self, client: TestClient):
        """Test updating exercise set without authentication."""
        update_data = {
            "reps": 15,
            "intensity": 60.0,
            "done": True
        }
        response = client.put(f"{settings.API_PREFIX}/exercise-sets/1", json=update_data)
        assert response.status_code == 401
    
    def test_delete_exercise_set_unauthorized(self, client: TestClient):
        """Test deleting exercise set without authentication."""
        response = client.delete(f"{settings.API_PREFIX}/exercise-sets/1")
        assert response.status_code == 401
    
    # Note: Add authenticated tests once you have test user fixtures
    # def test_create_exercise_set_authorized(self, client: TestClient, test_user, test_exercise):
    #     """Test creating an exercise set with authentication."""
    #     exercise_set_data = {
    #         "reps": 10,
    #         "intensity": 50.0,
    #         "intensity_unit_id": 1,
    #         "exercise_id": test_exercise.id,
    #         "rest_time_seconds": 60,
    #         "done": False
    #     }
    #     response = client.post(
    #         f"{settings.API_PREFIX}/exercise-sets/",
    #         json=exercise_set_data,
    #         headers={"Authorization": f"Bearer {test_user.token}"}
    #     )
    #     assert response.status_code == 201
    #     data = response.json()
    #     assert data["reps"] == 10
    #     assert data["intensity"] == 50.0
    #     assert data["exercise_id"] == test_exercise.id