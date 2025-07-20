import pytest
import pytest_asyncio
import os
from typing import AsyncGenerator
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from src.main import app
from src.core.database import get_async_session, Base

# Ensure domain models are imported so metadata includes all tables
import src.exercises.models  # noqa: F401
import src.workouts.models  # noqa: F401
import src.exercise_sets.models  # noqa: F401
import src.users.models  # noqa: F401
import src.recipes.models  # noqa: F401


def get_test_database_url():
    """Get test database URL and ensure it's async compatible."""
    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://ndleyton@localhost:5432/gym_tracker_test",
    )

    # Convert postgresql:// to postgresql+asyncpg:// for async operations
    if db_url.startswith("postgresql://"):
        return db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        return db_url.replace("postgres://", "postgresql+asyncpg://", 1)

    return db_url


# Test database URL - use environment variable or default
TEST_DATABASE_URL = get_test_database_url()

# Create test engine
test_engine = create_async_engine(TEST_DATABASE_URL, echo=True)

# Create test session
TestSessionLocal = sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture(scope="function")
async def setup_database():
    """Ensure a clean test database state for each test function.

    We first drop *all* tables to remove any leftover schema from previous
    runs (e.g., stale unique constraints).  Then we recreate the schema from
    the current SQLAlchemy models.  After the test function completes, we
    drop the tables again so that subsequent tests always start from a
    blank slate.
    """
    async with test_engine.begin() as conn:
        # Drop in case a previous interrupted session left stale tables
        await conn.run_sync(Base.metadata.drop_all)
        # Re-create the schema based on the *current* models
        await conn.run_sync(Base.metadata.create_all)

        # No additional tweaks required – the schema now reflects production
        # constraints (including the unique exercise type name).

    yield

    # Tear-down: drop everything to avoid leaking state between tests
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(setup_database) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session with proper cleanup."""
    async with TestSessionLocal() as session:
        async with session.begin():
            # Clean tables before test
            for table in [
                "exercises",
                "exercise_sets",
                "exercise_muscles",
                "exercise_types",
                "workouts",
                "users",
                "recipes",
            ]:
                await session.execute(text(f"TRUNCATE {table} CASCADE"))

            yield session

            # Rollback will happen automatically when context exits
            # This ensures ALL changes in this session are rolled back


@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client that uses the SAME session as db_session fixture."""

    async def override_get_db():
        yield db_session  # Use the session from db_session fixture!

    app.dependency_overrides[get_async_session] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """Create a test client for sync tests (no database setup)."""
    with TestClient(app) as test_client:
        yield test_client
