import os
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, DateTime, MetaData
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from dotenv import load_dotenv

load_dotenv()

# Explicitly create MetaData
metadata_obj = MetaData()


# Pass metadata to DeclarativeBase
class Base(DeclarativeBase):
    metadata = metadata_obj

    # Common fields for all models (these will be added automatically if not overridden)
    __abstract__ = True

    id = Column(Integer, primary_key=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


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

# Database engine and session factory
engine = create_async_engine(DATABASE_URL)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def create_db_and_tables():
    """Create database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions"""
    async with async_session_maker() as session:
        yield session
