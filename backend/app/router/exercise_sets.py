from app.models import ExerciseSet, Exercise
from app.schemas import ExerciseSetCreate, ExerciseSetRead, ExerciseSetUpdate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from fastapi import Depends, APIRouter, status, HTTPException
from app.users import current_active_user, User
from app.db import get_async_session


exercise_sets_router = APIRouter(tags=["exercise_sets"])

@exercise_sets_router.post("/", response_model=ExerciseSetRead, status_code=status.HTTP_201_CREATED)
async def create_exercise_set(
    exercise_set_in: ExerciseSetCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    # Verify the exercise exists and belongs to the user
    exercise_query = select(Exercise).options(selectinload(Exercise.workout)).where(Exercise.id == exercise_set_in.exercise_id)
    exercise_result = await session.execute(exercise_query)
    exercise = exercise_result.scalar_one_or_none()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    if exercise.workout.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to add sets to this exercise")
    
    exercise_set = ExerciseSet(**exercise_set_in.dict())
    session.add(exercise_set)
    await session.commit()
    await session.refresh(exercise_set)
    return exercise_set

@exercise_sets_router.get("/exercise/{exercise_id}", response_model=list[ExerciseSetRead])
async def get_exercise_sets(
    exercise_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    # Verify the exercise exists and belongs to the user
    exercise_query = select(Exercise).options(selectinload(Exercise.workout)).where(Exercise.id == exercise_id)
    exercise_result = await session.execute(exercise_query)
    exercise = exercise_result.scalar_one_or_none()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    if exercise.workout.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view sets for this exercise")
    
    # Get all exercise sets for this exercise
    sets_query = select(ExerciseSet).where(ExerciseSet.exercise_id == exercise_id)
    sets_result = await session.execute(sets_query)
    exercise_sets = sets_result.scalars().all()
    
    return exercise_sets

@exercise_sets_router.put("/{exercise_set_id}", response_model=ExerciseSetRead)
async def update_exercise_set(
    exercise_set_id: int,
    exercise_set_update: ExerciseSetUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    # Get the exercise set with exercise and workout relationships
    set_query = select(ExerciseSet).options(
        selectinload(ExerciseSet.exercise).selectinload(Exercise.workout)
    ).where(ExerciseSet.id == exercise_set_id)
    set_result = await session.execute(set_query)
    exercise_set = set_result.scalar_one_or_none()
    
    if not exercise_set:
        raise HTTPException(status_code=404, detail="Exercise set not found")
    
    if exercise_set.exercise.workout.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this exercise set")
    
    # Update only the provided fields
    for field, value in exercise_set_update.dict(exclude_unset=True).items():
        setattr(exercise_set, field, value)
    
    await session.commit()
    await session.refresh(exercise_set)
    return exercise_set

@exercise_sets_router.delete("/{exercise_set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise_set(
    exercise_set_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    # Get the exercise set with exercise and workout relationships
    set_query = select(ExerciseSet).options(
        selectinload(ExerciseSet.exercise).selectinload(Exercise.workout)
    ).where(ExerciseSet.id == exercise_set_id)
    set_result = await session.execute(set_query)
    exercise_set = set_result.scalar_one_or_none()
    
    if not exercise_set:
        raise HTTPException(status_code=404, detail="Exercise set not found")
    
    if exercise_set.exercise.workout.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this exercise set")
    
    await session.delete(exercise_set)
    await session.commit()