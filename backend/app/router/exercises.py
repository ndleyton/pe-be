from typing import List
from app.models import Exercise, Workout
from app.schemas import ExerciseCreate, ExerciseRead
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import Depends, APIRouter, status, HTTPException
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


@exercises_router.get("/workouts/{workout_id}", response_model=List[ExerciseRead])
async def get_exercises_in_workout(
    workout_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    # First verify the workout exists and belongs to the user
    workout_result = await session.execute(
        select(Workout).where(
            Workout.id == workout_id,
            Workout.owner_id == user.id
        )
    )
    workout = workout_result.scalar_one_or_none()
    
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    # Get exercises for this workout with exercise_type relationship
    exercises_result = await session.execute(
        select(Exercise).options(selectinload(Exercise.exercise_type)).where(Exercise.workout_id == workout_id).order_by(Exercise.created_at.asc())
    )
    exercises = exercises_result.scalars().all()
    return exercises
