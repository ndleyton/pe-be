from typing import List, Optional
from app.models import ExerciseType
from app.schemas import ExerciseTypeRead, ExerciseTypeCreate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.exc import IntegrityError
from fastapi import Depends, APIRouter, HTTPException, status, Query
from app.db import get_async_session

exercise_types_router = APIRouter(tags=["exercise_types"])

@exercise_types_router.get("/", response_model=List[ExerciseTypeRead])
async def get_exercise_types(
    order_by: Optional[str] = Query(default="usage", description="Sort order: 'usage' for usage-based sort, 'name' for alphabetical"),
    session: AsyncSession = Depends(get_async_session)
):
    """Get all exercise types from the database."""
    query = select(ExerciseType)
    
    if order_by == "usage":
        # Order by times_used DESC (most used first), then by name ASC (alphabetical)
        query = query.order_by(desc(ExerciseType.times_used), ExerciseType.name)
    elif order_by == "name":
        # Order alphabetically by name
        query = query.order_by(ExerciseType.name)
    else:
        # Default to usage-based ordering
        query = query.order_by(desc(ExerciseType.times_used), ExerciseType.name)
    
    result = await session.execute(query)
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