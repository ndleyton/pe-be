from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from src.workouts.crud import (
    get_workout_by_id,
    get_user_workouts,
    create_workout,
    update_workout,
    delete_workout,
    get_workout_types,
    create_workout_type
)
from src.workouts.models import Workout, WorkoutType
from src.workouts.schemas import WorkoutCreate, WorkoutUpdate, WorkoutTypeCreate


class WorkoutService:
    """Service layer for workout business logic"""
    
    @staticmethod
    async def get_workout(session: AsyncSession, workout_id: int, user_id: int) -> Optional[Workout]:
        """Get a workout by ID for a specific user"""
        return await get_workout_by_id(session, workout_id, user_id)
    
    @staticmethod
    async def get_my_workouts(session: AsyncSession, user_id: int) -> List[Workout]:
        """Get all workouts for a user"""
        return await get_user_workouts(session, user_id)
    
    @staticmethod
    async def create_new_workout(session: AsyncSession, workout_data: WorkoutCreate, user_id: int) -> Workout:
        """Create a new workout with business logic validation"""
        # Add any business logic here (e.g., validation, default values)
        return await create_workout(session, workout_data, user_id)
    
    @staticmethod
    async def update_workout_data(
        session: AsyncSession, 
        workout_id: int, 
        workout_data: WorkoutUpdate, 
        user_id: int
    ) -> Optional[Workout]:
        """Update workout data with business logic validation"""
        # Add any business logic here (e.g., validation, authorization)
        return await update_workout(session, workout_id, workout_data, user_id)
    
    @staticmethod
    async def remove_workout(session: AsyncSession, workout_id: int, user_id: int) -> bool:
        """Remove a workout with business logic validation"""
        # Add any business logic here (e.g., cascade deletion, authorization)
        return await delete_workout(session, workout_id, user_id)


class WorkoutTypeService:
    """Service layer for workout type business logic"""
    
    @staticmethod
    async def get_all_workout_types(session: AsyncSession) -> List[WorkoutType]:
        """Get all workout types"""
        return await get_workout_types(session)
    
    @staticmethod
    async def create_new_workout_type(session: AsyncSession, workout_type_data: WorkoutTypeCreate) -> WorkoutType:
        """Create a new workout type with business logic validation"""
        # Add any business logic here (e.g., validation, duplicate checking)
        return await create_workout_type(session, workout_type_data) 