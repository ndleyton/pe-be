from typing import Optional, List, Dict, Any, TYPE_CHECKING
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
    get_muscle_groups,
    get_exercise_owner_id,
    get_exercise_type_review_queue,
    release_exercise_type,
    request_exercise_type_evaluation,
    update_exercise_type,
)
from src.exercises.models import Exercise, ExerciseType, IntensityUnit, MuscleGroup
from src.exercise_sets.models import ExerciseSet
from src.exercises.schemas import (
    ExerciseCreate,
    ExerciseTypeCreate,
    ExerciseTypeReleaseRequest,
    ExerciseTypeUpdate,
    PaginatedExerciseTypesResponse,
)

if TYPE_CHECKING:
    from src.users.models import User


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
        session: AsyncSession,
        exercise_data: ExerciseCreate,
        *,
        user_id: Optional[int] = None,
        is_admin: bool = False,
    ) -> Exercise:
        """Create a new exercise with business logic validation"""
        kwargs = {}
        if user_id is not None:
            kwargs["user_id"] = user_id
            kwargs["is_admin"] = is_admin
        return await create_exercise(session, exercise_data, **kwargs)

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
        muscle_group_id: Optional[int] = None,
        order_by: str = "usage",
        offset: int = 0,
        limit: int = 100,
        *,
        user: Optional["User"] = None,
        released_only: bool = False,
    ) -> PaginatedExerciseTypesResponse:
        """Get all exercise types with optional filtering, ordering and pagination"""
        kwargs = {}
        if user is not None:
            kwargs["user_id"] = user.id
            kwargs["is_admin"] = bool(getattr(user, "is_superuser", False))
        if released_only:
            kwargs["released_only"] = True
        return await get_exercise_types(
            session,
            name,
            muscle_group_id,
            order_by,
            offset,
            limit,
            **kwargs,
        )

    @staticmethod
    async def get_exercise_type(
        session: AsyncSession,
        exercise_type_id: int,
        *,
        user: Optional["User"] = None,
        released_only: bool = False,
    ) -> Optional[ExerciseType]:
        """Get an exercise type by ID"""
        kwargs = {}
        if user is not None:
            kwargs["user_id"] = user.id
            kwargs["is_admin"] = bool(getattr(user, "is_superuser", False))
        if released_only:
            kwargs["released_only"] = True
        return await get_exercise_type_by_id(session, exercise_type_id, **kwargs)

    @staticmethod
    async def get_exercise_type_statistics(
        session: AsyncSession, exercise_type_id: int, user_id: int
    ) -> Dict[str, Any]:
        """Get exercise type statistics including progressive overload data"""
        return await get_exercise_type_stats(session, exercise_type_id, user_id)

    @staticmethod
    async def create_new_exercise_type(
        session: AsyncSession,
        exercise_type_data: ExerciseTypeCreate,
        *,
        user_id: Optional[int] = None,
    ) -> ExerciseType:
        """Create a new exercise type with business logic validation"""
        try:
            kwargs = {"owner_id": user_id} if user_id is not None else {}
            return await create_exercise_type(session, exercise_type_data, **kwargs)
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

    @staticmethod
    async def update_existing_exercise_type(
        session: AsyncSession,
        exercise_type_id: int,
        exercise_type_data: ExerciseTypeUpdate,
        *,
        user: "User",
    ) -> ExerciseType:
        exercise_type = await get_exercise_type_by_id(
            session,
            exercise_type_id,
            user_id=user.id,
            is_admin=bool(user.is_superuser),
        )
        if exercise_type is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exercise type with ID {exercise_type_id} not found",
            )

        if user.is_superuser:
            pass
        elif (
            exercise_type.owner_id != user.id
            or exercise_type.status == ExerciseType.ExerciseTypeStatus.released
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed to edit this exercise type",
            )

        try:
            return await update_exercise_type(session, exercise_type, exercise_type_data)
        except IntegrityError as e:
            if hasattr(e.orig, "pgcode") and e.orig.pgcode == "23505":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Exercise type with name '{exercise_type_data.name}' already exists",
                ) from e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update exercise type due to database constraint",
            ) from e
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    @staticmethod
    async def request_evaluation(
        session: AsyncSession,
        exercise_type_id: int,
        *,
        user: "User",
    ) -> ExerciseType:
        exercise_type = await get_exercise_type_by_id(
            session,
            exercise_type_id,
            user_id=user.id,
            is_admin=bool(user.is_superuser),
        )
        if exercise_type is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exercise type with ID {exercise_type_id} not found",
            )

        if exercise_type.owner_id != user.id or exercise_type.status == ExerciseType.ExerciseTypeStatus.released:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed to request evaluation for this exercise type",
            )

        return await request_exercise_type_evaluation(session, exercise_type)

    @staticmethod
    async def get_review_queue(session: AsyncSession) -> list[ExerciseType]:
        return await get_exercise_type_review_queue(session)

    @staticmethod
    async def release_existing_exercise_type(
        session: AsyncSession,
        exercise_type_id: int,
        *,
        reviewer_id: int,
        payload: Optional[ExerciseTypeReleaseRequest] = None,
    ) -> ExerciseType:
        exercise_type = await get_exercise_type_by_id(
            session,
            exercise_type_id,
            is_admin=True,
        )
        if exercise_type is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exercise type with ID {exercise_type_id} not found",
            )

        try:
            return await release_exercise_type(
                session,
                exercise_type,
                reviewer_id=reviewer_id,
                review_notes=payload.review_notes if payload else None,
            )
        except IntegrityError as e:
            if hasattr(e.orig, "pgcode") and e.orig.pgcode == "23505":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Exercise type with name '{exercise_type.name}' already exists",
                ) from e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to release exercise type due to database constraint",
            ) from e


class IntensityUnitService:
    """Service layer for intensity unit business logic"""

    @staticmethod
    async def get_all_intensity_units(session: AsyncSession) -> List[IntensityUnit]:
        """Get all intensity units"""
        return await get_intensity_units(session)


class MuscleGroupService:
    """Service layer for muscle-group lookup."""

    @staticmethod
    async def get_all_muscle_groups(session: AsyncSession) -> List[MuscleGroup]:
        """Get all muscle groups."""
        return await get_muscle_groups(session)
