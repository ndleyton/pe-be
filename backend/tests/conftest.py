import pytest
import pytest_asyncio
import os
from typing import AsyncGenerator
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from urllib.parse import urlsplit
from pathlib import Path

# Ensure test environment variables are loaded from a safe test dotenv file
try:
    from dotenv import load_dotenv

    backend_dir = Path(__file__).resolve().parent.parent
    # Priority: ENV_FILE if set; else .env.test in backend dir
    env_file_from_env = os.getenv("ENV_FILE")
    candidate_paths = []
    if env_file_from_env:
        env_path = Path(env_file_from_env)
        if not env_path.is_absolute():
            env_path = backend_dir / env_path
        candidate_paths.append(env_path)
    candidate_paths.append(backend_dir / ".env.test")

    for path in candidate_paths:
        if path.exists():
            load_dotenv(path, override=False)
            break
except Exception:
    # Best-effort: if python-dotenv is missing or any error occurs, continue
    pass

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


def _assert_safe_test_database_url(db_url: str) -> None:
    """Fail fast if DATABASE_URL doesn't clearly point to a test database.

    We require the database name to contain the substring 'test' to reduce the
    risk of accidental data loss when running pytest.
    """
    try:
        parsed = urlsplit(db_url)
        db_name = (parsed.path or "").lstrip("/")
    except Exception:
        db_name = ""

    if not db_name or "test" not in db_name.lower():
        raise RuntimeError(
            "Refusing to run destructive test setup against a non-test database. "
            "Set DATABASE_URL to a dedicated test database whose name contains 'test'. "
            f"Current database name detected: '{db_name or '[empty]'}'"
        )


# Enforce safety immediately on import
_assert_safe_test_database_url(TEST_DATABASE_URL)


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
    """Provide a clean AsyncSession without wrapping it in an outer transaction.

    Using an outer `session.begin()` causes conflicts when the application code
    also manages transactions (commit/rollback) or when connection-inspecting
    operations run under the same connection with asyncpg. We instead:
      - TRUNCATE relevant tables up-front and COMMIT once to ensure a clean state
      - Yield the raw session so app code can manage its own transactions
      - Let the `setup_database` fixture drop the schema after each test for isolation
    """
    async with TestSessionLocal() as session:
        # Clean tables before test (outside an explicit transaction)
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
        await session.commit()

        # Hand the session to tests and route handlers via dependency override
        yield session

        # Best-effort cleanup of any uncommitted work
        try:
            await session.rollback()
        except Exception:
            pass


@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client that uses the SAME session as db_session fixture."""

    async def override_get_db():
        yield db_session  # Use the session from db_session fixture!

    app.dependency_overrides[get_async_session] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """Create a test client for sync tests (no database setup)."""
    with TestClient(app) as test_client:
        yield test_client
