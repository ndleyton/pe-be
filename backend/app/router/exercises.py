from app.models import Exercise
from app.schemas import ExerciseCreate, ExerciseRead
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends, APIRouter, status
from app.users import current_active_user, User
from app.db import get_async_session


exercises_router = APIRouter(tags=["exercises"])

@exercises_router.post("/", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    exercise_in: ExerciseCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    exercise = Exercise(**exercise_in.dict())
    session.add(exercise)
    await session.commit()
    await session.refresh(exercise)
    return exercise
