import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch, MagicMock
from src.chat.service import ChatService, PersonalizedRoutineSetArgs
from datetime import date, datetime, timezone


@pytest.fixture
def chat_service_no_db():
    return ChatService(user_id=1, session=None)


@pytest.fixture
def chat_service_with_db():
    session_mock = AsyncMock()
    return ChatService(user_id=1, session=session_mock)


@pytest.mark.asyncio
async def test_get_last_exercise_performance_no_db(chat_service_no_db):
    result = await chat_service_no_db._get_last_exercise_performance("squat")
    assert result == "Database session not available."


@pytest.mark.asyncio
@patch("src.chat.service.get_exercise_types")
async def test_get_last_exercise_performance_no_exercise(
    mock_get_types, chat_service_with_db
):
    mock_get_types.return_value = MagicMock(data=[])
    result = await chat_service_with_db._get_last_exercise_performance("unknown")
    assert result == "No exercise named 'unknown' found."


@pytest.mark.asyncio
@patch("src.chat.service.get_exercise_types")
@patch("src.chat.service.get_exercise_type_stats")
async def test_get_last_exercise_performance_no_stats(
    mock_stats, mock_types, chat_service_with_db
):
    mock_type = MagicMock(id=1)
    mock_types.return_value = MagicMock(data=[mock_type])
    mock_stats.return_value = {}  # Empty stats

    result = await chat_service_with_db._get_last_exercise_performance("squat")
    assert result == "No workout data found for squat."
    mock_stats.assert_awaited_once_with(chat_service_with_db.session, 1, 1)


@pytest.mark.asyncio
async def test_get_last_workout_summary_no_db_in_method(chat_service_with_db):
    # This specifically tests line inside _get_last_workout_summary
    chat_service_with_db.session = None
    result = await chat_service_with_db._get_last_workout_summary()
    assert result == "Database session not available."


@pytest.mark.asyncio
@patch("src.chat.service.get_latest_workout_for_user")
async def test_get_last_workout_summary_exception(
    mock_get_latest, chat_service_with_db
):
    mock_get_latest.side_effect = Exception("DB error")
    result = await chat_service_with_db._get_last_workout_summary()
    assert "Error retrieving workout: DB error" in result


@pytest.mark.asyncio
@patch("src.chat.service.get_latest_workout_for_user")
async def test_get_last_workout_summary_no_workout(
    mock_get_latest, chat_service_with_db
):
    mock_get_latest.return_value = None
    result = await chat_service_with_db._get_last_workout_summary()
    assert result == "No workout history found."


@pytest.mark.asyncio
@patch("src.chat.service.get_exercises_for_workout")
@patch("src.chat.service.get_latest_workout_for_user")
async def test_get_last_workout_summary_exercises_exception(
    mock_get_latest, mock_get_exercises, chat_service_with_db
):
    mock_workout = MagicMock(id=1, name="Test")
    mock_get_latest.return_value = mock_workout
    mock_get_exercises.side_effect = Exception("Exercise error")

    result = await chat_service_with_db._get_last_workout_summary()
    assert "Error retrieving exercises: Exercise error" in result


@pytest.mark.asyncio
@patch("src.chat.service.get_exercises_for_workout")
@patch("src.chat.service.get_latest_workout_for_user")
async def test_get_last_workout_summary_generate_exception(
    mock_get_latest, mock_get_exercises, chat_service_with_db
):
    mock_workout = MagicMock(id=1, name="Test")
    mock_workout.start_time.strftime.side_effect = Exception("Date formatting error")
    mock_get_latest.return_value = mock_workout

    mock_exercise = MagicMock()
    mock_get_exercises.return_value = [mock_exercise]

    result = await chat_service_with_db._get_last_workout_summary()
    assert "Error generating summary: Date formatting error" in result


@pytest.mark.asyncio
@patch("src.chat.service.get_exercises_for_workout")
@patch("src.chat.service.get_latest_workout_for_user")
async def test_get_last_workout_summary_no_exercises(
    mock_get_latest, mock_get_exercises, chat_service_with_db
):
    mock_workout = MagicMock(id=1, name="Test Workout")
    mock_workout.start_time = date(2023, 1, 1)
    mock_get_latest.return_value = mock_workout
    mock_get_exercises.return_value = []

    result = await chat_service_with_db._get_last_workout_summary()
    assert "doesn't have any exercises logged." in result


@pytest.mark.asyncio
async def test_get_workout_summary_by_date_no_db(chat_service_no_db):
    result = await chat_service_no_db._get_workout_summary_by_date("2023-01-01")
    assert result == "Database session not available."


