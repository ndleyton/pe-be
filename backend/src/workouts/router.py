from typing import List
from fastapi import Depends, APIRouter, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.workouts.models import Workout
from src.workouts.schemas import WorkoutRead, WorkoutCreate, WorkoutUpdate, WorkoutTypeRead, WorkoutTypeCreate
from src.workouts.service import WorkoutService, WorkoutTypeService
from src.core.database import get_async_session
from src.users.router import current_active_user
from src.users.models import User

router = APIRouter(tags=["workouts"])


@router.post("/", response_model=WorkoutRead, status_code=status.HTTP_201_CREATED)
async def create_workout(
    workout_in: WorkoutCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Create a new workout"""
    return await WorkoutService.create_new_workout(session, workout_in, user.id)


@router.get("/mine", response_model=List[WorkoutRead])
async def get_my_workouts(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Get all workouts for the current user"""
    return await WorkoutService.get_my_workouts(session, user.id)


@router.patch("/{workout_id}", response_model=WorkoutRead)
async def update_workout(
    workout_id: int,
    workout_update: WorkoutUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Update a workout"""
    workout = await WorkoutService.update_workout_data(session, workout_id, workout_update, user.id)
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout(
    workout_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Delete a workout"""
    success = await WorkoutService.remove_workout(session, workout_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Workout not found")


# Workout Types endpoints
workout_types_router = APIRouter(prefix="/workout-types", tags=["workout-types"])


@workout_types_router.get("", response_model=List[WorkoutTypeRead])
async def get_workout_types(
    session: AsyncSession = Depends(get_async_session)
):
    """Get all workout types"""
    return await WorkoutTypeService.get_all_workout_types(session)


@workout_types_router.post("", response_model=WorkoutTypeRead, status_code=status.HTTP_201_CREATED)
async def create_workout_type(
    workout_type_in: WorkoutTypeCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Create a new workout type"""
    return await WorkoutTypeService.create_new_workout_type(session, workout_type_in)

# Include workout types router in main router
router.include_router(workout_types_router)

# Add nested resource route for exercises in workouts
from src.exercises.service import ExerciseService
from src.exercises.schemas import ExerciseRead

@router.get("/{workout_id}/exercises", response_model=List[ExerciseRead])
async def get_exercises_in_workout(
    workout_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return exercises for the requested workout

    First verify the workout exists and belongs to the user. Then return
    its exercises (even if empty list) to handle new workouts properly.
    """
    # First verify workout exists and belongs to user
    workout = await WorkoutService.get_workout(session, workout_id, user.id)
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    # Get exercises for this workout
    return await ExerciseService.get_workout_exercises(session, workout_id) 