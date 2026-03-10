import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace

from src.workouts.service import WorkoutService, WORKOUT_REUSE_WINDOW_HOURS
from src.workouts.schemas import AddExerciseRequest, ExerciseSetInput
from src.workouts.models import Workout

@pytest.fixture
def mock_session():
    return AsyncMock()

@pytest.fixture
def user_id():
    return 1

@pytest.fixture
def add_exercise_payload():
    return AddExerciseRequest(
        exercise_type_id=10,
        initial_set=ExerciseSetInput(
            reps=10,
            intensity=100,
            intensity_unit_id=1,
            rest_time_seconds=60
        )
    )

@pytest.mark.asyncio
async def test_reuse_recent_unfinished_workout(mock_session, user_id, add_exercise_payload):
    """Should reuse an existing workout if started < 12h ago and end_time is None."""
    recent_start = datetime.now(timezone.utc) - timedelta(hours=WORKOUT_REUSE_WINDOW_HOURS - 1)
    existing_workout = Workout(
        id=100,
        owner_id=user_id,
        start_time=recent_start,
        end_time=None
    )

    with patch("src.workouts.service.get_latest_workout_for_user", return_value=existing_workout), \
         patch("src.workouts.service.get_exercises_for_workout", return_value=[]), \
         patch("src.workouts.service.create_exercise", return_value=SimpleNamespace(id=1)), \
         patch("src.workouts.service.create_exercise_set", return_value=None), \
         patch("src.workouts.service.get_workout_by_id", return_value=existing_workout), \
         patch("src.workouts.service.create_workout") as mock_create_workout:

        result = await WorkoutService.add_exercise_to_current_workout(mock_session, user_id, add_exercise_payload)

        assert result.id == 100
        mock_create_workout.assert_not_called()

@pytest.mark.asyncio
async def test_create_new_if_latest_is_finished(mock_session, user_id, add_exercise_payload):
    """Should create a new workout if the latest one is finished (end_time is not None)."""
    recent_start = datetime.now(timezone.utc) - timedelta(hours=1)
    finished_workout = Workout(
        id=100,
        owner_id=user_id,
        start_time=recent_start,
        end_time=datetime.now(timezone.utc)
    )
    new_workout = Workout(id=101, owner_id=user_id, start_time=datetime.now(timezone.utc))

    with patch("src.workouts.service.get_latest_workout_for_user", return_value=finished_workout), \
         patch("src.workouts.service.create_workout", return_value=new_workout) as mock_create_workout, \
         patch("src.workouts.service.get_exercises_for_workout", return_value=[]), \
         patch("src.workouts.service.create_exercise", return_value=SimpleNamespace(id=1)), \
         patch("src.workouts.service.get_workout_by_id", return_value=new_workout):

        result = await WorkoutService.add_exercise_to_current_workout(mock_session, user_id, add_exercise_payload)

        assert result.id == 101
        mock_create_workout.assert_called_once()

@pytest.mark.asyncio
async def test_create_new_if_latest_is_too_old(mock_session, user_id, add_exercise_payload):
    """Should create a new workout if the latest one started > 12h ago."""
    old_start = datetime.now(timezone.utc) - timedelta(hours=WORKOUT_REUSE_WINDOW_HOURS + 1)
    old_workout = Workout(
        id=100,
        owner_id=user_id,
        start_time=old_start,
        end_time=None
    )
    new_workout = Workout(id=101, owner_id=user_id, start_time=datetime.now(timezone.utc))

    with patch("src.workouts.service.get_latest_workout_for_user", return_value=old_workout), \
         patch("src.workouts.service.create_workout", return_value=new_workout) as mock_create_workout, \
         patch("src.workouts.service.get_exercises_for_workout", return_value=[]), \
         patch("src.workouts.service.create_exercise", return_value=SimpleNamespace(id=1)), \
         patch("src.workouts.service.get_workout_by_id", return_value=new_workout):

        result = await WorkoutService.add_exercise_to_current_workout(mock_session, user_id, add_exercise_payload)

        assert result.id == 101
        mock_create_workout.assert_called_once()

@pytest.mark.asyncio
async def test_create_new_if_no_previous_workout(mock_session, user_id, add_exercise_payload):
    """Should create a new workout if the user has no workouts at all."""
    new_workout = Workout(id=101, owner_id=user_id, start_time=datetime.now(timezone.utc))

    with patch("src.workouts.service.get_latest_workout_for_user", return_value=None), \
         patch("src.workouts.service.create_workout", return_value=new_workout) as mock_create_workout, \
         patch("src.workouts.service.get_exercises_for_workout", return_value=[]), \
         patch("src.workouts.service.create_exercise", return_value=SimpleNamespace(id=1)), \
         patch("src.workouts.service.get_workout_by_id", return_value=new_workout):

        result = await WorkoutService.add_exercise_to_current_workout(mock_session, user_id, add_exercise_payload)

        assert result.id == 101
        mock_create_workout.assert_called_once()
