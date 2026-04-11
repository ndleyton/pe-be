import re
from typing import List, Optional
from fastapi import Depends, APIRouter, status, Query, HTTPException, Request
from fastapi.responses import FileResponse
from opentelemetry import trace
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache_tags import (
    EXERCISE_PUBLIC_CACHE_TAG,
    EXERCISE_TAXONOMY_CACHE_TAG,
)
from src.core.cache_metrics import record_cache_request
from src.core.config import settings
from src.core.http_cache import (
    build_cached_json_response,
    render_json_bytes,
    response_cache,
)
from src.core.observability import (
    traced_model_dump,
    traced_model_dump_many,
    traced_model_validate_many,
)
from src.exercises.image_assets import storage_path_for_relative_url
from src.exercises.schemas import (
    ExerciseRead,
    ExerciseCreate,
    ExerciseTypeRead,
    ExerciseTypeCreate,
    ExerciseTypeUpdate,
    IntensityUnitRead,
    MuscleRead,
    MuscleGroupRead,
    ExerciseTypeStats,
    PaginatedExerciseTypesResponse,
)
from src.exercises.service import (
    ExerciseService,
    ExerciseTypeService,
    IntensityUnitService,
    MuscleService,
    MuscleGroupService,
)
from src.core.database import get_async_session
from src.users.router import current_active_user, current_optional_user
from src.users.models import User

router = APIRouter(tags=["exercises"])
tracer = trace.get_tracer(__name__)
assets_router = APIRouter(prefix="/assets", tags=["exercise-image-assets"])


def _exercise_types_cache_key(
    *,
    order_by: str,
    offset: int,
    limit: int,
    muscle_group_id: int | None,
    released_only: bool,
    is_anonymous: bool,
) -> str:
    return (
        "exercise-types:"
        f"scope={'released' if released_only or is_anonymous else 'user'}:"
        f"order_by={order_by}:offset={offset}:limit={limit}:"
        f"muscle_group_id={muscle_group_id if muscle_group_id is not None else 'none'}"
    )


def _exercise_types_cache_ttl(order_by: str) -> int:
    if order_by == "name":
        return settings.EXERCISE_TYPES_NAME_CACHE_TTL_SECONDS
    return settings.EXERCISE_TYPES_USAGE_CACHE_TTL_SECONDS


def _exercise_types_cache_headers(
    *,
    released_only: bool,
    is_anonymous: bool,
    order_by: str,
) -> tuple[str, str | None]:
    max_age = _exercise_types_cache_ttl(order_by)
    stale_while_revalidate = max_age * 2
    if released_only:
        return (
            "public, "
            f"max-age={max_age}, stale-while-revalidate={stale_while_revalidate}",
            None,
        )
    if is_anonymous:
        return (
            "private, "
            f"max-age={max_age}, stale-while-revalidate={stale_while_revalidate}",
            "Cookie",
        )
    return ("private, no-store", "Cookie")


def _annotate_cache(route_name: str, *, decision: str, key: str | None) -> None:
    record_cache_request(route_name, decision=decision, key=key)


# Exercise endpoints
@assets_router.get("/{image_path:path}")
async def get_exercise_image_asset(
    image_path: str,
    user: User | None = Depends(current_optional_user),
    session: AsyncSession = Depends(get_async_session),
):
    if image_path.startswith("generated/") and user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for generated exercise images",
        )

    generated_match = re.match(r"^generated/exercise-type-(\d+)/", image_path)
    if generated_match and user is not None:
        exercise_type = await ExerciseTypeService.get_exercise_type(
            session,
            int(generated_match.group(1)),
            user=user,
        )
        if exercise_type is None:
            raise HTTPException(status_code=404, detail="Exercise image not found")

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
    return await ExerciseService.create_new_exercise(
        session,
        exercise_in,
        user_id=user.id,
        is_admin=bool(user.is_superuser),
    )


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
muscles_router = APIRouter(prefix="/muscles", tags=["muscles"])
muscle_groups_router = APIRouter(prefix="/muscle-groups", tags=["muscle-groups"])


