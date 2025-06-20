from typing import List, Optional
from fastapi import Depends, APIRouter, status, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercises.schemas import (
    ExerciseRead,
    ExerciseCreate,
    ExerciseTypeRead,
    ExerciseTypeCreate,
    IntensityUnitRead
)
from src.exercises.service import ExerciseService, ExerciseTypeService, IntensityUnitService
from src.core.database import get_async_session
from src.users.router import current_active_user
from src.users.models import User

router = APIRouter(tags=["exercises"])

# Exercise endpoints
@router.post("/", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    exercise_in: ExerciseCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Create a new exercise"""
    return await ExerciseService.create_new_exercise(session, exercise_in)

# Exercise Types endpoints
exercise_types_router = APIRouter(prefix="/exercise-types", tags=["exercise-types"])

@exercise_types_router.get("", response_model=List[ExerciseTypeRead])
async def get_exercise_types(
    order_by: Optional[str] = Query(
        default="usage", 
        description="Sort order: 'usage' for usage-based sort, 'name' for alphabetical"
    ),
    session: AsyncSession = Depends(get_async_session)
):
    """Get all exercise types from the database."""
    return await ExerciseTypeService.get_all_exercise_types(session, order_by)

@exercise_types_router.post("", response_model=ExerciseTypeRead, status_code=status.HTTP_201_CREATED)
async def create_exercise_type(
    exercise_type: ExerciseTypeCreate,
    session: AsyncSession = Depends(get_async_session)
):
    """Create a new exercise type."""
    return await ExerciseTypeService.create_new_exercise_type(session, exercise_type)

# Intensity Units endpoints
intensity_units_router = APIRouter(prefix="/intensity-units", tags=["intensity-units"])

@intensity_units_router.get("", response_model=List[IntensityUnitRead])
async def get_intensity_units(
    session: AsyncSession = Depends(get_async_session)
):
    """Get all intensity units"""
    return await IntensityUnitService.get_all_intensity_units(session)

# Include sub-routers
router.include_router(exercise_types_router)
router.include_router(intensity_units_router) 