from __future__ import annotations

import hashlib
import json

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercise_sets.models import ExerciseSet, ExerciseSetCreationRequest
from src.exercise_sets.schemas import (
    ExerciseSetPairCreate,
    ExerciseSetRead,
)
from src.exercises.intensity_units import normalize_intensity_for_storage
from src.exercises.models import Exercise, IntensityUnit
from src.workouts.models import Workout


class PairIdempotencyConflict(ValueError):
    pass


def _request_hash(payload: ExerciseSetPairCreate) -> str:
    normalized = json.dumps(
        payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":")
    ).encode()
    return hashlib.sha256(normalized).hexdigest()


async def _existing_request(
    session: AsyncSession, *, user_id: int, key: str
) -> ExerciseSetCreationRequest | None:
    return await session.scalar(
        select(ExerciseSetCreationRequest).where(
            ExerciseSetCreationRequest.user_id == user_id,
            ExerciseSetCreationRequest.operation == "create_left_right_sets",
            ExerciseSetCreationRequest.idempotency_key == key,
        )
    )


async def create_left_right_pair(
    session: AsyncSession,
    *,
    payload: ExerciseSetPairCreate,
    user_id: int,
    idempotency_key: str,
) -> list[ExerciseSetRead]:
    fingerprint = _request_hash(payload)
    existing = await _existing_request(session, user_id=user_id, key=idempotency_key)
    if existing is not None:
        if existing.request_hash != fingerprint:
            raise PairIdempotencyConflict
        owner = await session.scalar(
            select(Workout.owner_id)
            .join(Exercise, Exercise.workout_id == Workout.id)
            .where(Exercise.id == payload.exercise_id)
        )
        if owner != user_id:
            raise LookupError
        return [ExerciseSetRead.model_validate(item) for item in existing.result_payload]

    request = ExerciseSetCreationRequest(
        user_id=user_id,
        operation="create_left_right_sets",
        idempotency_key=idempotency_key,
        request_hash=fingerprint,
    )
    try:
        async with session.begin_nested():
            session.add(request)
            await session.flush()
    except IntegrityError:
        existing = await _existing_request(session, user_id=user_id, key=idempotency_key)
        if existing is None:
            raise
        if existing.request_hash != fingerprint:
            raise PairIdempotencyConflict
        return [ExerciseSetRead.model_validate(item) for item in existing.result_payload]

    exercise = await session.scalar(
        select(Exercise)
        .join(Workout, Exercise.workout_id == Workout.id)
        .where(Exercise.id == payload.exercise_id, Workout.owner_id == user_id)
        .with_for_update()
    )
    if exercise is None:
        await session.rollback()
        raise LookupError

    max_position = await session.scalar(
        select(func.max(ExerciseSet.position)).where(
            ExerciseSet.exercise_id == payload.exercise_id,
            ExerciseSet.deleted_at.is_(None),
        )
    )
    first_position = (max_position if max_position is not None else -1) + 1
    created: list[ExerciseSet] = []
    for offset, item in enumerate(payload.sets):
        values = item.model_dump()
        source_unit = await session.get(IntensityUnit, values["intensity_unit_id"])
        canonical_intensity, canonical_key = normalize_intensity_for_storage(
            values.get("intensity"), source_unit
        )
        canonical_unit = source_unit
        if canonical_key is not None:
            canonical_unit = await session.scalar(
                select(IntensityUnit).where(
                    IntensityUnit.abbreviation.ilike(canonical_key)
                )
            ) or source_unit
        row = ExerciseSet(
            **values,
            exercise_id=payload.exercise_id,
            position=first_position + offset,
            canonical_intensity=canonical_intensity,
            canonical_intensity_unit_id=canonical_unit.id if canonical_unit else None,
        )
        session.add(row)
        created.append(row)

    await session.flush()
    response = [ExerciseSetRead.model_validate(row) for row in created]
    request.result_payload = [item.model_dump(mode="json") for item in response]
    await session.commit()
    return response
