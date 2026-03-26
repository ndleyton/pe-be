import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from src.users.models import User
from src.workouts.models import WorkoutType
from src.routines.models import Routine
from src.exercises.models import ExerciseType
from src.routines.models import ExerciseTemplate
from src.routines import crud


@pytest.mark.integration
@pytest.mark.asyncio
async def test_visibility_filtering_lists_mine_and_public(db_session: AsyncSession):
    """CRUD: list returns user-owned and public, excludes others' private/link_only."""
    # Seed: one workout type (routines require workout_type_id)
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

    # Seed routines: mine (private), other's private, other's public, other's link_only
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
    results = await crud.get_visible_routines(
        db_session, user_id=me.id, offset=0, limit=50
    )
    names = {r.name for r in results}

    assert "Mine Private" in names
    assert "Other Public" in names
    assert "Other Private" not in names
    assert "Other Link Only" not in names


@pytest.mark.integration
@pytest.mark.asyncio
async def test_visibility_filtering_lists_public_only_for_signed_out_viewer(
    db_session: AsyncSession,
):
    """CRUD: signed-out list returns only public routines."""
    wt = WorkoutType(name="Strength", description="Strength training")
    db_session.add(wt)
    await db_session.flush()

    owner = User(
        email="visibility-public-list@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(owner)
    await db_session.flush()

    db_session.add_all(
        [
            Routine(
                name="Owner Private",
                workout_type_id=wt.id,
                creator_id=owner.id,
                visibility=Routine.RoutineVisibility.private,
                is_readonly=False,
            ),
            Routine(
                name="Owner Public",
                workout_type_id=wt.id,
                creator_id=owner.id,
                visibility=Routine.RoutineVisibility.public,
                is_readonly=True,
            ),
            Routine(
                name="Owner Link Only",
                workout_type_id=wt.id,
                creator_id=owner.id,
                visibility=Routine.RoutineVisibility.link_only,
                is_readonly=True,
            ),
        ]
    )
    await db_session.flush()

    results = await crud.get_visible_routines(
        db_session, user_id=None, offset=0, limit=50
    )
    names = {r.name for r in results}

    assert names == {"Owner Public"}


@pytest.mark.integration
@pytest.mark.asyncio
async def test_visibility_get_by_id_allows_shareable_blocks_private(
    db_session: AsyncSession,
):
    """CRUD: get by id returns public/link_only to others; None for others' private."""
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
    r_other_link_only = Routine(
        name="Other Link Only 2",
        workout_type_id=wt.id,
        creator_id=other.id,
        visibility=Routine.RoutineVisibility.link_only,
        is_readonly=True,
    )
    db_session.add_all([r_other_private, r_other_public, r_other_link_only])
    await db_session.flush()

    # Public accessible
    got = await crud.get_routine_by_id_for_user(db_session, r_other_public.id, me.id)
    assert got is not None
    assert got.name == "Other Public 2"

    # Link-only accessible by direct id
    got_link_only = await crud.get_routine_by_id_for_user(
        db_session, r_other_link_only.id, me.id
    )
    assert got_link_only is not None
    assert got_link_only.name == "Other Link Only 2"

    # Private not accessible
    got2 = await crud.get_routine_by_id_for_user(db_session, r_other_private.id, me.id)
    assert got2 is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_visible_routines_summary_uses_stable_tiebreakers(
    db_session: AsyncSession,
):
    """Summary listing keeps tied name/created_at values in deterministic ID order."""
    wt = WorkoutType(name="Strength", description="Strength training")
    db_session.add(wt)
    await db_session.flush()

    owner = User(
        email="visibility-summary-order@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(owner)
    await db_session.flush()

    shared_created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    newest_created_at = datetime(2026, 1, 2, tzinfo=timezone.utc)

    alpha_first = Routine(
        name="Alpha",
        workout_type_id=wt.id,
        creator_id=owner.id,
        visibility=Routine.RoutineVisibility.public,
        is_readonly=True,
        created_at=shared_created_at,
    )
    alpha_second = Routine(
        name="Alpha",
        workout_type_id=wt.id,
        creator_id=owner.id,
        visibility=Routine.RoutineVisibility.public,
        is_readonly=True,
        created_at=shared_created_at,
    )
    newest = Routine(
        name="Beta",
        workout_type_id=wt.id,
        creator_id=owner.id,
        visibility=Routine.RoutineVisibility.public,
        is_readonly=True,
        created_at=newest_created_at,
    )
    gamma = Routine(
        name="Gamma",
        workout_type_id=wt.id,
        creator_id=owner.id,
        visibility=Routine.RoutineVisibility.public,
        is_readonly=True,
        created_at=shared_created_at,
    )
    db_session.add_all([alpha_first, alpha_second, newest, gamma])
    await db_session.flush()

    by_name = await crud.get_visible_routines_summary(
        db_session, user_id=None, offset=0, limit=10, order_by="name"
    )
    assert [routine["id"] for routine in by_name] == [
        alpha_first.id,
        alpha_second.id,
        newest.id,
        gamma.id,
    ]

    by_created_at = await crud.get_visible_routines_summary(
        db_session, user_id=None, offset=0, limit=10, order_by="createdAt"
    )
    assert [routine["id"] for routine in by_created_at] == [
        newest.id,
        alpha_first.id,
        alpha_second.id,
        gamma.id,
    ]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_visible_routines_summary_limits_preview_names_per_routine_in_sql(
    db_session: AsyncSession,
):
    """Summary preview includes at most five exercise names in template order."""
    wt = WorkoutType(name="Strength", description="Strength training")
    db_session.add(wt)
    await db_session.flush()

    owner = User(
        email="visibility-summary-preview@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(owner)
    await db_session.flush()

    routine = Routine(
        name="Preview Limit",
        workout_type_id=wt.id,
        creator_id=owner.id,
        visibility=Routine.RoutineVisibility.public,
        is_readonly=True,
    )
    db_session.add(routine)
    await db_session.flush()

    exercise_types = [
        ExerciseType(name=f"Exercise {index}", description=f"Description {index}")
        for index in range(1, 8)
    ]
    db_session.add_all(exercise_types)
    await db_session.flush()

    db_session.add_all(
        [
            ExerciseTemplate(
                routine_id=routine.id,
                exercise_type_id=exercise_type.id,
            )
            for exercise_type in exercise_types
        ]
    )
    await db_session.flush()

    summaries = await crud.get_visible_routines_summary(
        db_session, user_id=None, offset=0, limit=10, order_by="createdAt"
    )

    summary = next(item for item in summaries if item["id"] == routine.id)
    assert summary["exercise_count"] == 7
    assert summary["exercise_names_preview"] == [
        "Exercise 1",
        "Exercise 2",
        "Exercise 3",
        "Exercise 4",
        "Exercise 5",
    ]
