from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
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
)
from src.exercises.models import Exercise, ExerciseType, IntensityUnit
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
        session: AsyncSession, exercise_type_id: int
    ) -> Dict[str, Any]:
        """Get exercise type statistics including progressive overload data"""
        return await get_exercise_type_stats(session, exercise_type_id)

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
