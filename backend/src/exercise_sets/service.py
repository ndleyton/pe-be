from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from sqlalchemy import update

from src.exercise_sets.crud import (
    get_exercise_set_by_id,
    get_exercise_set_owner_and_deleted,
    get_exercise_sets_for_exercise,
    create_exercise_set,
    update_exercise_set,
    verify_exercise_ownership,
)
from src.exercise_sets.models import ExerciseSet
from src.exercise_sets.schemas import ExerciseSetCreate, ExerciseSetUpdate


class ExerciseSetService:
    """Service layer for exercise set business logic"""

    @staticmethod
    async def get_exercise_set(
        session: AsyncSession, exercise_set_id: int, user_id: int
    ) -> Optional[ExerciseSet]:
        """Get an exercise set by ID with ownership verification"""
        exercise_set = await get_exercise_set_by_id(session, exercise_set_id)
        if not exercise_set:
            return None

        # Verify ownership
        if exercise_set.exercise.workout.owner_id != user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to access this exercise set"
            )

        return exercise_set

    @staticmethod
    async def get_exercise_sets_for_exercise(
        session: AsyncSession, exercise_id: int, user_id: int
    ) -> List[ExerciseSet]:
        """Get all exercise sets for a specific exercise with ownership verification"""
        # Verify the exercise exists and belongs to the user
        exercise = await verify_exercise_ownership(session, exercise_id, user_id)
        if not exercise:
            raise HTTPException(status_code=404, detail="Exercise not found")

        return await get_exercise_sets_for_exercise(session, exercise_id)

    @staticmethod
    async def create_new_exercise_set(
        session: AsyncSession, exercise_set_data: ExerciseSetCreate, user_id: int
    ) -> ExerciseSet:
        """Create a new exercise set with ownership verification"""
        # Verify the exercise exists and belongs to the user
        exercise = await verify_exercise_ownership(
            session, exercise_set_data.exercise_id, user_id
        )
        if not exercise:
            raise HTTPException(status_code=404, detail="Exercise not found")

        return await create_exercise_set(session, exercise_set_data)

    @staticmethod
    async def update_exercise_set_data(
        session: AsyncSession,
        exercise_set_id: int,
        exercise_set_data: ExerciseSetUpdate,
        user_id: int,
    ) -> Optional[ExerciseSet]:
        """Update exercise set data with ownership verification"""
        exercise_set = await get_exercise_set_by_id(session, exercise_set_id)
        if not exercise_set:
            raise HTTPException(status_code=404, detail="Exercise set not found")

        # Verify ownership
        if exercise_set.exercise.workout.owner_id != user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to update this exercise set"
            )

        return await update_exercise_set(session, exercise_set_id, exercise_set_data)

    @staticmethod
    async def remove_exercise_set(
        session: AsyncSession, exercise_set_id: int, user_id: int
    ) -> bool:
        """Soft delete an exercise set with ownership verification (idempotent).

        - If the set doesn't exist or is already soft-deleted, return True (no-op).
        - If it exists but isn't owned by the user, raise 403.
        - Otherwise soft-delete and return True.
        """
        row = await get_exercise_set_owner_and_deleted(session, exercise_set_id)

        # Not found => idempotent success
        if not row:
            return True

        # Not owned => forbidden
        owner_id, deleted_at = row
        if owner_id != user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to delete this exercise set"
            )

        # Already deleted => idempotent success
        if deleted_at is not None:
            return True

        # Perform idempotent soft delete via guarded update
        now = datetime.now(timezone.utc)
        await session.execute(
            update(ExerciseSet)
            .where(ExerciseSet.id == exercise_set_id, ExerciseSet.deleted_at.is_(None))
            .values(deleted_at=now)
        )

        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise

        return True
