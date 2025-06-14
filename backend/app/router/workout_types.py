from typing import List
from app.models import WorkoutType
from app.schemas import WorkoutTypeRead
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends, APIRouter
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