import logging
from typing import List, Optional
from fastapi import (
    Depends,
    APIRouter,
    status,
    HTTPException,
    Query,
    Request,
    File,
    UploadFile,
)
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache_metrics import record_cache_request
from src.core.config import settings
from src.core.rate_limit import RateLimitExceededError, rate_limiter
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
    SaveWorkoutAsRoutineRequest,
    WorkoutPhotoUploadResponse,
)
from src.workouts.photo_service import WorkoutPhotoService
from src.workouts.service import (
    WorkoutService,
    WorkoutTypeService,
)
from src.core.database import get_async_session
from src.routines.schemas import RoutineRead
from src.routines.service import routine_service
from src.users.router import current_active_user
from src.users.models import User
from src.exercises.service import ExerciseService
from src.exercises.schemas import ExerciseRead

router = APIRouter(tags=["workouts"])
WORKOUT_TYPES_CACHE_TAG = "workout-types"
UPLOAD_READ_CHUNK_BYTES = 1024 * 1024
logger = logging.getLogger(__name__)


async def _read_upload_file_limited(file: UploadFile, *, max_bytes: int) -> bytes:
    data = bytearray()
    while True:
        remaining = max_bytes - len(data)
        read_size = min(UPLOAD_READ_CHUNK_BYTES, max(remaining + 1, 1))
        chunk = await file.read(read_size)
        if not chunk:
            break
        if len(data) + len(chunk) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image upload exceeds maximum size of {max_bytes} bytes",
            )
        data.extend(chunk)
    return bytes(data)


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
        record_cache_request("workout_types", decision="hit", key=cache_key)
        return build_cached_json_response(
            request,
            body=cached_response.body,
            etag=cached_response.etag,
            cache_control=cache_control,
            extra_headers={"X-Cache-Status": "HIT"},
        )
    record_cache_request("workout_types", decision="miss", key=cache_key)

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
        extra_headers={"X-Cache-Status": "MISS"},
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


@router.post("/{workout_id}/photo", response_model=WorkoutPhotoUploadResponse)
async def upload_workout_photo(
    workout_id: int,
    file: UploadFile = File(...),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await rate_limiter.check(
            scope="workout-photo",
            key=str(user.id),
            limit=settings.WORKOUT_PHOTO_RATE_LIMIT_MAX_REQUESTS,
            window_seconds=settings.WORKOUT_PHOTO_RATE_LIMIT_WINDOW_SECONDS,
        )
        photo_service = WorkoutPhotoService(user_id=user.id, session=session)
        photo = await photo_service.save_uploaded_photo(
            workout_id=workout_id,
            filename=file.filename or "upload",
            content_type=file.content_type or "",
            data=await _read_upload_file_limited(
                file,
                max_bytes=settings.WORKOUT_PHOTO_MAX_BYTES,
            ),
        )
        return WorkoutPhotoUploadResponse.model_validate(photo)
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=429,
            detail="Too many workout photo uploads. Please slow down.",
            headers={"Retry-After": str(exc.retry_after_seconds)},
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Workout photo upload failed user_id=%s workout_id=%s",
            user.id,
            workout_id,
        )
        raise HTTPException(
            status_code=500, detail="Failed to upload workout photo"
        ) from exc


@router.get("/{workout_id}/photo/file")
async def get_workout_photo_file(
    workout_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        photo_service = WorkoutPhotoService(user_id=user.id, session=session)
        photo = await photo_service.get_primary_photo(workout_id)
        file_path = photo_service.photo_file_path(photo.storage_key)
        if not file_path.is_file():
            raise HTTPException(status_code=404, detail="Workout photo file not found")

        return FileResponse(
            path=file_path,
            media_type=photo.mime_type,
            headers={
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Workout photo download failed user_id=%s workout_id=%s",
            user.id,
            workout_id,
        )
        raise HTTPException(
            status_code=500, detail="Failed to load workout photo"
        ) from exc


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


@router.post(
    "/{workout_id}/save-as-routine",
    response_model=RoutineRead,
    status_code=status.HTTP_201_CREATED,
)
async def save_public_workout_as_routine(
    workout_id: int,
    save_request: SaveWorkoutAsRoutineRequest | None = None,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Clone a public completed workout into a new private routine."""
    try:
        return await routine_service.clone_public_workout_to_private_routine(
            session,
            source_workout_id=workout_id,
            user_id=user.id,
            clone_request=save_request,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
