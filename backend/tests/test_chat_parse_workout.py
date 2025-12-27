import pytest

from src.chat.service import ChatService

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_parse_workout_returns_error_when_session_missing():
    svc = ChatService(user_id=1, session=None)

    result = await svc._parse_workout_and_save(
        name="Test Workout",
        notes=None,
        workout_type_id=2,
        exercises=[
            {
                "exercise_type_name": "Bench Press",
                "notes": None,
                "sets": [
                    {
                        "reps": 10,
                        "intensity": 135.0,
                        "intensity_unit": "lbs",
                        "rest_time_seconds": 60,
                    }
                ],
            }
        ],
    )

    assert result == "Failed to save workout: no database session available."
    assert svc._workout_saved_this_request is False
