from typing import List 
from app.models import Workout, Exercise
from app.schemas import WorkoutRead, WorkoutBase, WorkoutUpdate, ExerciseRead
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
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

# --- Exercises in Workout ---

# Expose nested resource following REST convention: /workouts/{id}/exercises
@workouts_router.get("/{workout_id}/exercises", response_model=List[ExerciseRead])
async def get_exercises_in_workout(
    workout_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return exercises for the requested workout

    We join ``Exercise`` with its parent ``Workout`` and filter on both the
    requested *workout_id* **and** the current user's ownership. If the
    combination does not exist (i.e. the workout does not belong to the user
    or does not exist at all) the query returns an empty list – eliminating
    the need for a prior ownership lookup or an explicit *404* branch.
    """

    result = await session.execute(
        select(Exercise)
        .join(Workout, Exercise.workout_id == Workout.id)
        .options(selectinload(Exercise.exercise_type))
        .where(Workout.id == workout_id, Workout.owner_id == user.id)
        .order_by(Exercise.id.asc())
    )

    exercises = result.scalars().all()

    if not exercises:  # Empty list implies workout not found or not owned
        raise HTTPException(status_code=404, detail="Workout not found")

    return exercises