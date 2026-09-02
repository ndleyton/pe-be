from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from src.exercises.models import ExerciseType, IntensityUnit
from src.mcp.idempotency import IdempotencyConflictError
from src.mcp.models import MCPIdempotencyRecord
from src.mcp.trainer_schemas import RoutineCreationInput, WorkoutLogInput
from src.routines.models import Routine
from src.routines.routine_creation_service import PersonalizedRoutineService
from src.users.models import User
from src.users.pat_models import PersonalAccessToken
from src.users.pat_schemas import PersonalAccessTokenCreate
from src.users.pat_service import (
    PATAuthenticationError,
    create_personal_access_token,
    list_personal_access_tokens,
    revoke_personal_access_token,
    verify_personal_access_token,
)
from src.workouts.history_service import WorkoutHistoryService
from src.workouts.models import Workout, WorkoutType
from src.workouts.workout_log_service import WorkoutLogService


pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _seed_catalog(db_session):
    user = User(
        email="mcp-integration@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
        timezone="America/Santiago",
    )
    workout_type = WorkoutType(name="Strength", description="Strength training")
    kg = IntensityUnit(name="Kilograms", abbreviation="kg")
    db_session.add_all([user, workout_type, kg])
    await db_session.flush()
    exercise_type = ExerciseType(
        name="Bench Press",
        description="Press",
        default_intensity_unit=kg.id,
        status=ExerciseType.ExerciseTypeStatus.released,
        times_used=0,
    )
    db_session.add(exercise_type)
    await db_session.commit()
    return user, workout_type, exercise_type


async def test_pat_lifecycle_uses_one_time_plaintext_and_enforces_revocation(db_session):
    user, _workout_type, _exercise_type = await _seed_catalog(db_session)
    created = await create_personal_access_token(
        db_session,
        user.id,
        PersonalAccessTokenCreate(
            name="Claude Desktop",
            scopes=["trainer:read", "trainer:write"],
            expires_in_days=30,
        ),
    )

    assert created.token.startswith(f"pebe_pat_{created.token_prefix}_")
    stored = await db_session.get(PersonalAccessToken, created.id)
    assert stored is not None
    assert stored.token_hash != created.token
    assert created.token not in stored.token_hash

    principal = await verify_personal_access_token(db_session, created.token)
    assert principal.user_id == user.id
    assert principal.scopes == frozenset({"trainer:read", "trainer:write"})
    summaries = await list_personal_access_tokens(db_session, user.id)
    assert [item.name for item in summaries] == ["Claude Desktop"]

    await revoke_personal_access_token(db_session, user.id, created.id)
    with pytest.raises(PATAuthenticationError):
        await verify_personal_access_token(db_session, created.token)


async def test_workout_and_routine_mutations_are_atomic_idempotent_and_user_scoped(
    db_session,
):
    user, workout_type, exercise_type = await _seed_catalog(db_session)
    workout_payload = WorkoutLogInput(
        name="MCP Push Day",
        workout_type_id=workout_type.id,
        start_time=datetime(2026, 9, 2, 12, tzinfo=timezone.utc),
        notes="Logged from an MCP client",
        idempotency_key="workout-request-001",
        exercises=[
            {
                "exercise_type_id": exercise_type.id,
                "sets": [
                    {
                        "reps": 5,
                        "intensity": 80,
                        "intensity_unit": "kg",
                        "rpe": 8,
                    }
                ],
            }
        ],
    )
    first = await WorkoutLogService().log_workout_idempotent(
        db_session, user.id, workout_payload
    )
    replay = await WorkoutLogService().log_workout_idempotent(
        db_session, user.id, workout_payload
    )
    assert replay.id == first.id
    assert first.created is True
    assert replay.created is False
    assert await db_session.scalar(select(func.count(Workout.id))) == 1

    changed_payload = workout_payload.model_copy(
        update={"name": "Different workout"}
    )
    with pytest.raises(IdempotencyConflictError):
        await WorkoutLogService().log_workout_idempotent(
            db_session, user.id, changed_payload
        )

    routine_payload = RoutineCreationInput(
        name="MCP Strength Plan",
        workout_type_id=workout_type.id,
        idempotency_key="routine-request-001",
        exercises=[
            {
                "exercise_type_id": exercise_type.id,
                "sets": [
                    {"reps": 5, "intensity": 75, "intensity_unit": "kg"}
                ],
            }
        ],
    )
    routine = await PersonalizedRoutineService().create_routine_idempotent(
        db_session, user.id, routine_payload
    )
    routine_replay = await PersonalizedRoutineService().create_routine_idempotent(
        db_session, user.id, routine_payload
    )
    assert routine_replay.id == routine.id
    assert routine_replay.created is False
    assert await db_session.scalar(select(func.count(Routine.id))) == 1
    assert await db_session.scalar(select(func.count(MCPIdempotencyRecord.id))) == 2

    history = WorkoutHistoryService()
    last = await history.get_last_workout_summary(db_session, user.id)
    assert last is not None
    assert last.workout_id == first.id
    assert last.exercises[0].name == "Bench Press"
    assert last.exercises[0].sets[0].intensity == 80

    by_date = await history.get_workout_summary_by_date(
        db_session, user.id, datetime(2026, 9, 2).date(), user.timezone
    )
    assert [item.workout_id for item in by_date.workouts] == [first.id]
    performance = await history.get_last_exercise_performance(
        db_session, user.id, "Bench Press"
    )
    assert performance is not None
    assert performance.workout_id == first.id
