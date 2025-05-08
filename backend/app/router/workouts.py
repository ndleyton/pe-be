from typing import List 
from app.models import Workout
from app.schemas import WorkoutRead, WorkoutBase
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends, APIRouter, status
from app.users import current_active_user, User
from app.db import get_async_session


workouts_router = APIRouter(tags=["workouts"]) 

@workouts_router.post("/", response_model=WorkoutRead, status_code=status.HTTP_201_CREATED)
async def create_workout(
    workout_in: WorkoutBase,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    # Create a new Workout instance
    workout = Workout(
        **workout_in.dict(),
        owner_id=user.id
    )
    session.add(workout)
    await session.commit()
    await session.refresh(workout)
    return workout


@workouts_router.get("/mine", response_model=List[WorkoutRead])
async def get_my_workouts(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    result = await session.execute(select(Workout).where(Workout.owner_id == user.id).order_by(Workout.start_time.desc()))
    workouts = result.scalars().all()
    return workouts