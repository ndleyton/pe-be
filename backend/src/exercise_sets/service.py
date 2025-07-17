from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from src.exercise_sets.crud import (
    get_exercise_set_by_id,
    get_exercise_sets_for_exercise,
    create_exercise_set,
    update_exercise_set,
    delete_exercise_set,
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
        """Remove an exercise set with ownership verification"""
        exercise_set = await get_exercise_set_by_id(session, exercise_set_id)
        if not exercise_set:
            raise HTTPException(status_code=404, detail="Exercise set not found")

        # Verify ownership
        if exercise_set.exercise.workout.owner_id != user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to delete this exercise set"
            )

        return await delete_exercise_set(session, exercise_set_id)
