import pytest
import asyncio
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
        "postgresql+asyncpg://postgres:postgres@localhost:5432/pe_be_test",
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


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def setup_database():
    """Ensure a clean test database state for each test session.

    We first drop *all* tables to remove any leftover schema from previous
    runs (e.g., stale unique constraints).  Then we recreate the schema from
    the current SQLAlchemy models.  After the test session completes, we
    drop the tables again so that subsequent sessions always start from a
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

    # Tear-down: drop everything to avoid leaking state between sessions
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session(setup_database) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async with TestSessionLocal() as session:
        # Ensure tables are clean *before* each test starts. This avoids
        # leftover rows from a previous test run within the same pytest
        # session causing UNIQUE-constraint violations (e.g. ExerciseType.name).
        for table in [
            "exercises",
            "exercise_sets",
            "exercise_muscles",
            "exercise_types",
        ]:
            await session.execute(text(f"TRUNCATE {table} CASCADE"))
        await session.commit()

        yield session

        # Roll back any open transaction *and* clear data inserted by the test
        # so that subsequent tests start with an empty database but without
        # the overhead of re-creating the whole schema each time.
        await session.rollback()

        # Final clean-up to guarantee pristine state even if the test failed
        for table in [
            "exercises",
            "exercise_sets",
            "exercise_muscles",
            "exercise_types",
        ]:
            await session.execute(text(f"TRUNCATE {table} CASCADE"))
        await session.commit()


@pytest.fixture
async def async_client(setup_database) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with test database session."""
    async with TestSessionLocal() as session:
        async def override_get_db():
            yield session

        app.dependency_overrides[get_async_session] = override_get_db
        async with AsyncClient(app=app, base_url="http://test") as client:
            yield client
        app.dependency_overrides.clear()
        await session.rollback()


@pytest.fixture
def client(db_session: AsyncSession):
    """Create a test client with test database session."""

    def override_get_db():
        return db_session

    app.dependency_overrides[get_async_session] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
