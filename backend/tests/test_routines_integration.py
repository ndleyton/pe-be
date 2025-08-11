import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from urllib.parse import urlsplit

from src.main import app
from src.core.config import settings
from src.core.database import Base, get_async_session
from src.users.models import User
from src.users.router import current_active_user
from src.exercises.models import ExerciseType, IntensityUnit
from src.workouts.models import WorkoutType
import src.exercises.models  # noqa: F401
import src.workouts.models  # noqa: F401
import src.exercise_sets.models  # noqa: F401
import src.users.models  # noqa: F401
import src.recipes.models  # noqa: F401


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_routine_endpoint_success():
    """End-to-end test for POST /api/v1/routines/ creating a routine with nested templates.

    Seeds minimal reference data (user, intensity unit, exercise type, workout type),
    overrides auth dependency to return our test user, then asserts 201 and response shape.
    """

    # Safety: ensure we are running against a test database to avoid destructive ops
    db_url = settings.DATABASE_URL
    # Ensure async driver for SQLAlchemy asyncio
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    db_name = urlsplit(db_url).path.lstrip("/")
    if not db_name or "test" not in db_name.lower():
        pytest.skip("Integration test requires a dedicated test database")

    # Create dedicated engine and session factory for this test
    engine = create_async_engine(db_url, echo=False)
    SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Recreate schema for isolation
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Use a single session for seeding and API requests
    session = SessionLocal()
    # Seed required reference data
    intensity_unit = IntensityUnit(name="Pounds", abbreviation="lb")
    workout_type = WorkoutType(name="Strength", description="Strength training")
    session.add_all([intensity_unit, workout_type])
    await session.flush()

    exercise_type = ExerciseType(
        name="Integration Exercise",
        description="Used for routines integration test",
        default_intensity_unit=intensity_unit.id,
    )
    session.add(exercise_type)
    await session.flush()

    # Create a test user and override current_active_user to return it
    user = User(
        email="routines-test@example.com",
        hashed_password="not-used-in-tests",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    session.add(user)
    await session.flush()

    async def override_user():
        return user

    app.dependency_overrides[current_active_user] = override_user

    async def override_db():
        yield session

    app.dependency_overrides[get_async_session] = override_db

    try:
        payload = {
            "name": "Integration Routine",
            "description": "Created via integration test",
            "workout_type_id": workout_type.id,
            "exercise_templates": [
                {
                    "exercise_type_id": exercise_type.id,
                    "set_templates": [
                        {
                            "reps": 10,
                            "intensity": 50.0,
                            "intensity_unit_id": intensity_unit.id,
                        },
                        {
                            "reps": 8,
                            "intensity": 60.0,
                            "intensity_unit_id": intensity_unit.id,
                        },
                    ],
                }
            ],
        }

        # Create the routine (recipe)
        async with AsyncClient(app=app, base_url="http://test") as client:
            resp = await client.post(f"{settings.API_PREFIX}/routines/", json=payload)
        assert resp.status_code == 201, resp.text

        data = resp.json()
        assert data["name"] == payload["name"]
        assert data["workout_type_id"] == workout_type.id
        assert isinstance(data.get("id"), int)

        # Validate nested structure
        assert len(data["exercise_templates"]) == 1
        tpl = data["exercise_templates"][0]
        assert tpl["exercise_type_id"] == exercise_type.id
        assert len(tpl["set_templates"]) == 2

        first_set = tpl["set_templates"][0]
        assert first_set["reps"] == 10
        assert first_set["intensity_unit_id"] == intensity_unit.id
        # Ensure joined intensity unit is present in read model
        assert first_set.get("intensity_unit", {}).get("id") == intensity_unit.id

        # Verify GET list includes the created routine
        async with AsyncClient(app=app, base_url="http://test") as client:
            list_resp = await client.get(
                f"{settings.API_PREFIX}/routines/?offset=0&limit=10"
            )
        assert list_resp.status_code == 200, list_resp.text
        items = list_resp.json()
        assert any(item["id"] == data["id"] for item in items)

    finally:
        # Clean up dependency override and dispose engine/session
        app.dependency_overrides.pop(current_active_user, None)
        app.dependency_overrides.pop(get_async_session, None)
        await session.close()
        await engine.dispose()
