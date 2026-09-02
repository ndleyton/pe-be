from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercises.intensity_units import normalize_intensity_for_storage
from src.exercises.models import IntensityUnit
from src.mcp.idempotency import (
    claim_idempotency_key,
    complete_idempotent_operation,
    request_fingerprint,
)
from src.mcp.trainer_schemas import MutationResultOutput, RoutineCreationInput
from src.routines.models import ExerciseTemplate, Routine, SetTemplate
from src.workouts.models import WorkoutType
from src.workouts.workout_log_service import _canonical_unit, _resolve_exercise_type


class PersonalizedRoutineService:
    async def create_routine_idempotent(
        self, session: AsyncSession, user_id: int, data: RoutineCreationInput
    ) -> MutationResultOutput:
        claim = await claim_idempotency_key(
            session,
            user_id=user_id,
            operation="create_personalized_routine",
            key=data.idempotency_key,
            request_hash=request_fingerprint(data),
        )
        if claim.cached_payload is not None:
            cached = MutationResultOutput.model_validate(claim.cached_payload)
            return cached.model_copy(
                update={"created": False, "message": "Routine already created"}
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

            routine = Routine(
                name=data.name,
                description=data.description,
                workout_type_id=workout_type_id,
                creator_id=user_id,
                visibility=Routine.RoutineVisibility.private,
                is_readonly=False,
            )
            session.add(routine)
            await session.flush()

            for exercise_input in data.exercises:
                exercise_type = await _resolve_exercise_type(
                    session,
                    user_id=user_id,
                    exercise_type_id=exercise_input.exercise_type_id,
                    exercise_name=exercise_input.exercise_name,
                )
                template = ExerciseTemplate(
                    routine_id=routine.id,
                    exercise_type_id=exercise_type.id,
                    notes=exercise_input.notes,
                )
                session.add(template)
                await session.flush()
                for set_input in exercise_input.sets:
                    requested = set_input.intensity_unit
                    query = select(IntensityUnit)
                    if requested:
                        normalized = requested.strip().lower()
                        query = query.where(
                            (func.lower(IntensityUnit.abbreviation) == normalized)
                            | (func.lower(IntensityUnit.name) == normalized)
                        )
                    elif exercise_type.default_intensity_unit is not None:
                        query = query.where(
                            IntensityUnit.id == exercise_type.default_intensity_unit
                        )
                    unit = (
                        await session.execute(query.order_by(IntensityUnit.id).limit(1))
                    ).scalar_one_or_none()
                    if unit is None:
                        raise ValueError(
                            f"Intensity unit not found: {requested or 'default'}"
                        )
                    canonical_value, canonical_key = normalize_intensity_for_storage(
                        set_input.intensity, unit
                    )
                    canonical = await _canonical_unit(session, canonical_key)
                    session.add(
                        SetTemplate(
                            exercise_template_id=template.id,
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
                            notes=set_input.notes,
                            type=set_input.type,
                        )
                    )

            await session.flush()
            output = MutationResultOutput(
                id=routine.id, created=True, message="Routine created"
            )
            complete_idempotent_operation(
                claim,
                entity_type="routine",
                entity_id=routine.id,
                payload=output.model_dump(mode="json"),
            )
            await session.commit()
            return output
        except Exception:
            await session.rollback()
            raise
