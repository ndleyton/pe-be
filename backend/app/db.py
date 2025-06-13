import os

from collections.abc import AsyncGenerator

from fastapi import Depends
from fastapi_users.db import (
    SQLAlchemyUserDatabase,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.models import User, OAuthAccount, Base, Workout

from dotenv import load_dotenv
load_dotenv()

def get_database_url():
    """Get the database URL and ensure it's compatible with async operations."""
    # Fallback URL for local development only - configure DATABASE_URL environment variable in production
    db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
    
    # Convert postgresql:// to postgresql+asyncpg:// for async operations
    if db_url.startswith("postgresql://"):
        return db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        return db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    
    return db_url

DATABASE_URL = get_database_url()

engine = create_async_engine(DATABASE_URL)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def create_db_and_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, User, OAuthAccount)