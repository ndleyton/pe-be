"""
Admin endpoints for maintenance tasks
"""

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List
import logging

from src.core.config import settings
from google.genai import errors
from src.admin.exercise_image_service import (
    apply_reference_or_option,
    build_image_options_response,
    generate_reference_image_options,
)
from src.admin.schemas import (
    AdminApplyExerciseImageOptionRequest,
    AdminExerciseImageOptionsResponse,
)
from src.core.database import get_async_session
from src.users.router import current_active_user
from src.users.models import User
from src.exercises.service import ExerciseTypeService
from src.genai.google_images import (
    generate_exercise_phase_image,
)
from src.routines.schemas import RoutineRead, AdminRoutineCreate
from src.routines.service import routine_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


def _ensure_admin(user: User) -> None:
    if not getattr(user, "is_superuser", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")


@router.post("/import-exercises")
async def import_exercises() -> Dict[str, Any]:
    """
    Import exercises from ext.exercises table to main application tables.
    This is a one-time operation for production setup.
    """
    try:
        from src.importers.exercise_importer import (
            extract_and_transform_exercises,
            import_exercises_to_database,
        )

        # Extract and transform data
        data = await extract_and_transform_exercises()

        # Import to main tables
        await import_exercises_to_database(data)

        return {
            "status": "success",
            "message": "Exercise import completed successfully",
            "imported": {
                "exercise_types": len(data["exercise_types"]),
                "muscles": len(data["muscles"]),
                "muscle_groups": len(data["muscle_groups"]),
                "intensity_units": len(data["intensity_units"]),
                "exercise_muscles": len(data["exercise_muscles"]),
            },
        }
    except Exception as e:
        logger.exception("Exercise import failed: %s", e)
        raise HTTPException(status_code=500, detail="Import failed")


@router.get("/import-exercises/status")
async def import_status() -> Dict[str, Any]:
    """Check if exercises have been imported"""
    try:
        from src.core.database import async_session_maker
        from sqlalchemy import text

        async with async_session_maker() as session:
            # Check how many exercises with external_id exist
            try:
                result = await session.execute(
                    text(
                        "SELECT COUNT(*) FROM exercise_types WHERE external_id IS NOT NULL"
                    )
                )
                imported_count = result.scalar()
            except Exception:
                imported_count = 0

            # Check total in ext.exercises
            try:
                ext_result = await session.execute(
                    text("SELECT COUNT(*) FROM ext.exercises")
                )
                total_available = ext_result.scalar()
            except Exception:
                total_available = "Unknown (ext.exercises not found)"

            return {
                "imported_exercises": imported_count,
                "available_exercises": total_available,
                "import_needed": imported_count == 0,
                "status": "imported" if imported_count > 0 else "pending",
            }
    except Exception as e:
        logger.exception("Import status check failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve import status")


@router.post(
    "/exercise-types/{exercise_type_id}/generate-images",
    summary="Generate two simple images for an exercise type (eccentric/concentric)",
)
async def generate_exercise_type_images(
    exercise_type_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Admin-only: For a given exercise type, call Gemini to generate two
    simple instructional images: one for the starting/eccentric phase and
    one for the ending/concentric phase. Returns base64-encoded PNGs.

    Note: Persistence/storage will be handled in a follow-up.
    """
    _ensure_admin(user)

    # Ensure API key configured
    if not settings.GOOGLE_AI_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google AI API key not configured",
        )

    # Load exercise type with muscles
    exercise_type = await ExerciseTypeService.get_exercise_type(
        session, exercise_type_id
    )
    if not exercise_type:
        raise HTTPException(status_code=404, detail="Exercise type not found")

    # Collect muscles by primary/secondary
    primary_muscles: List[str] = []
    secondary_muscles: List[str] = []
    for em in exercise_type.exercise_muscles or []:
        if getattr(em, "is_primary", False):
            primary_muscles.append(em.muscle.name)
        else:
            secondary_muscles.append(em.muscle.name)

    # Build shared context for prompts
    context = {
        "name": exercise_type.name,
        "description": exercise_type.description or "",
        "primary_muscles": primary_muscles,
        "secondary_muscles": secondary_muscles,
    }

    try:
        # Generate both images (eccentric/start and concentric/end) concurrently
        import asyncio

        eccentric, concentric = await asyncio.gather(
            generate_exercise_phase_image(
                context=context, phase_label="start / eccentric"
            ),
            generate_exercise_phase_image(
                context=context, phase_label="end / concentric"
            ),
        )
    except errors.ClientError as exc:
        if exc.status_code == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Gemini API quota exceeded. Please wait a minute and try again.",
            ) from exc
        logger.exception("Gemini API error during image generation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini API error: {exc}",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error during image generation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected generation failure: {exc}",
        ) from exc

    return {
        "exercise_type_id": exercise_type_id,
        "model": eccentric.model,
        "mime_type": eccentric.mime_type,
        "images": {
            "eccentric_start": eccentric.base64_data,
            "concentric_end": concentric.base64_data,
        },
        "prompt_summaries": {
            "eccentric": eccentric.prompt_summary,
            "concentric": concentric.prompt_summary,
        },
    }


@router.post(
    "/routines",
    response_model=RoutineRead,
    status_code=status.HTTP_201_CREATED,
    summary="Admin: Create a new routine",
)
async def admin_create_routine(
    routine_in: AdminRoutineCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> RoutineRead:
    """
    Create a new routine under the authenticated admin user.

    Notes:
    - The backing database model/table is still named "recipes".
    - This endpoint is restricted to superusers.
    """
    _ensure_admin(user)

    return await routine_service.create_routine_admin(session, routine_in, user.id)


@router.get(
    "/exercise-types/{exercise_type_id}/reference-image-options",
    response_model=AdminExerciseImageOptionsResponse,
    summary="Admin: list current and generated image options for an exercise type",
)
async def get_reference_image_options(
    exercise_type_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> AdminExerciseImageOptionsResponse:
    _ensure_admin(user)
    exercise_type = await ExerciseTypeService.get_exercise_type(session, exercise_type_id)
    if not exercise_type:
        raise HTTPException(status_code=404, detail="Exercise type not found")

    return await build_image_options_response(session, exercise_type)


@router.post(
    "/exercise-types/{exercise_type_id}/reference-image-options/generate",
    response_model=AdminExerciseImageOptionsResponse,
    summary="Admin: generate idempotent image options from reference images",
)
async def generate_reference_options(
    exercise_type_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> AdminExerciseImageOptionsResponse:
    _ensure_admin(user)
    if not settings.GOOGLE_AI_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google AI API key not configured",
        )

    exercise_type = await ExerciseTypeService.get_exercise_type(session, exercise_type_id)
    if not exercise_type:
        raise HTTPException(status_code=404, detail="Exercise type not found")

    try:
        return await generate_reference_image_options(session, exercise_type)
    except HTTPException:
        raise
    except errors.ClientError as exc:
        if exc.status_code == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Gemini API quota exceeded. Please wait a minute and try again.",
            ) from exc
        logger.exception("Gemini API error during image generation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini API error: {exc}",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error during image generation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected generation failure: {exc}",
        ) from exc


@router.post(
    "/exercise-types/{exercise_type_id}/reference-image-options/apply",
    response_model=AdminExerciseImageOptionsResponse,
    summary="Admin: apply a generated image option or revert to the reference set",
)
async def apply_reference_option(
    exercise_type_id: int,
    selection: AdminApplyExerciseImageOptionRequest,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> AdminExerciseImageOptionsResponse:
    _ensure_admin(user)
    exercise_type = await ExerciseTypeService.get_exercise_type(session, exercise_type_id)
    if not exercise_type:
        raise HTTPException(status_code=404, detail="Exercise type not found")

    return await apply_reference_or_option(
        session,
        exercise_type,
        option_key=selection.option_key,
        use_reference=selection.use_reference,
    )