@exercise_types_router.get("/", response_model=PaginatedExerciseTypesResponse)
async def get_exercise_types(
    request: Request,
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
    released_only: bool = Query(
        default=False,
        description="Restrict results to released exercise types only",
    ),
    user: User | None = Depends(current_optional_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get all exercise types from the database with pagination."""
    is_anonymous = user is None
    cacheable = name is None and (released_only or is_anonymous)
    cache_control, vary = _exercise_types_cache_headers(
        released_only=released_only,
        is_anonymous=is_anonymous,
        order_by=order_by or "usage",
    )

    if cacheable:
        cache_key = _exercise_types_cache_key(
            order_by=order_by or "usage",
            offset=offset,
            limit=limit,
            muscle_group_id=muscle_group_id,
            released_only=released_only,
            is_anonymous=is_anonymous,
        )
        cached_response = await response_cache.get(cache_key)
        if cached_response is not None:
            _annotate_cache("exercise_types", decision="hit", key=cache_key)
            return build_cached_json_response(
                request,
                body=cached_response.body,
                etag=cached_response.etag,
                cache_control=cache_control,
                vary=vary,
                extra_headers={"X-Cache-Status": "HIT"},
            )
        _annotate_cache("exercise_types", decision="miss", key=cache_key)
    else:
        _annotate_cache("exercise_types", decision="bypass", key=None)

    response_model = await ExerciseTypeService.get_all_exercise_types(
        session,
        name,
        muscle_group_id,
        order_by,
        offset,
        limit,
        user=user,
        released_only=released_only,
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
    response_body = render_json_bytes(response_payload)

    if cacheable:
        cached_response = await response_cache.set(
            cache_key,
            body=response_body,
            ttl_seconds=_exercise_types_cache_ttl(order_by or "usage"),
            tags=(EXERCISE_PUBLIC_CACHE_TAG,),
        )
        return build_cached_json_response(
            request,
            body=cached_response.body,
            etag=cached_response.etag,
            cache_control=cache_control,
            vary=vary,
            extra_headers={"X-Cache-Status": "MISS"},
        )

    return build_cached_json_response(
        request,
        body=response_body,
        etag=None,
        cache_control=cache_control,
        vary=vary,
        extra_headers={"X-Cache-Status": "BYPASS"},
    )


@exercise_types_router.get("/{exercise_type_id}", response_model=ExerciseTypeRead)
async def get_exercise_type(
    exercise_type_id: int,
    user: User | None = Depends(current_optional_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get an exercise type by ID."""
    with tracer.start_as_current_span("exercise_types.fetch"):
        exercise_type = await ExerciseTypeService.get_exercise_type(
            session,
            exercise_type_id,
            user=user,
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
        session,
        exercise_type_id,
        user=user,
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
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new exercise type."""
    created_exercise_type = await ExerciseTypeService.create_new_exercise_type(
        session,
        exercise_type,
        user_id=user.id,
    )
    await response_cache.invalidate_tags(EXERCISE_PUBLIC_CACHE_TAG)
    return created_exercise_type


@exercise_types_router.patch("/{exercise_type_id}", response_model=ExerciseTypeRead)
async def update_exercise_type(
    exercise_type_id: int,
    exercise_type: ExerciseTypeUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Update an exercise type."""
    updated_exercise_type = await ExerciseTypeService.update_existing_exercise_type(
        session,
        exercise_type_id,
        exercise_type,
        user=user,
    )
    await response_cache.invalidate_tags(EXERCISE_PUBLIC_CACHE_TAG)
    return updated_exercise_type


@exercise_types_router.post(
    "/{exercise_type_id}/request-evaluation",
    response_model=ExerciseTypeRead,
)
async def request_exercise_type_evaluation(
    exercise_type_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Move an owned exercise type into the admin review queue."""
    updated_exercise_type = await ExerciseTypeService.request_evaluation(
        session,
        exercise_type_id,
        user=user,
    )
    await response_cache.invalidate_tags(EXERCISE_PUBLIC_CACHE_TAG)
    return updated_exercise_type


@muscle_groups_router.get("/", response_model=List[MuscleGroupRead])
async def get_muscle_groups(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """Get all muscle groups."""
    cache_key = "muscle-groups"
    cache_control = f"public, max-age={settings.TAXONOMY_CACHE_TTL_SECONDS}"
    cached_response = await response_cache.get(cache_key)
    if cached_response is not None:
        _annotate_cache("muscle_groups", decision="hit", key=cache_key)
        return build_cached_json_response(
            request,
            body=cached_response.body,
            etag=cached_response.etag,
            cache_control=cache_control,
            extra_headers={"X-Cache-Status": "HIT"},
        )
    _annotate_cache("muscle_groups", decision="miss", key=cache_key)

    muscle_groups = await MuscleGroupService.get_all_muscle_groups(session)
    response_models = traced_model_validate_many(
        MuscleGroupRead,
        muscle_groups,
        span_name="exercises.get_muscle_groups.response_model_validate",
        attributes={"serialization.item_count": len(muscle_groups)},
    )
    response_payload = traced_model_dump_many(
        response_models,
        span_name="exercises.get_muscle_groups.response_model_dump",
        attributes={"serialization.item_count": len(response_models)},
    )
    cached_response = await response_cache.set(
        cache_key,
        body=render_json_bytes(response_payload),
        ttl_seconds=settings.TAXONOMY_CACHE_TTL_SECONDS,
        tags=(EXERCISE_TAXONOMY_CACHE_TAG,),
    )
    return build_cached_json_response(
        request,
        body=cached_response.body,
        etag=cached_response.etag,
        cache_control=cache_control,
        extra_headers={"X-Cache-Status": "MISS"},
    )


@muscles_router.get("/", response_model=List[MuscleRead])
async def get_muscles(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """Get all muscles."""
    cache_key = "muscles"
    cache_control = f"public, max-age={settings.TAXONOMY_CACHE_TTL_SECONDS}"
    cached_response = await response_cache.get(cache_key)
    if cached_response is not None:
        _annotate_cache("muscles", decision="hit", key=cache_key)
        return build_cached_json_response(
            request,
            body=cached_response.body,
            etag=cached_response.etag,
            cache_control=cache_control,
            extra_headers={"X-Cache-Status": "HIT"},
        )
    _annotate_cache("muscles", decision="miss", key=cache_key)

    muscles = await MuscleService.get_all_muscles(session)
    response_models = traced_model_validate_many(
        MuscleRead,
        muscles,
        span_name="exercises.get_muscles.response_model_validate",
        attributes={"serialization.item_count": len(muscles)},
    )
    response_payload = traced_model_dump_many(
        response_models,
        span_name="exercises.get_muscles.response_model_dump",
        attributes={"serialization.item_count": len(response_models)},
    )
    cached_response = await response_cache.set(
        cache_key,
        body=render_json_bytes(response_payload),
        ttl_seconds=settings.TAXONOMY_CACHE_TTL_SECONDS,
        tags=(EXERCISE_TAXONOMY_CACHE_TAG,),
    )
    return build_cached_json_response(
        request,
        body=cached_response.body,
        etag=cached_response.etag,
        cache_control=cache_control,
        extra_headers={"X-Cache-Status": "MISS"},
    )


# Intensity Units endpoints
intensity_units_router = APIRouter(prefix="/intensity-units", tags=["intensity-units"])


@intensity_units_router.get("/", response_model=List[IntensityUnitRead])
async def get_intensity_units(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """Get all intensity units"""
    cache_key = "intensity-units"
    cache_control = f"public, max-age={settings.TAXONOMY_CACHE_TTL_SECONDS}"
    cached_response = await response_cache.get(cache_key)
    if cached_response is not None:
        _annotate_cache("intensity_units", decision="hit", key=cache_key)
        return build_cached_json_response(
            request,
            body=cached_response.body,
            etag=cached_response.etag,
            cache_control=cache_control,
            extra_headers={"X-Cache-Status": "HIT"},
        )
    _annotate_cache("intensity_units", decision="miss", key=cache_key)

    intensity_units = await IntensityUnitService.get_all_intensity_units(session)
    response_models = traced_model_validate_many(
        IntensityUnitRead,
        intensity_units,
        span_name="exercises.get_intensity_units.response_model_validate",
        attributes={"serialization.item_count": len(intensity_units)},
    )
    response_payload = traced_model_dump_many(
        response_models,
        span_name="exercises.get_intensity_units.response_model_dump",
        attributes={"serialization.item_count": len(response_models)},
    )
    cached_response = await response_cache.set(
        cache_key,
        body=render_json_bytes(response_payload),
        ttl_seconds=settings.TAXONOMY_CACHE_TTL_SECONDS,
        tags=(EXERCISE_TAXONOMY_CACHE_TAG,),
    )
    return build_cached_json_response(
        request,
        body=cached_response.body,
        etag=cached_response.etag,
        cache_control=cache_control,
        extra_headers={"X-Cache-Status": "MISS"},
    )


# Include sub-routers
router.include_router(assets_router)
router.include_router(exercise_types_router)
router.include_router(muscles_router)
router.include_router(intensity_units_router)
router.include_router(muscle_groups_router)
