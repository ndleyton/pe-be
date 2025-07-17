from typing import List, Optional
from fastapi import Depends, APIRouter, status, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.workouts.schemas import (
    WorkoutRead,
    WorkoutCreate,
    WorkoutUpdate,
    WorkoutTypeRead,
    WorkoutTypeCreate,
    WorkoutParseRequest,
    WorkoutParseResponse,
    AddExerciseRequest,
    PaginatedWorkouts,
)
from src.workouts.service import (
    WorkoutService,
    WorkoutTypeService,
    WorkoutParsingService,
)
from src.core.database import get_async_session
from src.users.router import current_active_user
from src.users.models import User
from src.exercises.service import ExerciseService
from src.exercises.schemas import ExerciseRead

router = APIRouter(tags=["workouts"])


# ----- Collection routes -----


@router.get("/mine", response_model=PaginatedWorkouts)
async def get_my_workouts(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
    cursor: Optional[int] = Query(
        default=None, description="ID cursor for keyset pagination"
    ),
    limit: int = Query(default=100, le=1000),
):
    """Get all workouts for the current user"""
    workouts = await WorkoutService.get_my_workouts(session, user.id, limit, cursor)

    next_cursor = (
        workouts[-1].id if len(workouts) == limit and len(workouts) > 0 else None
    )
    return {"data": workouts, "next_cursor": next_cursor}


@router.post("/", response_model=WorkoutRead, status_code=status.HTTP_201_CREATED)
async def create_workout(
    workout_in: WorkoutCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new workout"""
    return await WorkoutService.create_new_workout(session, workout_in, user.id)


@router.post("/parse", response_model=WorkoutParseResponse)
async def parse_workout_text(
    parse_request: WorkoutParseRequest,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Parse raw workout text using LLM"""
    try:
        return await WorkoutParsingService.parse_workout_text(
            parse_request.workout_text
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=500, detail="Internal server error while parsing workout"
        )


# ----- Workout types sub-router -----

workout_types_router = APIRouter(prefix="/workout-types", tags=["workout-types"])


@workout_types_router.get("", response_model=List[WorkoutTypeRead])
async def get_workout_types(session: AsyncSession = Depends(get_async_session)):
    """Get all workout types"""
    return await WorkoutTypeService.get_all_workout_types(session)


@workout_types_router.post(
    "", response_model=WorkoutTypeRead, status_code=status.HTTP_201_CREATED
)
async def create_workout_type(
    workout_type_in: WorkoutTypeCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new workout type"""
    return await WorkoutTypeService.create_new_workout_type(session, workout_type_in)


# Include the sub-router early to avoid path conflicts with parameterized routes
router.include_router(workout_types_router)

# ----- Add Exercise to Current Workout -----


@router.post(
    "/add-exercise", response_model=WorkoutRead, status_code=status.HTTP_201_CREATED
)
async def add_exercise_to_current_workout(
    request_body: AddExerciseRequest,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Add an exercise (and optional initial set) to the user's current workout.

    If the user does not yet have a workout for today, one will be created automatically.
    """
    workout = await WorkoutService.add_exercise_to_current_workout(
        session, user.id, request_body
    )
    return workout


# ----- Item routes -----


@router.get("/{workout_id}", response_model=WorkoutRead)
async def get_workout(
    workout_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get a single workout by ID for the current user"""
    workout = await WorkoutService.get_workout(session, workout_id, user.id)
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


@router.patch("/{workout_id}", response_model=WorkoutRead)
async def update_workout(
    workout_id: int,
    workout_update: WorkoutUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Update a workout"""
    workout = await WorkoutService.update_workout_data(
        session, workout_id, workout_update, user.id
    )
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout(
    workout_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Delete a workout"""
    success = await WorkoutService.remove_workout(session, workout_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Workout not found")


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