@pytest.mark.asyncio
async def test_get_workout_summary_by_date_invalid_date(chat_service_with_db):
    result = await chat_service_with_db._get_workout_summary_by_date("invalid-date")
    assert result == "Invalid date format. Please use YYYY-MM-DD."


@pytest.mark.asyncio
@patch("src.chat.service.get_workout_by_date")
async def test_get_workout_summary_by_date_no_workout(mock_get, chat_service_with_db):
    mock_get.return_value = None
    result = await chat_service_with_db._get_workout_summary_by_date("2023-01-01")
    assert result == "No workout found on 2023-01-01."


@pytest.mark.asyncio
@patch("src.chat.service.get_exercises_for_workout")
@patch("src.chat.service.get_workout_by_date")
async def test_get_workout_summary_by_date_no_exercises(
    mock_get_workout, mock_get_exercises, chat_service_with_db
):
    mock_workout = MagicMock(id=1, name="Test Workout")
    mock_get_workout.return_value = mock_workout
    mock_get_exercises.return_value = []
    result = await chat_service_with_db._get_workout_summary_by_date("2023-01-01")
    assert "Test Workout" in result
    assert "doesn't have any exercises logged." in result


@pytest.mark.asyncio
async def test_parse_workout_and_save_already_saved(chat_service_with_db):
    chat_service_with_db._workout_saved_this_request = True
    result = await chat_service_with_db._parse_workout_and_save()
    assert "WORKOUT ALREADY SAVED" in result


@pytest.mark.asyncio
async def test_parse_workout_and_save_no_db(chat_service_no_db):
    # This will still parse and hit the no db block
    kwargs = {"name": "Test", "workout_type_id": 1, "exercises": []}
    result = await chat_service_no_db._parse_workout_and_save(**kwargs)
    assert "Failed to save workout: no database session available." in result


@pytest.mark.asyncio
@patch("src.workouts.service.WorkoutService.create_workout_from_parsed")
async def test_parse_workout_and_save_exception(mock_create, chat_service_with_db):
    mock_create.side_effect = Exception("DB save failed")
    kwargs = {"name": "Test", "workout_type_id": 1, "exercises": []}
    result = await chat_service_with_db._parse_workout_and_save(**kwargs)
    assert "Failed to save workout: DB save failed" in result


@pytest.mark.asyncio
async def test_generate_response_empty_final_message_has_generation(chat_service_no_db):
    chat_service_no_db.langfuse = MagicMock()
    mock_trace = MagicMock()
    mock_trace.generation.return_value = MagicMock()
    chat_service_no_db.langfuse.trace.return_value = mock_trace

    mock_llm = AsyncMock()
    mock_llm.model_name = "test"
    mock_tool_call_response = MagicMock()
    mock_tool_call_response.tool_calls = []
    # Make response_text evaluate to an empty string to trigger `or "(no content)"` in `end()` call
    mock_tool_call_response.message = MagicMock(role="assistant", content="")
    mock_llm.acomplete.return_value = mock_tool_call_response

    with (
        patch("src.chat.service.ChatService._get_llm_client", return_value=mock_llm),
        patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key", create=True),
    ):
        await chat_service_no_db.generate_response(
            [{"role": "user", "content": "hi"}], save_to_db=False
        )
        mock_trace.generation().end.assert_called_with(output="(no content)")


@pytest.mark.asyncio
async def test_chat_service_initialization_with_clients():
    """Test ChatService init initializes properly without db"""
    # Force Langfuse configuration to test initialisation
    with (
        patch("src.chat.service.settings.LANGFUSE_PUBLIC_KEY", "pub_key"),
        patch("src.chat.service.settings.LANGFUSE_SECRET_KEY", "sec_key"),
        patch("src.chat.service.settings.LANGFUSE_HOST", "http://localhost"),
    ):
        service = ChatService(user_id=1)
        assert service.langfuse is not None


@pytest.mark.asyncio
async def test_get_llm_client_lazy_initialization():
    service = ChatService(user_id=1)
    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "some_key"):
        client = service._get_llm_client()
        assert client is not None
        # Verify it caches the instance
        client2 = service._get_llm_client()
        assert client is client2


