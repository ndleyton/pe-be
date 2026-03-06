import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select, func
from src.recipes.service import recipe_service
from src.recipes.models import Recipe, ExerciseTemplate, SetTemplate
from src.exercises.models import ExerciseType, IntensityUnit
from src.exercises.models import Exercise
from src.workouts.models import WorkoutType
from src.users.models import User


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_workout_from_recipe_success(db_session: AsyncSession):
    """Service creates a workout from a recipe with nested templates."""
    wt = WorkoutType(name="Strength Svc", description="desc")
    iu = IntensityUnit(name="Kilograms", abbreviation="kg")
    db_session.add_all([wt, iu])
    await db_session.flush()

    et = ExerciseType(
        name="Svc Exercise", description="x", default_intensity_unit=iu.id
    )
    db_session.add(et)
    await db_session.flush()

    user = User(
        email="svc@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    # Create a recipe with one exercise template and two set templates
    r = Recipe(name="Svc Recipe", workout_type_id=wt.id, creator_id=user.id)
    db_session.add(r)
    await db_session.flush()

    etmpl = ExerciseTemplate(exercise_type_id=et.id, recipe_id=r.id)
    db_session.add(etmpl)
    await db_session.flush()

    db_session.add_all(
        [
            SetTemplate(
                reps=12,
                intensity=30.0,
                intensity_unit_id=iu.id,
                exercise_template_id=etmpl.id,
            ),
            SetTemplate(
                reps=10,
                intensity=35.0,
                intensity_unit_id=iu.id,
                exercise_template_id=etmpl.id,
            ),
        ]
    )
    await db_session.commit()

    # Act
    workout = await recipe_service.create_workout_from_recipe(db_session, user.id, r.id)

    # Assert workout created
    assert workout is not None
    assert workout.workout_type_id == wt.id

    # Verify via explicit queries to avoid async lazy-load in tests
    res = await db_session.execute(
        select(func.count())
        .select_from(Exercise)
        .where(Exercise.workout_id == workout.id)
    )
    exercise_count = res.scalar()
    assert exercise_count == 1

    res2 = await db_session.execute(
        select(Exercise.id).where(Exercise.workout_id == workout.id)
    )
    ex_id = res2.scalar_one()

    from src.exercise_sets.models import ExerciseSet

    res3 = await db_session.execute(
        select(func.count())
        .select_from(ExerciseSet)
        .where(ExerciseSet.exercise_id == ex_id)
    )
    set_count = res3.scalar()
    assert set_count == 2


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_workout_from_recipe_not_accessible_raises(
    db_session: AsyncSession,
):
    """Service raises ValueError when recipe not accessible or missing."""
    # Two users, recipe owned by one
    wt = WorkoutType(name="Strength Svc2", description="desc")
    db_session.add(wt)
    await db_session.flush()

    u1 = User(
        email="a@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    u2 = User(
        email="b@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add_all([u1, u2])
    await db_session.flush()

    r = Recipe(name="Private", workout_type_id=wt.id, creator_id=u1.id)
    db_session.add(r)
    await db_session.commit()

    # Different user cannot access -> ValueError
    with pytest.raises(ValueError):
        await recipe_service.create_workout_from_recipe(db_session, u2.id, r.id)

    # Non-existent id also raises
    with pytest.raises(ValueError):
        await recipe_service.create_workout_from_recipe(db_session, u1.id, 999999)
