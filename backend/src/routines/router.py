from typing import List
from fastapi import Depends, APIRouter, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.routines.schemas import RoutineRead, RoutineCreate, RoutineUpdate
from src.workouts.schemas import WorkoutRead
from src.routines.service import routine_service
from src.core.database import get_async_session
from src.users.router import current_active_user, current_optional_user
from src.users.models import User

# NOTE: The application exposes these as routines.
# The backing database table remains "recipes".
router = APIRouter(tags=["routines"])


@router.get("/", response_model=List[RoutineRead])
async def get_visible_routines(
    user: User | None = Depends(current_optional_user),
    session: AsyncSession = Depends(get_async_session),
    offset: int = 0,
    limit: int = 100,
):
    """Get routines visible to the current viewer.

    Signed-out users receive only public routines.
    Signed-in users receive their own routines plus public routines.
    """
    return await routine_service.get_visible_routines(
        session, user.id if user else None, offset, limit
    )


@router.get("/{routine_id}", response_model=RoutineRead)
async def get_routine(
    routine_id: int,
    user: User | None = Depends(current_optional_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get a specific routine by ID.

    Public routines are viewable without authentication.
    """
    routine = await routine_service.get_routine(
        session, routine_id, user.id if user else None
    )
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    return routine


@router.post("/", response_model=RoutineRead, status_code=status.HTTP_201_CREATED)
async def create_routine(
    routine_in: RoutineCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new routine"""
    try:
        return await routine_service.create_routine(session, routine_in, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{routine_id}", response_model=RoutineRead)
async def update_routine(
    routine_id: int,
    routine_in: RoutineUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Update an existing routine"""
    try:
        routine = await routine_service.update_routine(
            session, routine_id, routine_in, user.id, is_superuser=user.is_superuser
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    return routine


@router.post(
    "/{routine_id}/start",
    response_model=WorkoutRead,
    status_code=status.HTTP_201_CREATED,
)
async def start_workout_from_routine(
    routine_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a workout from a saved routine and return it."""
    try:
        workout = await routine_service.create_workout_from_routine(
            session, user.id, routine_id
        )
        return workout
    except ValueError:
        raise HTTPException(status_code=404, detail="Routine not found")


@router.delete("/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_routine(
    routine_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Delete a routine"""
    # Idempotent delete: 204 whether missing or not owned
    await routine_service.delete_routine(
        session, routine_id, user.id, is_superuser=user.is_superuser
    )