@pytest.mark.asyncio
@patch("src.chat.service.ChatService._get_llm_client")
async def test_generate_response_without_generation_end(
    mock_get_llm, chat_service_no_db
):
    """Test the case where tracing is enabled but trace.generation returns None"""
    mock_llm = AsyncMock()
    mock_llm.model_name = "test"
    mock_tool_call_response = MagicMock()
    mock_tool_call_response.tool_calls = []
    mock_tool_call_response.message = MagicMock(role="assistant", content="hi from llm")
    mock_llm.acomplete.return_value = mock_tool_call_response
    mock_get_llm.return_value = mock_llm

    chat_service_no_db.langfuse = MagicMock()
    mock_trace = MagicMock()

    # Critical: make trace.generation return None so we hit line 527 "if generation" -> False condition
    mock_trace.generation.return_value = None
    chat_service_no_db.langfuse.trace.return_value = mock_trace

    with patch("src.chat.service.settings.GOOGLE_AI_KEY", "test_key", create=True):
        result = await chat_service_no_db.generate_response(
            [{"role": "user", "content": "hi"}], save_to_db=False
        )
        assert result["message"] == "hi from llm"
        # Ensure generation object's end method was not called by checking trace generation wasn't hit differently
        # We can't check .end on NoneType directly. It's covered by the run completing successfully
        assert mock_trace.generation.call_count == 1


@pytest.mark.asyncio
async def test_parse_workout_and_save_tool_wrapper(chat_service_with_db):
    # We mock out the create_workout_from_parsed function inside the service completely
    with patch(
        "src.workouts.service.WorkoutService.create_workout_from_parsed"
    ) as mock_create:
        # Test 1: Workout is empty/not a proper workout -> exception
        res1 = await chat_service_with_db._parse_workout_and_save()
        assert "Failed to save workout" in res1

        # Test 2: Proper workout creation
        kwargs = {
            "name": "Test generated",
            "workout_type_id": 1,
            "exercises": [
                {
                    "exercise_type_name": "Pushups",
                    "sets": [{"reps": 10, "intensity": 60, "intensity_unit": "lbs"}],
                }
            ],
        }
        mock_create.return_value = SimpleNamespace(
            id=123,
            name="Test generated",
            notes=None,
            start_time=datetime(2026, 4, 1, tzinfo=timezone.utc),
            end_time=None,
        )
        res2 = await chat_service_with_db._parse_workout_and_save(**kwargs)
        assert "WORKOUT SAVED SUCCESSFULLY" in res2
        assert mock_create.called
        assert len(chat_service_with_db._pending_chat_events) == 1


@pytest.mark.asyncio
@patch("src.chat.service.routine_service.create_routine_admin")
@patch("src.chat.service.get_intensity_units")
@patch("src.chat.service.get_exercise_types")
@patch("src.chat.service.get_workout_types")
async def test_create_personalized_routine_success(
    mock_get_workout_types,
    mock_get_exercise_types,
    mock_get_intensity_units,
    mock_create_routine,
    chat_service_with_db,
):
    mock_get_workout_types.return_value = [
        SimpleNamespace(id=4, name="Strength Training")
    ]
    mock_get_exercise_types.return_value = MagicMock(
        data=[SimpleNamespace(id=9, name="Goblet Squat")]
    )
    mock_get_intensity_units.return_value = [
        SimpleNamespace(id=3, name="Bodyweight", abbreviation="bw")
    ]
    mock_create_routine.return_value = SimpleNamespace(
        id=42,
        name="Beginner Full Body",
        description="Build muscle. Commercial gym access. 3 day(s) per week",
        workout_type_id=4,
        exercise_templates=[
            SimpleNamespace(set_templates=[SimpleNamespace(), SimpleNamespace()]),
        ],
    )

    result = await chat_service_with_db._create_personalized_routine(
        name="Beginner Full Body",
        workout_type_name="Strength",
        goal_summary="Build muscle",
        equipment_notes="Commercial gym access",
        exercises=[
            {
                "exercise_type_name": "Goblet Squat",
                "sets": [
                    {"reps": 10, "intensity_unit": "BW"},
                    {"reps": 10, "intensity_unit": "BW"},
                ],
            }
        ],
    )

    assert "ROUTINE CREATED SUCCESSFULLY" in result
    assert len(chat_service_with_db._pending_chat_events) == 1
    assert chat_service_with_db._pending_chat_events[0].model_dump(mode="json") == {
        "type": "routine_created",
        "title": "Routine created",
        "cta_label": "View routine",
        "routine": {
            "id": 42,
            "name": "Beginner Full Body",
            "description": "Build muscle. Commercial gym access. 3 day(s) per week",
            "workout_type_id": 4,
            "exercise_count": 1,
            "set_count": 2,
        },
    }
    mock_create_routine.assert_awaited_once()


