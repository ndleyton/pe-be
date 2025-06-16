from typing import List
from app.models import ExerciseType
from app.schemas import ExerciseTypeRead, ExerciseTypeCreate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import Depends, APIRouter, HTTPException
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

@exercise_types_router.post("/", response_model=ExerciseTypeRead)
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
        if "duplicate key value violates unique constraint" in str(e):
            raise HTTPException(
                status_code=400,
                detail=f"Exercise type with name '{exercise_type.name}' already exists"
            )
        raise HTTPException(
            status_code=500,
            detail="Failed to create exercise type due to database constraint"
        )