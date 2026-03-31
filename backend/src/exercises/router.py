from typing import List, Optional
from fastapi import Depends, APIRouter, status, Query, HTTPException
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from opentelemetry import trace
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.observability import traced_model_dump
from src.exercises.image_assets import storage_path_for_relative_url
from src.exercises.schemas import (
    ExerciseRead,
    ExerciseCreate,
    ExerciseTypeRead,
    ExerciseTypeCreate,
    IntensityUnitRead,
    MuscleGroupRead,
    ExerciseTypeStats,
    PaginatedExerciseTypesResponse,
)
from src.exercises.service import (
    ExerciseService,
    ExerciseTypeService,
    IntensityUnitService,
    MuscleGroupService,
)
from src.core.database import get_async_session
from src.users.router import current_active_user, current_optional_user
from src.users.models import User

router = APIRouter(tags=["exercises"])
tracer = trace.get_tracer(__name__)
assets_router = APIRouter(prefix="/assets", tags=["exercise-image-assets"])


# Exercise endpoints
@assets_router.get("/{image_path:path}")
async def get_exercise_image_asset(
    image_path: str,
    user: User | None = Depends(current_optional_user),
):
    if image_path.startswith("generated/") and user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for generated exercise images",
        )

    try:
        file_path = storage_path_for_relative_url(image_path)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Exercise image not found") from exc

    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Exercise image not found")

    return FileResponse(path=file_path)


@router.post("/", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    exercise_in: ExerciseCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new exercise"""
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
muscle_groups_router = APIRouter(prefix="/muscle-groups", tags=["muscle-groups"])


@exercise_types_router.get("/", response_model=PaginatedExerciseTypesResponse)
async def get_exercise_types(
    name: Optional[str] = Query(
        default=None,
        description="Search for exercise types by name (case-insensitive)",
    ),
    muscle_group_id: Optional[int] = Query(
        default=None,
        ge=1,
        description="Filter exercise types by muscle group ID",
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
    response_model = await ExerciseTypeService.get_all_exercise_types(
        session, name, muscle_group_id, order_by, offset, limit
    )
    response_payload = traced_model_dump(
        response_model,
        span_name="exercises.get_exercise_types.response_model_dump",
        attributes={
            "query.offset": offset,
            "query.limit": limit,
            "query.has_name_filter": name is not None,
            "query.has_muscle_group_filter": muscle_group_id is not None,
            "query.order_by": order_by,
            "serialization.item_count": len(response_model.data),
        },
    )
    return JSONResponse(content=response_payload)


@exercise_types_router.get("/{exercise_type_id}", response_model=ExerciseTypeRead)
async def get_exercise_type(
    exercise_type_id: int, session: AsyncSession = Depends(get_async_session)
):
    """Get an exercise type by ID."""
    with tracer.start_as_current_span("exercise_types.fetch"):
        exercise_type = await ExerciseTypeService.get_exercise_type(
            session, exercise_type_id
        )
    if not exercise_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise type with ID {exercise_type_id} not found",
        )

    with tracer.start_as_current_span("exercise_types.serialize"):
        return ExerciseTypeRead.model_validate(exercise_type)


@exercise_types_router.get(
    "/{exercise_type_id}/stats", response_model=ExerciseTypeStats
)
async def get_exercise_type_stats(
    exercise_type_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
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
        session, exercise_type_id, user.id
    )


@exercise_types_router.post(
    "/", response_model=ExerciseTypeRead, status_code=status.HTTP_201_CREATED
)
async def create_exercise_type(
    exercise_type: ExerciseTypeCreate,
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new exercise type."""
    return await ExerciseTypeService.create_new_exercise_type(session, exercise_type)


@muscle_groups_router.get("/", response_model=List[MuscleGroupRead])
async def get_muscle_groups(session: AsyncSession = Depends(get_async_session)):
    """Get all muscle groups."""
    return await MuscleGroupService.get_all_muscle_groups(session)


# Intensity Units endpoints
intensity_units_router = APIRouter(prefix="/intensity-units", tags=["intensity-units"])


@intensity_units_router.get("/", response_model=List[IntensityUnitRead])
async def get_intensity_units(session: AsyncSession = Depends(get_async_session)):
    """Get all intensity units"""
    return await IntensityUnitService.get_all_intensity_units(session)


# Include sub-routers
router.include_router(assets_router)
router.include_router(exercise_types_router)
router.include_router(intensity_units_router)
router.include_router(muscle_groups_router)
