import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from urllib.parse import urlsplit

from src.main import app
from src.core.config import settings
from src.core.database import Base, get_async_session
from src.users.models import User
from src.users.router import current_active_user
from src.workouts.models import WorkoutType
from src.recipes.models import Recipe


@pytest.mark.integration
@pytest.mark.asyncio
async def test_visibility_filtering_lists_mine_and_public():
    """GET /routines returns user-owned and public, excludes others' private (and link_only)."""
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    db_name = urlsplit(db_url).path.lstrip("/")
    if not db_name or "test" not in db_name.lower():
        pytest.skip("Integration test requires a dedicated test database")

    engine = create_async_engine(db_url, echo=False)
    SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session: AsyncSession = SessionLocal()

    # Seed: one workout type (recipes require workout_type_id)
    wt = WorkoutType(name="Strength", description="Strength training")
    session.add(wt)
    await session.flush()

    # Seed users
    me = User(
        email="visibility-me@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    other = User(
        email="visibility-other@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    session.add_all([me, other])
    await session.flush()

    # Seed recipes: mine (private), other's private, other's public, other's link_only
    r_mine_private = Recipe(
        name="Mine Private",
        workout_type_id=wt.id,
        creator_id=me.id,
        visibility=Recipe.RecipeVisibility.PRIVATE,
        is_readonly=False,
    )
    r_other_private = Recipe(
        name="Other Private",
        workout_type_id=wt.id,
        creator_id=other.id,
        visibility=Recipe.RecipeVisibility.PRIVATE,
        is_readonly=False,
    )
    r_other_public = Recipe(
        name="Other Public",
        workout_type_id=wt.id,
        creator_id=other.id,
        visibility=Recipe.RecipeVisibility.PUBLIC,
        is_readonly=True,
    )
    r_other_link = Recipe(
        name="Other Link Only",
        workout_type_id=wt.id,
        creator_id=other.id,
        visibility=Recipe.RecipeVisibility.LINK_ONLY,
        is_readonly=True,
    )
    session.add_all([r_mine_private, r_other_private, r_other_public, r_other_link])
    await session.commit()

    async def override_user():
        return me

    async def override_db():
        yield session

    app.dependency_overrides[current_active_user] = override_user
    app.dependency_overrides[get_async_session] = override_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                f"{settings.API_PREFIX}/routines/?offset=0&limit=50"
            )
        assert resp.status_code == 200, resp.text
        items = resp.json()
        names = {item["name"] for item in items}

        # Should include my private and other's public
        assert "Mine Private" in names
        assert "Other Public" in names

        # Should exclude other's private and link_only from listing
        assert "Other Private" not in names
        assert "Other Link Only" not in names
    finally:
        app.dependency_overrides.pop(current_active_user, None)
        app.dependency_overrides.pop(get_async_session, None)
        await session.close()
        await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_visibility_get_by_id_allows_public_blocks_private():
    """GET /routines/{id}: accessible for public; 404 for others' private."""
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    db_name = urlsplit(db_url).path.lstrip("/")
    if not db_name or "test" not in db_name.lower():
        pytest.skip("Integration test requires a dedicated test database")

    engine = create_async_engine(db_url, echo=False)
    SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session: AsyncSession = SessionLocal()

    wt = WorkoutType(name="Strength", description="Strength training")
    session.add(wt)
    await session.flush()

    me = User(
        email="visibility-me2@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    other = User(
        email="visibility-other2@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    session.add_all([me, other])
    await session.flush()

    r_other_private = Recipe(
        name="Other Private 2",
        workout_type_id=wt.id,
        creator_id=other.id,
        visibility=Recipe.RecipeVisibility.PRIVATE,
        is_readonly=False,
    )
    r_other_public = Recipe(
        name="Other Public 2",
        workout_type_id=wt.id,
        creator_id=other.id,
        visibility=Recipe.RecipeVisibility.PUBLIC,
        is_readonly=True,
    )
    session.add_all([r_other_private, r_other_public])
    await session.commit()

    async def override_user():
        return me

    async def override_db():
        yield session

    app.dependency_overrides[current_active_user] = override_user
    app.dependency_overrides[get_async_session] = override_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Public accessible
            r1 = await client.get(f"{settings.API_PREFIX}/routines/{r_other_public.id}")
            assert r1.status_code == 200, r1.text
            assert r1.json()["name"] == "Other Public 2"

            # Private not accessible
            r2 = await client.get(
                f"{settings.API_PREFIX}/routines/{r_other_private.id}"
            )
            assert r2.status_code == 404
    finally:
        app.dependency_overrides.pop(current_active_user, None)
        app.dependency_overrides.pop(get_async_session, None)
        await session.close()
        await engine.dispose()
