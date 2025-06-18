from typing import List
from app.models import WorkoutType
from app.schemas import WorkoutTypeRead, WorkoutTypeCreate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import Depends, APIRouter, HTTPException, status
from app.db import get_async_session

workout_types_router = APIRouter(tags=["workout_types"])

@workout_types_router.get("/", response_model=List[WorkoutTypeRead])
async def get_workout_types(
    session: AsyncSession = Depends(get_async_session)
):
    """Get all workout types."""
    result = await session.execute(select(WorkoutType).order_by(WorkoutType.name))
    workout_types = result.scalars().all()
    return workout_types

# --- Create Workout Type ---

@workout_types_router.post("/", response_model=WorkoutTypeRead, status_code=status.HTTP_201_CREATED)
async def create_workout_type(
    workout_type: WorkoutTypeCreate,
    session: AsyncSession = Depends(get_async_session)
):
    """Create a new workout type."""
    try:
        db_workout_type = WorkoutType(
            name=workout_type.name,
            description=workout_type.description,
        )
        session.add(db_workout_type)
        await session.commit()
        await session.refresh(db_workout_type)
        return db_workout_type
    except IntegrityError as e:
        await session.rollback()
        if hasattr(e.orig, 'pgcode') and e.orig.pgcode == '23505':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Workout type with name '{workout_type.name}' already exists",
            ) from e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create workout type due to database constraint",
        ) from e 