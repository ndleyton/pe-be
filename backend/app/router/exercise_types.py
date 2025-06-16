from typing import List
from app.models import ExerciseType
from app.schemas import ExerciseTypeRead
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends, APIRouter
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