@pytest.mark.asyncio
@patch("src.chat.service.routine_service.create_routine_admin")
@patch("src.chat.service.get_intensity_units")
@patch("src.chat.service.get_exercise_types")
@patch("src.chat.service.get_workout_types")
async def test_create_personalized_routine_persists_duration_seconds(
    mock_get_workout_types,
    mock_get_exercise_types,
    mock_get_intensity_units,
    mock_create_routine,
    chat_service_with_db,
):
    mock_get_workout_types.return_value = [SimpleNamespace(id=4, name="Strength")]
    mock_get_exercise_types.return_value = MagicMock(
        data=[SimpleNamespace(id=9, name="Sled Push")]
    )
    mock_get_intensity_units.return_value = [
        SimpleNamespace(id=7, name="Time Based", abbreviation="time-based")
    ]
    mock_create_routine.return_value = SimpleNamespace(
        id=101,
        name="Conditioning Builder",
        description="desc",
        workout_type_id=4,
        exercise_templates=[SimpleNamespace(set_templates=[SimpleNamespace()])],
    )

    await chat_service_with_db._create_personalized_routine(
        name="Conditioning Builder",
        workout_type_name="Strength",
        goal_summary="Build conditioning",
        equipment_notes="Track and sled access",
        exercises=[
            {
                "exercise_type_name": "Sled Push",
                "sets": [{"reps": "5-10 minutes", "intensity_unit": "time-based"}],
            }
        ],
    )

    routine_payload = mock_create_routine.await_args.args[1]
    assert routine_payload.exercise_templates[0].set_templates[0].reps is None
    assert (
        routine_payload.exercise_templates[0].set_templates[0].duration_seconds
        == 600
    )


@pytest.mark.asyncio
@patch("src.chat.service.routine_service.create_routine_admin")
@patch("src.chat.service.get_intensity_units")
@patch("src.chat.service.get_exercise_types")
@patch("src.chat.service.get_workout_types")
async def test_create_personalized_routine_defaults_duration_for_speed_units(
    mock_get_workout_types,
    mock_get_exercise_types,
    mock_get_intensity_units,
    mock_create_routine,
    chat_service_with_db,
):
    mock_get_workout_types.return_value = [SimpleNamespace(id=4, name="Strength")]
    mock_get_exercise_types.return_value = MagicMock(
        data=[SimpleNamespace(id=9, name="Treadmill Run")]
    )
    mock_get_intensity_units.return_value = [
        SimpleNamespace(id=8, name="Kilometers per Hour", abbreviation="km/h")
    ]
    mock_create_routine.return_value = SimpleNamespace(
        id=102,
        name="Conditioning Builder",
        description="desc",
        workout_type_id=4,
        exercise_templates=[SimpleNamespace(set_templates=[SimpleNamespace()])],
    )

    await chat_service_with_db._create_personalized_routine(
        name="Conditioning Builder",
        workout_type_name="Strength",
        goal_summary="Build conditioning",
        equipment_notes="Treadmill access",
        exercises=[
            {
                "exercise_type_name": "Treadmill Run",
                "sets": [{"intensity": 12, "intensity_unit": "km/h"}],
            }
        ],
    )

    routine_payload = mock_create_routine.await_args.args[1]
    assert routine_payload.exercise_templates[0].set_templates[0].reps is None
    assert (
        routine_payload.exercise_templates[0].set_templates[0].duration_seconds
        == 600
    )
    assert routine_payload.exercise_templates[0].set_templates[0].intensity == 12


@pytest.mark.asyncio
@patch("src.chat.service.get_workout_types")
async def test_create_personalized_routine_unknown_workout_type(
    mock_get_workout_types, chat_service_with_db
):
    mock_get_workout_types.return_value = [SimpleNamespace(id=4, name="Strength")]

    result = await chat_service_with_db._create_personalized_routine(
        name="Beginner Full Body",
        workout_type_name="Conditioning",
        goal_summary="Build muscle",
        days_per_week=3,
        equipment_notes="Commercial gym access",
        exercises=[
            {
                "exercise_type_name": "Goblet Squat",
                "sets": [{"reps": 10, "intensity_unit": "BW"}],
            }
        ],
    )

    assert (
        result
        == "Failed to create routine: Unknown workout type 'Conditioning'. Available workout types: Strength."
    )


@pytest.mark.asyncio
@patch("src.chat.service.get_exercise_types")
@patch("src.chat.service.get_workout_types")
async def test_create_personalized_routine_unknown_exercise_type(
    mock_get_workout_types, mock_get_exercise_types, chat_service_with_db
):
    mock_get_workout_types.return_value = [SimpleNamespace(id=4, name="Strength")]
    mock_get_exercise_types.return_value = MagicMock(data=[])

    result = await chat_service_with_db._create_personalized_routine(
        name="Beginner Full Body",
        workout_type_name="Strength",
        goal_summary="Build muscle",
        days_per_week=3,
        equipment_notes="Commercial gym access",
        exercises=[
            {
                "exercise_type_name": "Goblet Squat",
                "sets": [{"reps": 10, "intensity_unit": "BW"}],
            }
        ],
    )

    assert (
        result
        == "Failed to create routine: Unknown exercise type 'Goblet Squat'. Please choose a canonical exercise name."
    )


