from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_async_session
from src.routine_programs.schemas import (
    RoutineProgramCreate,
    RoutineProgramRead,
    RoutineProgramSummary,
    RoutineProgramUpdate,
)
from src.routine_programs.service import routine_program_service
from src.users.models import User
from src.users.router import current_active_user, current_optional_user

router = APIRouter(tags=["routine-programs"])

MAX_PROGRAM_LIMIT = 500
ALLOWED_SORT_KEYS = {
    "createdAt",
    "updatedAt",
    "name",
    "author",
    "category",
    "timesUsed",
}


def _validate_list_params(offset: int, limit: int, order_by: str | None = None) -> None:
    if offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Offset must be non-negative",
        )
    if limit <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be a positive integer",
        )
    if limit > MAX_PROGRAM_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Limit exceeds maximum allowed ({MAX_PROGRAM_LIMIT})",
        )
    if order_by is not None and order_by not in ALLOWED_SORT_KEYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid order_by. Supported values: {', '.join(sorted(ALLOWED_SORT_KEYS))}",
        )


@router.get("/summary", response_model=List[RoutineProgramSummary])
async def get_visible_programs_summary(
    user: User | None = Depends(current_optional_user),
    session: AsyncSession = Depends(get_async_session),
    offset: int = 0,
    limit: int = 100,
    order_by: str = "createdAt",
    category: str | None = None,
    author: str | None = None,
):
    _validate_list_params(offset, limit, order_by)
    return await routine_program_service.get_visible_programs_summary(
        session, user.id if user else None, offset, limit, order_by, category, author
    )


@router.get("/", response_model=List[RoutineProgramRead])
async def get_visible_programs(
    user: User | None = Depends(current_optional_user),
    session: AsyncSession = Depends(get_async_session),
    offset: int = 0,
    limit: int = 100,
):
    _validate_list_params(offset, limit)
    return await routine_program_service.get_visible_programs(
        session, user.id if user else None, offset, limit
    )


@router.get("/{program_id}", response_model=RoutineProgramRead)
async def get_program(
    program_id: int,
    user: User | None = Depends(current_optional_user),
    session: AsyncSession = Depends(get_async_session),
):
    program = await routine_program_service.get_program(
        session, program_id, user.id if user else None
    )
    if program is None:
        raise HTTPException(status_code=404, detail="Routine program not found")
    return program


@router.post("/", response_model=RoutineProgramRead, status_code=status.HTTP_201_CREATED)
async def create_program(
    program_in: RoutineProgramCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    return await routine_program_service.create_program(session, program_in, user.id)


@router.put("/{program_id}", response_model=RoutineProgramRead)
async def update_program(
    program_id: int,
    program_in: RoutineProgramUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        program = await routine_program_service.update_program(
            session,
            program_id,
            program_in,
            user.id,
            is_superuser=user.is_superuser,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    if program is None:
        raise HTTPException(status_code=404, detail="Routine program not found")
    return program


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(
    program_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await routine_program_service.delete_program(
            session, program_id, user.id, is_superuser=user.is_superuser
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post(
    "/{program_id}/clone",
    response_model=RoutineProgramRead,
    status_code=status.HTTP_201_CREATED,
)
async def clone_program(
    program_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    program = await routine_program_service.clone_program(session, program_id, user.id)
    if program is None:
        raise HTTPException(status_code=404, detail="Routine program not found")
    return program
