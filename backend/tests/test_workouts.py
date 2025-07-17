from fastapi.testclient import TestClient
from datetime import datetime

from src.core.config import settings


class TestWorkoutsAPI:
    """Test workout endpoints."""

    def test_create_workout_unauthorized(self, client: TestClient):
        """Test creating workout without authentication."""
        workout_data = {
            "name": "Test Workout",
            "start_time": datetime.now().isoformat(),
            "workout_type_id": 1,
        }
        response = client.post(f"{settings.API_PREFIX}/workouts/", json=workout_data)
        assert response.status_code == 401

    def test_get_workouts_unauthorized(self, client: TestClient):
        """Test getting workouts without authentication."""
        response = client.get(f"{settings.API_PREFIX}/workouts/mine")
        assert response.status_code == 401

    def test_update_workout_unauthorized(self, client: TestClient):
        """Test updating workout without authentication."""
        update_data = {"end_time": datetime.now().isoformat()}
        response = client.patch(f"{settings.API_PREFIX}/workouts/1", json=update_data)
        assert response.status_code == 401

    # Note: Add authenticated tests once you have test user fixtures
    # def test_create_workout_authorized(self, client: TestClient, test_user):
    #     """Test creating workout with authentication."""
    #     pass
