import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.recipes import crud
from src.recipes.models import Recipe
from src.recipes.schemas import (
    AdminRecipeCreate,
    ExerciseTemplateCreate,
    SetTemplateCreate,
)
from src.users.models import User
from src.exercises.models import ExerciseType, IntensityUnit
from src.workouts.models import WorkoutType


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_recipe_admin_sets_visibility_and_readonly(
    db_session: AsyncSession,
):
    """create_recipe_admin should honor visibility and is_readonly and create nested templates."""
    # Seed reference data
    wt = WorkoutType(name="Strength", description="desc")
    iu = IntensityUnit(name="Pounds", abbreviation="lb")
    db_session.add_all([wt, iu])
    await db_session.flush()

    et = ExerciseType(
        name="CRUD Admin Exercise", description="x", default_intensity_unit=iu.id
    )
    db_session.add(et)
    await db_session.flush()

    user = User(
        email="admin-crud@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    payload = AdminRecipeCreate(
        name="Admin Recipe",
        description="via admin",
        workout_type_id=wt.id,
        visibility=Recipe.RecipeVisibility.public,
        is_readonly=True,
        exercise_templates=[
            ExerciseTemplateCreate(
                exercise_type_id=et.id,
                set_templates=[
                    SetTemplateCreate(reps=5, intensity=45.0, intensity_unit_id=iu.id)
                ],
            )
        ],
    )

    # Act
    created = await crud.create_recipe_admin(db_session, payload, user.id)

    # Assert basic fields
    assert created.visibility == Recipe.RecipeVisibility.public
    assert created.is_readonly is True
    assert created.creator_id == user.id

    # Assert nested content
    assert len(created.exercise_templates) == 1
    tmpl = created.exercise_templates[0]
    assert tmpl.exercise_type_id == et.id
    assert len(tmpl.set_templates) == 1
    st = tmpl.set_templates[0]
    assert st.reps == 5
    assert st.intensity_unit_id == iu.id


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_and_delete_recipe_paths(db_session: AsyncSession):
    """Cover update success/None branches and delete True/False paths."""
    wt = WorkoutType(name="Strength2", description="desc")
    db_session.add(wt)
    await db_session.flush()

    owner = User(
        email="owner@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    other = User(
        email="other@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add_all([owner, other])
    await db_session.flush()

    # Create directly minimal recipe
    r = Recipe(name="To Update", workout_type_id=wt.id, creator_id=owner.id)
    db_session.add(r)
    await db_session.flush()

    # Update by non-owner -> None
    from src.recipes.schemas import RecipeUpdate

    got_none = await crud.update_recipe(
        db_session, r.id, RecipeUpdate(name="X"), other.id
    )
    assert got_none is None

    # Update by owner -> changed
    updated = await crud.update_recipe(
        db_session,
        r.id,
        RecipeUpdate(name="Updated", description="d", workout_type_id=wt.id),
        owner.id,
    )
    assert (
        updated is not None and updated.name == "Updated" and updated.description == "d"
    )

    # Delete by non-owner -> False
    deleted = await crud.delete_recipe(db_session, r.id, other.id)
    assert deleted is False

    # Delete by owner -> True
    deleted2 = await crud.delete_recipe(db_session, r.id, owner.id)
    assert deleted2 is True
