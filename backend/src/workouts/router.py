from typing import List, Optional
from fastapi import Depends, APIRouter, status, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.http_cache import (
    build_cached_json_response,
    render_json_bytes,
    response_cache,
)
from src.core.observability import traced_model_dump_many, traced_model_validate_many
from src.workouts.schemas import (
    WorkoutRead,
    WorkoutCreate,
    WorkoutUpdate,
    WorkoutTypeRead,
    WorkoutTypeCreate,
    AddExerciseRequest,
    PaginatedWorkouts,
)
from src.workouts.service import (
    WorkoutService,
    WorkoutTypeService,
)
from src.core.database import get_async_session
from src.users.router import current_active_user
from src.users.models import User
from src.exercises.service import ExerciseService
from src.exercises.schemas import ExerciseRead

router = APIRouter(tags=["workouts"])
WORKOUT_TYPES_CACHE_TAG = "workout-types"


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


# ----- Workout types sub-router -----

workout_types_router = APIRouter(prefix="/workout-types", tags=["workout-types"])


@workout_types_router.get("/", response_model=List[WorkoutTypeRead])
async def get_workout_types(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """Get all workout types"""
    cache_key = "workout-types"
    cache_control = f"public, max-age={settings.TAXONOMY_CACHE_TTL_SECONDS}"
    cached_response = await response_cache.get(cache_key)
    if cached_response is not None:
        return build_cached_json_response(
            request,
            body=cached_response.body,
            etag=cached_response.etag,
            cache_control=cache_control,
        )

    workout_types = await WorkoutTypeService.get_all_workout_types(session)
    response_models = traced_model_validate_many(
        WorkoutTypeRead,
        workout_types,
        span_name="workouts.get_workout_types.response_model_validate",
        attributes={"serialization.item_count": len(workout_types)},
    )
    response_payload = traced_model_dump_many(
        response_models,
        span_name="workouts.get_workout_types.response_model_dump",
        attributes={"serialization.item_count": len(response_models)},
    )
    cached_response = await response_cache.set(
        cache_key,
        body=render_json_bytes(response_payload),
        ttl_seconds=settings.TAXONOMY_CACHE_TTL_SECONDS,
        tags=(WORKOUT_TYPES_CACHE_TAG,),
    )
    return build_cached_json_response(
        request,
        body=cached_response.body,
        etag=cached_response.etag,
        cache_control=cache_control,
    )


@workout_types_router.post(
    "/", response_model=WorkoutTypeRead, status_code=status.HTTP_201_CREATED
)
async def create_workout_type(
    workout_type_in: WorkoutTypeCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new workout type"""
    workout_type = await WorkoutTypeService.create_new_workout_type(
        session, workout_type_in
    )
    await response_cache.invalidate_tags(WORKOUT_TYPES_CACHE_TAG)
    return workout_type


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

    Reuses the user's latest unfinished workout if it was started within the last
    12 hours. Otherwise, creates a new workout automatically.
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
    # Idempotent delete: 204 whether missing or already deleted for this user
    await WorkoutService.remove_workout(session, workout_id, user.id)


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
    exercises = await ExerciseService.get_workout_exercises(session, workout_id)
    span_attributes = {"workout.id": workout_id, "user.id": user.id}
    response_models = traced_model_validate_many(
        ExerciseRead,
        exercises,
        span_name="workouts.get_workout_exercises.response_model_validate",
        attributes=span_attributes,
    )
    response_payload = traced_model_dump_many(
        response_models,
        span_name="workouts.get_workout_exercises.response_model_dump",
        attributes=span_attributes,
    )
    return JSONResponse(content=response_payload)


@router.post("/{workout_id}/recap", response_model=WorkoutRead)
async def generate_workout_recap(
    workout_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Generate and store an AI recap for the requested workout"""
    from src.workouts.recap import WorkoutRecapService

    recap = await WorkoutRecapService.generate_recap(session, workout_id, user.id)
    if recap is None:
        raise HTTPException(status_code=404, detail="Workout not found")

    return await WorkoutService.get_workout(session, workout_id, user.id)
