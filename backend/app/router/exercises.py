from app.models import Exercise, ExerciseType
from app.schemas import ExerciseCreate, ExerciseRead
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, update
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
    # Create the exercise
    exercise = Exercise(**exercise_in.dict())
    session.add(exercise)
    
    # Increment the times_used count for the selected exercise type
    await session.execute(
        update(ExerciseType)
        .where(ExerciseType.id == exercise_in.exercise_type_id)
        .values(times_used=ExerciseType.times_used + 1)
    )
    
    await session.commit()
    await session.refresh(exercise)
    
    # Fetch the exercise with eager loading for the response
    result = await session.execute(
        select(Exercise)
        .options(
            selectinload(Exercise.exercise_type),
            selectinload(Exercise.exercise_sets)
        )
        .where(Exercise.id == exercise.id)
    )
    exercise_with_relations = result.scalar_one()
    
    return exercise_with_relations
