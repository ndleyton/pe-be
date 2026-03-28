import os
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Column, Integer, DateTime, MetaData
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.core.config import settings

# Load dotenv with respect for ENV_FILE if provided, otherwise default to .env
env_file = os.getenv("ENV_FILE", ".env")
try:
    env_path = Path(env_file)
    if not env_path.is_absolute():
        # Assume backend root is one level up from src
        env_path = Path(__file__).resolve().parents[2] / env_file
    load_dotenv(env_path, override=False)
except Exception:
    # Fallback to default behavior
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


def get_database_url() -> str:
    """Return the validated database URL in an async-driver-compatible form."""
    db_url = settings.DATABASE_URL

    # Convert postgresql:// to postgresql+asyncpg:// for async operations
    if db_url.startswith("postgresql://"):
        return db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if db_url.startswith("postgres://"):
        return db_url.replace("postgres://", "postgresql+asyncpg://", 1)

    return db_url


def _get_bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _get_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    return int(raw_value)


def get_engine_kwargs() -> dict[str, int | bool]:
    """Build engine kwargs with pool-friendly defaults for asyncpg."""
    return {
        "pool_pre_ping": _get_bool_env("DATABASE_POOL_PRE_PING", True),
        "pool_use_lifo": _get_bool_env("DATABASE_POOL_USE_LIFO", True),
        "pool_size": _get_int_env("DATABASE_POOL_SIZE", 5),
        "max_overflow": _get_int_env("DATABASE_MAX_OVERFLOW", 10),
        "pool_timeout": _get_int_env("DATABASE_POOL_TIMEOUT", 30),
        "pool_recycle": _get_int_env("DATABASE_POOL_RECYCLE", 1800),
    }


DATABASE_URL = get_database_url()

# Database engine and session factory
engine = create_async_engine(DATABASE_URL, **get_engine_kwargs())
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def create_db_and_tables():
    """Create database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions"""
    async with async_session_maker() as session:
        yield session
