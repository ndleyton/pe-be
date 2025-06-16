from typing import List
from app.models import ExerciseType
from app.schemas import ExerciseTypeRead, ExerciseTypeCreate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import Depends, APIRouter, HTTPException, status
from app.db import get_async_session

exercise_types_router = APIRouter(tags=["exercise_types"])

@exercise_types_router.get("/", response_model=List[ExerciseTypeRead])
async def get_exercise_types(
    session: AsyncSession = Depends(get_async_session)
):
    """Get all exercise types from the database."""
    result = await session.execute(select(ExerciseType).order_by(ExerciseType.name))
    exercise_types = result.scalars().all()
    return exercise_types

@exercise_types_router.post("/", response_model=ExerciseTypeRead, status_code=status.HTTP_201_CREATED)
async def create_exercise_type(
    exercise_type: ExerciseTypeCreate,
    session: AsyncSession = Depends(get_async_session)
):
    """Create a new exercise type."""
    try:
        db_exercise_type = ExerciseType(
            name=exercise_type.name,
            description=exercise_type.description,
            default_intensity_unit=exercise_type.default_intensity_unit
        )
        session.add(db_exercise_type)
        await session.commit()
        await session.refresh(db_exercise_type)
        return db_exercise_type
    except IntegrityError as e:
        await session.rollback()
        if hasattr(e.orig, 'pgcode') and e.orig.pgcode == '23505':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Exercise type with name '{exercise_type.name}' already exists"
            ) from e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create exercise type due to database constraint"
        ) from e