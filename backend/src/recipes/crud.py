from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from src.recipes.models import Recipe, ExerciseTemplate, SetTemplate
from src.recipes.schemas import RecipeCreate, RecipeUpdate, AdminRecipeCreate


async def get_recipe_by_id_for_user(
    session: AsyncSession, recipe_id: int, user_id: int
) -> Optional[Recipe]:
    """Get a recipe by ID with relationships loaded.

    Accessible when owned by the user OR marked public.
    """
    result = await session.execute(
        select(Recipe)
        .options(
            selectinload(Recipe.exercise_templates)
            .selectinload(ExerciseTemplate.set_templates)
            .selectinload(SetTemplate.intensity_unit),
            selectinload(Recipe.exercise_templates).selectinload(
                ExerciseTemplate.exercise_type
            ),
            selectinload(Recipe.workout_type),
        )
        .where(
            and_(
                Recipe.id == recipe_id,
                or_(
                    Recipe.creator_id == user_id,
                    Recipe.visibility == Recipe.RecipeVisibility.public,
                ),
            )
        )
    )
    return result.scalar_one_or_none()


async def get_user_recipe_by_id(
    session: AsyncSession, recipe_id: int, user_id: int
) -> Optional[Recipe]:
    """Get a recipe by ID with relationships loaded (user-owned only)."""
    result = await session.execute(
        select(Recipe)
        .options(
            selectinload(Recipe.exercise_templates)
            .selectinload(ExerciseTemplate.set_templates)
            .selectinload(SetTemplate.intensity_unit),
            selectinload(Recipe.exercise_templates).selectinload(
                ExerciseTemplate.exercise_type
            ),
            selectinload(Recipe.workout_type),
        )
        .where(and_(Recipe.id == recipe_id, Recipe.creator_id == user_id))
    )
    return result.scalar_one_or_none()


async def get_user_recipes(
    session: AsyncSession, user_id: int, offset: int = 0, limit: int = 100
) -> List[Recipe]:
    """Get all recipes for a specific user with pagination"""
    result = await session.execute(
        select(Recipe)
        .options(
            selectinload(Recipe.exercise_templates)
            .selectinload(ExerciseTemplate.set_templates)
            .selectinload(SetTemplate.intensity_unit),
            selectinload(Recipe.exercise_templates).selectinload(
                ExerciseTemplate.exercise_type
            ),
            selectinload(Recipe.workout_type),
        )
        .where(
            or_(
                Recipe.creator_id == user_id,
                Recipe.visibility == Recipe.RecipeVisibility.public,
            )
        )
        .order_by(Recipe.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


async def create_recipe(
    session: AsyncSession, recipe_data: RecipeCreate, user_id: int
) -> Recipe:
    """Create a new recipe with exercise and set templates"""
    # Create the recipe
    recipe = Recipe(
        name=recipe_data.name,
        description=recipe_data.description,
        workout_type_id=recipe_data.workout_type_id,
        creator_id=user_id,
    )
    session.add(recipe)
    await session.flush()  # Get the recipe ID

    # Create exercise templates
    for exercise_template_data in recipe_data.exercise_templates:
        exercise_template = ExerciseTemplate(
            exercise_type_id=exercise_template_data.exercise_type_id,
            recipe_id=recipe.id,
        )
        session.add(exercise_template)
        await session.flush()  # Get the exercise template ID

        # Create set templates
        for set_template_data in exercise_template_data.set_templates:
            set_template = SetTemplate(
                reps=set_template_data.reps,
                intensity=set_template_data.intensity,
                intensity_unit_id=set_template_data.intensity_unit_id,
                exercise_template_id=exercise_template.id,
            )
            session.add(set_template)

    await session.commit()
    await session.refresh(recipe)

    # Return the recipe with all relationships loaded
    return await get_user_recipe_by_id(session, recipe.id, user_id)


async def create_recipe_admin(
    session: AsyncSession, recipe_data: AdminRecipeCreate, user_id: int
) -> Recipe:
    """Create a new recipe with admin controls for visibility and read-only.

    Mirrors create_recipe but allows setting `visibility` and `is_readonly`.
    """
    # Base fields
    new_recipe_kwargs = {
        "name": recipe_data.name,
        "description": recipe_data.description,
        "workout_type_id": recipe_data.workout_type_id,
        "creator_id": user_id,
    }

    # Optional admin-only fields
    if recipe_data.visibility is not None:
        new_recipe_kwargs["visibility"] = recipe_data.visibility
    if recipe_data.is_readonly is not None:
        new_recipe_kwargs["is_readonly"] = recipe_data.is_readonly

    # Create the recipe
    recipe = Recipe(**new_recipe_kwargs)
    session.add(recipe)
    await session.flush()  # Get the recipe ID

    # Create exercise templates
    for exercise_template_data in recipe_data.exercise_templates:
        exercise_template = ExerciseTemplate(
            exercise_type_id=exercise_template_data.exercise_type_id,
            recipe_id=recipe.id,
        )
        session.add(exercise_template)
        await session.flush()  # Get the exercise template ID

        # Create set templates
        for set_template_data in exercise_template_data.set_templates:
            set_template = SetTemplate(
                reps=set_template_data.reps,
                intensity=set_template_data.intensity,
                intensity_unit_id=set_template_data.intensity_unit_id,
                exercise_template_id=exercise_template.id,
            )
            session.add(set_template)

    await session.commit()
    await session.refresh(recipe)

    # Return with relationships loaded
    return await get_user_recipe_by_id(session, recipe.id, user_id)


async def update_recipe(
    session: AsyncSession, recipe_id: int, recipe_data: RecipeUpdate, user_id: int
) -> Optional[Recipe]:
    """Update a recipe (user-owned only)"""
    recipe = await get_user_recipe_by_id(session, recipe_id, user_id)
    if not recipe:
        return None

    # Update fields if provided
    if recipe_data.name is not None:
        recipe.name = recipe_data.name
    if recipe_data.description is not None:
        recipe.description = recipe_data.description
    if recipe_data.workout_type_id is not None:
        recipe.workout_type_id = recipe_data.workout_type_id

    await session.commit()
    await session.refresh(recipe)
    return recipe


async def delete_recipe(session: AsyncSession, recipe_id: int, user_id: int) -> bool:
    """Delete a recipe (user-owned only)"""
    recipe = await get_user_recipe_by_id(session, recipe_id, user_id)
    if not recipe:
        return False

    await session.delete(recipe)
    await session.commit()
    return True
