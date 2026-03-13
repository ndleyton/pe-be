import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.users.models import User
from src.workouts.models import WorkoutType
from src.routines.models import Routine
from src.routines import crud


@pytest.mark.integration
@pytest.mark.asyncio
async def test_visibility_filtering_lists_mine_and_public(db_session: AsyncSession):
    """CRUD: list returns user-owned and public, excludes others' private/link_only."""
    # Seed: one workout type (recipes require workout_type_id)
    wt = WorkoutType(name="Strength", description="Strength training")
    db_session.add(wt)
    await db_session.flush()

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
    db_session.add_all([me, other])
    await db_session.flush()

    # Seed recipes: mine (private), other's private, other's public, other's link_only
    r_mine_private = Routine(
        name="Mine Private",
        workout_type_id=wt.id,
        creator_id=me.id,
        visibility=Routine.RoutineVisibility.private,
        is_readonly=False,
    )
    r_other_private = Routine(
        name="Other Private",
        workout_type_id=wt.id,
        creator_id=other.id,
        visibility=Routine.RoutineVisibility.private,
        is_readonly=False,
    )
    r_other_public = Routine(
        name="Other Public",
        workout_type_id=wt.id,
        creator_id=other.id,
        visibility=Routine.RoutineVisibility.public,
        is_readonly=True,
    )
    r_other_link = Routine(
        name="Other Link Only",
        workout_type_id=wt.id,
        creator_id=other.id,
        visibility=Routine.RoutineVisibility.link_only,
        is_readonly=True,
    )
    db_session.add_all([r_mine_private, r_other_private, r_other_public, r_other_link])
    await db_session.flush()

    # Call CRUD directly
    results = await crud.get_user_routines(
        db_session, user_id=me.id, offset=0, limit=50
    )
    names = {r.name for r in results}

    assert "Mine Private" in names
    assert "Other Public" in names
    assert "Other Private" not in names
    assert "Other Link Only" not in names


@pytest.mark.integration
@pytest.mark.asyncio
async def test_visibility_get_by_id_allows_public_blocks_private(
    db_session: AsyncSession,
):
    """CRUD: get by id returns public to others; None for others' private."""
    wt = WorkoutType(name="Strength", description="Strength training")
    db_session.add(wt)
    await db_session.flush()

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
    db_session.add_all([me, other])
    await db_session.flush()

    r_other_private = Routine(
        name="Other Private 2",
        workout_type_id=wt.id,
        creator_id=other.id,
        visibility=Routine.RoutineVisibility.private,
        is_readonly=False,
    )
    r_other_public = Routine(
        name="Other Public 2",
        workout_type_id=wt.id,
        creator_id=other.id,
        visibility=Routine.RoutineVisibility.public,
        is_readonly=True,
    )
    db_session.add_all([r_other_private, r_other_public])
    await db_session.flush()

    # Public accessible
    got = await crud.get_routine_by_id_for_user(db_session, r_other_public.id, me.id)
    assert got is not None
    assert got.name == "Other Public 2"

    # Private not accessible
    got2 = await crud.get_routine_by_id_for_user(db_session, r_other_private.id, me.id)
    assert got2 is None
