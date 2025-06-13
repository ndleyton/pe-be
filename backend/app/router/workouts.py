from typing import List 
from app.models import Workout
from app.schemas import WorkoutRead, WorkoutBase, WorkoutUpdate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends, APIRouter, status, HTTPException
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


@workouts_router.patch("/{workout_id}", response_model=WorkoutRead)
async def update_workout(
    workout_id: int,
    workout_update: WorkoutUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    # Find the workout
    result = await session.execute(
        select(Workout).where(
            Workout.id == workout_id,
            Workout.owner_id == user.id
        )
    )
    workout = result.scalar_one_or_none()
    
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    # Update fields that are not None
    update_data = workout_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(workout, field, value)
    
    await session.commit()
    await session.refresh(workout)
    return workout