from typing import List
from uuid import UUID

from fastapi import Depends, APIRouter, status, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercise_sets.schemas import (
    ExerciseSetCreate,
    ExerciseSetRead,
    ExerciseSetUpdate,
    ExerciseSetPairCreate,
    ExerciseSetOrderUpdate,
)
from src.exercise_sets.pair_service import (
    PairIdempotencyConflict,
    create_left_right_pair,
)
from src.exercise_sets.service import ExerciseSetService
from src.core.database import get_async_session
from src.users.router import current_active_user
from src.users.models import User

router = APIRouter(tags=["exercise-sets"])


@router.post(
    "/pairs/", response_model=List[ExerciseSetRead], status_code=status.HTTP_201_CREATED
)
async def create_exercise_set_pair(
    pair_in: ExerciseSetPairCreate,
    idempotency_key: UUID = Header(alias="Idempotency-Key"),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await create_left_right_pair(
            session,
            payload=pair_in,
            user_id=user.id,
            idempotency_key=str(idempotency_key),
        )
    except PairIdempotencyConflict as exc:
        raise HTTPException(
            status_code=409, detail="idempotency_key_reused"
        ) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Exercise not found") from exc


@router.post("/", response_model=ExerciseSetRead, status_code=status.HTTP_201_CREATED)
async def create_exercise_set(
    exercise_set_in: ExerciseSetCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new exercise set"""
    return await ExerciseSetService.create_new_exercise_set(
        session, exercise_set_in, user.id
    )


@router.get("/exercise/{exercise_id}", response_model=List[ExerciseSetRead])
async def get_exercise_sets(
    exercise_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get all exercise sets for a specific exercise (excluding soft-deleted)"""
    return await ExerciseSetService.get_exercise_sets_for_exercise(
        session, exercise_id, user.id
    )


@router.put(
    "/exercise/{exercise_id}/order", response_model=List[ExerciseSetRead]
)
async def reorder_exercise_set_list(
    exercise_id: int,
    order: ExerciseSetOrderUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        result = await ExerciseSetService.reorder_sets(
            session,
            exercise_id,
            order.ordered_set_ids,
            order.expected_set_ids,
            user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=409, detail="order_changed")
    return result


@router.put("/{exercise_set_id}", response_model=ExerciseSetRead)
async def update_exercise_set(
    exercise_set_id: int,
    exercise_set_update: ExerciseSetUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Update an exercise set"""
    exercise_set = await ExerciseSetService.update_exercise_set_data(
        session, exercise_set_id, exercise_set_update, user.id
    )
    if not exercise_set:
        raise HTTPException(status_code=404, detail="Exercise set not found")
    return exercise_set


@router.delete("/{exercise_set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise_set(
    exercise_set_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Soft delete an exercise set (sets deleted_at timestamp)"""
    # Idempotent delete: 204 for missing or already-deleted; 403 for not-owned
    await ExerciseSetService.remove_exercise_set(session, exercise_set_id, user.id)
