from __future__ import annotations

from datetime import date
from typing import Annotated

from mcp.server import MCPServer
from mcp.types import ToolAnnotations
from pydantic import Field

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import async_session_maker
from src.mcp.auth import current_principal, require_scope
from src.mcp.idempotency import (
    IdempotencyClaim,
    claim_idempotency_key,
    complete_idempotent_operation,
    request_fingerprint,
)
from src.mcp.models import MCPIdempotencyRecord, MCPIdempotencyStatus
from src.mcp.trainer_schemas import (
    ExercisePerformanceOutput,
    MutationResultOutput,
    RoutineCreationInput,
    WorkoutDateSummaryOutput,
    WorkoutLogInput,
    WorkoutRecapOutput,
    WorkoutSummaryOutput,
)
from src.routines.routine_creation_service import PersonalizedRoutineService
from src.users.models import User
from src.workouts.crud import get_workout_by_id
from src.workouts.history_service import WorkoutHistoryService
from src.workouts.recap import WorkoutRecapService
from src.workouts.workout_log_service import WorkoutLogService

trainer_server = MCPServer(
    "pe-be-trainer",
    description="User-scoped PE-BE workout history, coaching, and logging tools.",
)


@trainer_server.tool(
    annotations=ToolAnnotations(
        title="Get last workout", readOnlyHint=True, openWorldHint=False
    )
)
async def get_last_workout_summary() -> WorkoutSummaryOutput | None:
    """Return the authenticated user's latest workout and all recorded sets."""
    principal = await current_principal()
    require_scope(principal, "trainer:read")
    async with async_session_maker() as session:
        return await WorkoutHistoryService().get_last_workout_summary(
            session, principal.user_id
        )


@trainer_server.tool(
    annotations=ToolAnnotations(
        title="Get workouts by date", readOnlyHint=True, openWorldHint=False
    )
)
async def get_workout_summary_by_date(
    workout_date: date,
) -> WorkoutDateSummaryOutput:
    """Return workouts on a local calendar date using the user's timezone."""
    principal = await current_principal()
    require_scope(principal, "trainer:read")
    async with async_session_maker() as session:
        user = await session.get(User, principal.user_id)
        if user is None:
            raise ValueError("User not found")
        return await WorkoutHistoryService().get_workout_summary_by_date(
            session, principal.user_id, workout_date, user.timezone
        )


@trainer_server.tool(
    annotations=ToolAnnotations(
        title="Get last exercise performance",
        readOnlyHint=True,
        openWorldHint=False,
    )
)
async def get_last_exercise_performance(
    exercise_name: Annotated[str, Field(min_length=1, max_length=150)],
) -> ExercisePerformanceOutput | None:
    """Return the user's most recent sets for an exact exercise name."""
    principal = await current_principal()
    require_scope(principal, "trainer:read")
    async with async_session_maker() as session:
        return await WorkoutHistoryService().get_last_exercise_performance(
            session, principal.user_id, exercise_name
        )


@trainer_server.tool(
    annotations=ToolAnnotations(
        title="Log workout",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=False,
    )
)
async def log_workout(data: WorkoutLogInput) -> MutationResultOutput:
    """Atomically log a bounded workout; retries require the same idempotency key."""
    principal = await current_principal()
    require_scope(principal, "trainer:write")
    async with async_session_maker() as session:
        return await WorkoutLogService().log_workout_idempotent(
            session, principal.user_id, data
        )


@trainer_server.tool(
    annotations=ToolAnnotations(
        title="Create personalized routine",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=False,
    )
)
async def create_personalized_routine(
    data: RoutineCreationInput,
) -> MutationResultOutput:
    """Atomically create a private routine for the authenticated user."""
    principal = await current_principal()
    require_scope(principal, "trainer:write")
    async with async_session_maker() as session:
        return await PersonalizedRoutineService().create_routine_idempotent(
            session, principal.user_id, data
        )


@trainer_server.tool(
    annotations=ToolAnnotations(
        title="Get workout recap", readOnlyHint=True, openWorldHint=False
    )
)
async def get_workout_recap(workout_id: int) -> WorkoutRecapOutput:
    """Read a stored workout recap without invoking an AI model."""
    principal = await current_principal()
    require_scope(principal, "trainer:read")
    async with async_session_maker() as session:
        workout = await get_workout_by_id(session, workout_id, principal.user_id)
        if workout is None:
            raise ValueError("Workout not found")
        return WorkoutRecapOutput(workout_id=workout.id, recap=workout.recap)


async def _mark_claim_failed(
    session: AsyncSession,
    claim: IdempotencyClaim,
    error_code: str,
) -> None:
    try:
        await session.rollback()
        record = await session.get(MCPIdempotencyRecord, claim.record.id)
        if record is not None:
            record.status = MCPIdempotencyStatus.failed
            record.error_code = error_code
            await session.commit()
    except Exception:
        # Avoid masking the primary exception if session rollback/commit fails
        pass


@trainer_server.tool(
    annotations=ToolAnnotations(
        title="Generate workout recap",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=True,
    )
)
async def generate_workout_recap(
    workout_id: int,
    idempotency_key: Annotated[str, Field(min_length=8, max_length=128)],
    force: bool = False,
) -> WorkoutRecapOutput:
    """Generate and store an AI recap for one of the user's workouts."""
    principal = await current_principal()
    require_scope(principal, "trainer:write")
    async with async_session_maker() as session:
        workout = await get_workout_by_id(session, workout_id, principal.user_id)
        if workout is None:
            raise ValueError("Workout not found")
        if workout.recap and not force:
            return WorkoutRecapOutput(workout_id=workout.id, recap=workout.recap)

        fingerprint = request_fingerprint({"workout_id": workout_id, "force": force})
        claim = await claim_idempotency_key(
            session,
            user_id=principal.user_id,
            operation="generate_workout_recap",
            key=idempotency_key,
            request_hash=fingerprint,
        )
        if claim.cached_payload is not None:
            return WorkoutRecapOutput.model_validate(claim.cached_payload)
        await session.commit()

        try:
            recap = await WorkoutRecapService.generate_recap(
                session, workout_id, principal.user_id
            )
        except Exception:
            await _mark_claim_failed(session, claim, "generation_failed")
            raise

        if recap is None:
            await _mark_claim_failed(session, claim, "workout_not_found")
            raise ValueError("Workout not found")

        output = WorkoutRecapOutput(workout_id=workout_id, recap=recap, generated=True)
        complete_idempotent_operation(
            claim,
            entity_type="workout_recap",
            entity_id=workout_id,
            payload=output.model_dump(mode="json"),
        )
        await session.commit()
        return output
