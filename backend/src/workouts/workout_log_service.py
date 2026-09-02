from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercise_sets.models import ExerciseSet
from src.exercises.intensity_units import normalize_intensity_for_storage
from src.exercises.models import Exercise, ExerciseType, IntensityUnit
from src.mcp.idempotency import (
    claim_idempotency_key,
    complete_idempotent_operation,
    request_fingerprint,
)
from src.mcp.trainer_schemas import MutationResultOutput, WorkoutLogInput
from src.workouts.models import Workout, WorkoutType


async def _resolve_exercise_type(
    session: AsyncSession,
    *,
    user_id: int,
    exercise_type_id: int | None,
    exercise_name: str | None,
) -> ExerciseType:
    query = select(ExerciseType).where(
        or_(
            ExerciseType.status == ExerciseType.ExerciseTypeStatus.released,
            ExerciseType.owner_id == user_id,
        )
    )
    if exercise_type_id is not None:
        query = query.where(ExerciseType.id == exercise_type_id)
    else:
        query = query.where(func.lower(ExerciseType.name) == exercise_name.lower())
    result = await session.execute(query)
    exercise_type = result.scalars().first()
    if exercise_type is None:
        raise ValueError(
            f"Exercise type not found: {exercise_type_id or exercise_name}"
        )
    return exercise_type


async def _resolve_unit(
    session: AsyncSession,
    *,
    requested: str | None,
    default_id: int | None,
) -> IntensityUnit:
    query = select(IntensityUnit)
    if requested:
        normalized = requested.strip().lower()
        query = query.where(
            or_(
                func.lower(IntensityUnit.abbreviation) == normalized,
                func.lower(IntensityUnit.name) == normalized,
            )
        )
    elif default_id is not None:
        query = query.where(IntensityUnit.id == default_id)
    query = query.order_by(IntensityUnit.id).limit(1)
    unit = (await session.execute(query)).scalar_one_or_none()
    if unit is None:
        raise ValueError(f"Intensity unit not found: {requested or default_id}")
    return unit


async def _canonical_unit(
    session: AsyncSession, canonical_key: str | None
) -> IntensityUnit | None:
    if canonical_key is None:
        return None
    result = await session.execute(
        select(IntensityUnit).where(
            func.lower(IntensityUnit.abbreviation) == canonical_key.lower()
        )
    )
    return result.scalar_one_or_none()


class WorkoutLogService:
    async def log_workout_idempotent(
        self, session: AsyncSession, user_id: int, data: WorkoutLogInput
    ) -> MutationResultOutput:
        claim = await claim_idempotency_key(
            session,
            user_id=user_id,
            operation="log_workout",
            key=data.idempotency_key,
            request_hash=request_fingerprint(data),
        )
        if claim.cached_payload is not None:
            cached = MutationResultOutput.model_validate(claim.cached_payload)
            return cached.model_copy(
                update={"created": False, "message": "Workout already logged"}
            )

        try:
            workout_type_id = data.workout_type_id
            if workout_type_id is None:
                workout_type_id = (
                    await session.execute(
                        select(WorkoutType.id).order_by(WorkoutType.id).limit(1)
                    )
                ).scalar_one_or_none()
            elif (
                await session.execute(
                    select(WorkoutType.id).where(WorkoutType.id == workout_type_id)
                )
            ).scalar_one_or_none() is None:
                raise ValueError("Workout type not found")
            if workout_type_id is None:
                raise ValueError("No workout type is configured")

            started_at = data.start_time or datetime.now(timezone.utc)
            workout = Workout(
                owner_id=user_id,
                workout_type_id=workout_type_id,
                name=data.name,
                notes=data.notes,
                start_time=started_at,
                end_time=data.end_time or started_at,
                visibility=Workout.WorkoutVisibility.private,
            )
            session.add(workout)
            await session.flush()

            for exercise_input in data.exercises:
                exercise_type = await _resolve_exercise_type(
                    session,
                    user_id=user_id,
                    exercise_type_id=exercise_input.exercise_type_id,
                    exercise_name=exercise_input.exercise_name,
                )
                exercise_type.times_used = (exercise_type.times_used or 0) + 1
                exercise = Exercise(
                    workout_id=workout.id,
                    exercise_type_id=exercise_type.id,
                    notes=exercise_input.notes,
                    timestamp=started_at,
                )
                session.add(exercise)
                await session.flush()

                for set_input in exercise_input.sets:
                    unit = await _resolve_unit(
                        session,
                        requested=set_input.intensity_unit,
                        default_id=exercise_type.default_intensity_unit,
                    )
                    canonical_value, canonical_key = normalize_intensity_for_storage(
                        set_input.intensity, unit
                    )
                    canonical = await _canonical_unit(session, canonical_key)
                    session.add(
                        ExerciseSet(
                            exercise_id=exercise.id,
                            reps=set_input.reps,
                            duration_seconds=set_input.duration_seconds,
                            intensity=set_input.intensity,
                            intensity_unit_id=unit.id,
                            canonical_intensity=canonical_value,
                            canonical_intensity_unit_id=(
                                canonical.id if canonical else None
                            ),
                            rpe=set_input.rpe,
                            rir=set_input.rir,
                            rest_time_seconds=set_input.rest_time_seconds,
                            notes=set_input.notes,
                            type=set_input.type,
                            done=set_input.done,
                        )
                    )

            await session.flush()
            output = MutationResultOutput(
                id=workout.id, created=True, message="Workout logged"
            )
            complete_idempotent_operation(
                claim,
                entity_type="workout",
                entity_id=workout.id,
                payload=output.model_dump(mode="json"),
            )
            await session.commit()
            return output
        except Exception:
            await session.rollback()
            raise
