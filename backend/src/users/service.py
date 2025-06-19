from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from src.users.crud import (
    get_user_by_id,
    get_user_by_email,
    create_user,
    update_user,
    delete_user
)
from src.users.models import User
from src.users.schemas import UserCreate, UserUpdate


class UserService:
    """Service layer for user business logic"""
    
    @staticmethod
    async def get_user(session: AsyncSession, user_id: int) -> Optional[User]:
        """Get a user by ID"""
        return await get_user_by_id(session, user_id)
    
    @staticmethod
    async def get_user_by_email_address(session: AsyncSession, email: str) -> Optional[User]:
        """Get a user by email address"""
        return await get_user_by_email(session, email)
    
    @staticmethod
    async def create_new_user(session: AsyncSession, user_data: UserCreate) -> User:
        """Create a new user with business logic validation"""
        # Add any business logic here (e.g., validation, default values)
        return await create_user(session, user_data)
    
    @staticmethod
    async def update_user_data(session: AsyncSession, user_id: int, user_data: UserUpdate) -> Optional[User]:
        """Update user data with business logic validation"""
        # Add any business logic here (e.g., validation, authorization)
        return await update_user(session, user_id, user_data)
    
    @staticmethod
    async def remove_user(session: AsyncSession, user_id: int) -> bool:
        """Remove a user with business logic validation"""
        # Add any business logic here (e.g., cascade deletion, authorization)
        return await delete_user(session, user_id) 