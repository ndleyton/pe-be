from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_async_session
from src.profiles.schemas import (
    PaginatedPublicWorkoutActivities,
    PublicProfileRead,
    PublicWorkoutActivityRead,
    SavePublicWorkoutAsRoutineRequest,
    SavePublicWorkoutAsRoutineResponse,
)
from src.profiles.service import ProfileNotFoundError, profile_service
from src.users.models import User
from src.users.router import current_active_user

router = APIRouter(tags=["profiles"])


@router.get("/{username}", response_model=PublicProfileRead)
async def get_public_profile(
    username: str,
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await profile_service.get_public_profile(session, username)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Profile not found") from exc


@router.get("/{username}/activities", response_model=PaginatedPublicWorkoutActivities)
async def list_public_activities(
    username: str,
    cursor: int | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await profile_service.list_public_activities(
            session, username, cursor=cursor, limit=limit
        )
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Profile not found") from exc


@router.get(
    "/{username}/activities/{workout_id}", response_model=PublicWorkoutActivityRead
)
async def get_public_activity(
    username: str,
    workout_id: int,
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await profile_service.get_public_activity(session, username, workout_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Activity not found") from exc


@router.post(
    "/{username}/activities/{workout_id}/save-as-routine",
    response_model=SavePublicWorkoutAsRoutineResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_public_activity_as_routine(
    username: str,
    workout_id: int,
    clone_request: SavePublicWorkoutAsRoutineRequest | None = None,
    viewer: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await profile_service.save_public_activity_as_routine(
            session, username, workout_id, viewer.id, clone_request
        )
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Activity not found") from exc
