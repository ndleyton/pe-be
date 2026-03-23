from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import update
from fastapi import HTTPException, status

from src.exercises.crud import (
    get_exercise_by_id,
    get_exercises_for_workout,
    create_exercise,
    get_exercise_types,
    get_exercise_type_by_id,
    create_exercise_type,
    get_exercise_type_stats,
    get_intensity_units,
    get_exercise_owner_id,
)
from src.exercises.models import Exercise, ExerciseType, IntensityUnit
from src.exercise_sets.models import ExerciseSet
from src.exercises.schemas import (
    ExerciseCreate,
    ExerciseTypeCreate,
    PaginatedExerciseTypesResponse,
)


class ExerciseService:
    """Service layer for exercise business logic"""

    @staticmethod
    async def get_exercise(
        session: AsyncSession, exercise_id: int
    ) -> Optional[Exercise]:
        """Get an exercise by ID"""
        return await get_exercise_by_id(session, exercise_id)

    @staticmethod
    async def get_workout_exercises(
        session: AsyncSession, workout_id: int
    ) -> List[Exercise]:
        """Get all exercises for a specific workout"""
        return await get_exercises_for_workout(session, workout_id)

    @staticmethod
    async def create_new_exercise(
        session: AsyncSession, exercise_data: ExerciseCreate
    ) -> Exercise:
        """Create a new exercise with business logic validation"""
        # Add any business logic here (e.g., validation, authorization)
        return await create_exercise(session, exercise_data)

    @staticmethod
    async def remove_exercise(
        session: AsyncSession, exercise_id: int, user_id: int
    ) -> bool:
        """Soft delete an exercise with ownership verification.

        Idempotent behavior:
        - If the exercise doesn't exist or is already soft-deleted, return True (no-op).
        - If the exercise exists but isn't owned by the user, raise 403.
        - Otherwise, perform soft delete and return True.
        """
        # Ownership lookup without loading full entity
        owner_id = await get_exercise_owner_id(session, exercise_id)

        # Not found => idempotent success (no-op)
        if owner_id is None:
            return True

        # Exists but not owned => forbidden
        if owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed to delete this exercise",
            )

        # Idempotent soft delete via guarded bulk updates
        now = datetime.now(timezone.utc)

        await session.execute(
            update(Exercise)
            .where(Exercise.id == exercise_id, Exercise.deleted_at.is_(None))
            .values(deleted_at=now)
        )

        await session.execute(
            update(ExerciseSet)
            .where(
                ExerciseSet.exercise_id == exercise_id, ExerciseSet.deleted_at.is_(None)
            )
            .values(deleted_at=now)
        )

        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise

        return True


class ExerciseTypeService:
    """Service layer for exercise type business logic"""

    @staticmethod
    async def get_all_exercise_types(
        session: AsyncSession,
        name: Optional[str] = None,
        order_by: str = "usage",
        offset: int = 0,
        limit: int = 100,
    ) -> PaginatedExerciseTypesResponse:
        """Get all exercise types with optional filtering, ordering and pagination"""
        return await get_exercise_types(session, name, order_by, offset, limit)

    @staticmethod
    async def get_exercise_type(
        session: AsyncSession, exercise_type_id: int
    ) -> Optional[ExerciseType]:
        """Get an exercise type by ID"""
        return await get_exercise_type_by_id(session, exercise_type_id)

    @staticmethod
    async def get_exercise_type_statistics(
        session: AsyncSession, exercise_type_id: int, user_id: int
    ) -> Dict[str, Any]:
        """Get exercise type statistics including progressive overload data"""
        return await get_exercise_type_stats(session, exercise_type_id, user_id)

    @staticmethod
    async def create_new_exercise_type(
        session: AsyncSession, exercise_type_data: ExerciseTypeCreate
    ) -> ExerciseType:
        """Create a new exercise type with business logic validation"""
        try:
            return await create_exercise_type(session, exercise_type_data)
        except IntegrityError as e:
            # Handle database constraints
            if hasattr(e.orig, "pgcode") and e.orig.pgcode == "23505":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Exercise type with name '{exercise_type_data.name}' already exists",
                ) from e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create exercise type due to database constraint",
            ) from e
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


class IntensityUnitService:
    """Service layer for intensity unit business logic"""

    @staticmethod
    async def get_all_intensity_units(session: AsyncSession) -> List[IntensityUnit]:
        """Get all intensity units"""
        return await get_intensity_units(session)
