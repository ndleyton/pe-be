from typing import List, Optional
from fastapi import Depends, APIRouter, status, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercises.schemas import (
    ExerciseRead,
    ExerciseCreate,
    ExerciseTypeRead,
    ExerciseTypeCreate,
    IntensityUnitRead,
    ExerciseTypeStats,
    PaginatedExerciseTypesResponse,
)
from src.exercises.service import (
    ExerciseService,
    ExerciseTypeService,
    IntensityUnitService,
)
from src.core.database import get_async_session
from src.users.router import current_active_user
from src.users.models import User

router = APIRouter(tags=["exercises"])


# Exercise endpoints
@router.post("/", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    exercise_in: ExerciseCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new exercise"""
    return await ExerciseService.create_new_exercise(session, exercise_in)


# Alias without trailing slash to avoid 307 redirect issues on some clients/browsers
@router.post("", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_exercise_no_trailing_slash(
    exercise_in: ExerciseCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new exercise (no trailing slash alias)."""
    return await ExerciseService.create_new_exercise(session, exercise_in)


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Soft delete an exercise (sets deleted_at timestamp)"""
    # Idempotent delete: 204 for missing or already-deleted; 403 for not-owned
    await ExerciseService.remove_exercise(session, exercise_id, user.id)


# Exercise Types endpoints
exercise_types_router = APIRouter(prefix="/exercise-types", tags=["exercise-types"])


@exercise_types_router.get("", response_model=PaginatedExerciseTypesResponse)
async def get_exercise_types(
    name: Optional[str] = Query(
        default=None,
        description="Search for exercise types by name (case-insensitive)",
    ),
    order_by: Optional[str] = Query(
        default="usage",
        description="Sort order: 'usage' for usage-based sort, 'name' for alphabetical",
    ),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=1000),
    session: AsyncSession = Depends(get_async_session),
):
    """Get all exercise types from the database with pagination."""
    return await ExerciseTypeService.get_all_exercise_types(
        session, name, order_by, offset, limit
    )


@exercise_types_router.get("/{exercise_type_id}", response_model=ExerciseTypeRead)
async def get_exercise_type(
    exercise_type_id: int, session: AsyncSession = Depends(get_async_session)
):
    """Get an exercise type by ID."""
    exercise_type = await ExerciseTypeService.get_exercise_type(
        session, exercise_type_id
    )
    if not exercise_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise type with ID {exercise_type_id} not found",
        )
    return exercise_type


@exercise_types_router.get(
    "/{exercise_type_id}/stats", response_model=ExerciseTypeStats
)
async def get_exercise_type_stats(
    exercise_type_id: int, session: AsyncSession = Depends(get_async_session)
):
    """Get exercise type statistics including progressive overload data."""
    # First check if exercise type exists
    exercise_type = await ExerciseTypeService.get_exercise_type(
        session, exercise_type_id
    )
    if not exercise_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise type with ID {exercise_type_id} not found",
        )

    return await ExerciseTypeService.get_exercise_type_statistics(
        session, exercise_type_id
    )


@exercise_types_router.post(
    "", response_model=ExerciseTypeRead, status_code=status.HTTP_201_CREATED
)
async def create_exercise_type(
    exercise_type: ExerciseTypeCreate,
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new exercise type."""
    return await ExerciseTypeService.create_new_exercise_type(session, exercise_type)


# Intensity Units endpoints
intensity_units_router = APIRouter(prefix="/intensity-units", tags=["intensity-units"])


@intensity_units_router.get("", response_model=List[IntensityUnitRead])
async def get_intensity_units(session: AsyncSession = Depends(get_async_session)):
    """Get all intensity units"""
    return await IntensityUnitService.get_all_intensity_units(session)


# Include sub-routers
router.include_router(exercise_types_router)
router.include_router(intensity_units_router)