@pytest.mark.asyncio
@patch("src.chat.service.get_intensity_units")
@patch("src.chat.service.get_exercise_types")
@patch("src.chat.service.get_workout_types")
async def test_create_personalized_routine_unknown_intensity_unit(
    mock_get_workout_types,
    mock_get_exercise_types,
    mock_get_intensity_units,
    chat_service_with_db,
):
    mock_get_workout_types.return_value = [SimpleNamespace(id=4, name="Strength")]
    mock_get_exercise_types.return_value = MagicMock(
        data=[SimpleNamespace(id=9, name="Goblet Squat")]
    )
    mock_get_intensity_units.return_value = [
        SimpleNamespace(id=3, name="Bodyweight", abbreviation="bw")
    ]

    result = await chat_service_with_db._create_personalized_routine(
        name="Beginner Full Body",
        workout_type_name="Strength",
        goal_summary="Build muscle",
        days_per_week=3,
        equipment_notes="Commercial gym access",
        exercises=[
            {
                "exercise_type_name": "Goblet Squat",
                "sets": [{"reps": 10, "intensity_unit": "stone"}],
            }
        ],
    )

    assert (
        result
        == "Failed to create routine: Unknown intensity unit 'stone'. Available units: bw."
    )


def test_personalized_routine_set_args_normalizes_rep_range_text():
    parsed = PersonalizedRoutineSetArgs.model_validate(
        {"reps": "6-8 or AMRAP", "intensity_unit": "bw"}
    )

    assert parsed.reps == 8
    assert parsed.duration_seconds is None


def test_personalized_routine_set_args_converts_time_text_to_duration_seconds():
    parsed = PersonalizedRoutineSetArgs.model_validate(
        {"reps": "5-10 minutes", "intensity_unit": "time-based"}
    )

    assert parsed.reps is None
    assert parsed.duration_seconds == 600


@pytest.mark.asyncio
async def test_get_workout_summary_by_date_intensity_display_paths(chat_service_no_db):
    # Unit tests specifically for the logic handling missing intensity vs missing abbreviation in summaries
    mock_workout = MagicMock()
    mock_workout.name = "Test"
    mock_workout.start_time = MagicMock()
    mock_workout.start_time.strftime.return_value = "2024-01-01"

    # Set up exercise with various set combos:
    mock_exercise = MagicMock()
    mock_exercise.exercise_type.name = "Test Exercise"

    set1 = MagicMock(id=1, reps=10, intensity=50, intensity_unit=None)

    class FakeUnitNoAbbrev:
        pass

    set2 = MagicMock(id=2, reps=12, intensity=60, intensity_unit=FakeUnitNoAbbrev())

    mock_exercise.exercise_sets = [set1, set2]

    with (
        patch("src.chat.service.get_workout_by_date", return_value=mock_workout),
        patch(
            "src.chat.service.get_exercises_for_workout", return_value=[mock_exercise]
        ),
    ):
        chat_service_no_db.session = (
            AsyncMock()
        )  # Required to not trip the no session check
        res = await chat_service_no_db._get_workout_summary_by_date("2024-01-01")
        assert "at 50" in res
        assert "at 60" in res


@pytest.mark.asyncio
async def test_get_last_workout_summary_intensity_display_paths(chat_service_no_db):
    mock_workout = MagicMock()
    mock_workout.name = "Test"
    mock_workout.start_time = MagicMock()
    mock_workout.start_time.strftime.return_value = "2024-01-01"

    mock_exercise = MagicMock()
    mock_exercise.exercise_type.name = "Test Exercise"

    set1 = MagicMock(id=1, reps=10, intensity=50, intensity_unit=None)

    class FakeUnitNoAbbrev:
        pass

    set2 = MagicMock(id=2, reps=12, intensity=60, intensity_unit=FakeUnitNoAbbrev())
    mock_exercise.exercise_sets = [set1, set2]

    # Required for last workout fetching
    chat_service_no_db.session = AsyncMock()
    with (
        patch(
            "src.chat.service.get_latest_workout_for_user", return_value=mock_workout
        ),
        patch(
            "src.chat.service.get_exercises_for_workout", return_value=[mock_exercise]
        ),
    ):
        res = await chat_service_no_db._get_last_workout_summary()
        assert "at 50" in res
        assert "at 60" in res
