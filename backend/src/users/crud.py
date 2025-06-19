from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi_users.db import SQLAlchemyUserDatabase

from src.users.models import User, OAuthAccount
from src.users.schemas import UserCreate, UserUpdate


async def get_user_by_id(session: AsyncSession, user_id: int) -> Optional[User]:
    """Get a user by ID"""
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(session: AsyncSession, email: str) -> Optional[User]:
    """Get a user by email"""
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(session: AsyncSession, user_create: UserCreate) -> User:
    """Create a new user"""
    user = User(**user_create.model_dump())
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def update_user(session: AsyncSession, user_id: int, user_update: UserUpdate) -> Optional[User]:
    """Update an existing user"""
    user = await get_user_by_id(session, user_id)
    if not user:
        return None
    
    for field, value in user_update.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    
    await session.commit()
    await session.refresh(user)
    return user


async def delete_user(session: AsyncSession, user_id: int) -> bool:
    """Delete a user"""
    user = await get_user_by_id(session, user_id)
    if not user:
        return False
    
    await session.delete(user)
    await session.commit()
    return True 