from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from datetime import datetime, timezone

from src.recipes import crud
from src.recipes.schemas import (
    RecipeCreate,
    RecipeRead,
    RecipeUpdate,
    AdminRecipeCreate,
)
from src.workouts.schemas import WorkoutCreate
from src.workouts.models import Workout
from src.recipes.models import Recipe
from src.workouts.crud import create_workout, get_workout_by_id
from src.exercises.schemas import ExerciseCreate
from src.exercise_sets.schemas import ExerciseSetCreate
from src.exercises.crud import create_exercise
from src.exercise_sets.crud import create_exercise_set


class RecipeService:
    """Service layer for recipe operations"""

    async def get_user_recipes(
        self, session: AsyncSession, user_id: int, offset: int, limit: int
    ) -> List[RecipeRead]:
        """Get all recipes for a user with pagination"""
        recipes = await crud.get_user_recipes(session, user_id, offset, limit)
        return [RecipeRead.model_validate(recipe) for recipe in recipes]

    async def get_recipe(
        self, session: AsyncSession, recipe_id: int, user_id: int
    ) -> Optional[RecipeRead]:
        """Get a specific recipe by ID"""
        recipe = await crud.get_recipe_by_id_for_user(session, recipe_id, user_id)
        if recipe:
            return RecipeRead.model_validate(recipe)
        return None

    async def create_recipe(
        self, session: AsyncSession, recipe_data: RecipeCreate, user_id: int
    ) -> RecipeRead:
        """Create a new recipe"""
        recipe = await crud.create_recipe(session, recipe_data, user_id)
        return RecipeRead.model_validate(recipe)

    async def create_recipe_admin(
        self, session: AsyncSession, recipe_data: AdminRecipeCreate, user_id: int
    ) -> RecipeRead:
        """Create a new recipe with admin-only fields"""
        recipe = await crud.create_recipe_admin(session, recipe_data, user_id)
        return RecipeRead.model_validate(recipe)

    async def update_recipe(
        self,
        session: AsyncSession,
        recipe_id: int,
        recipe_data: RecipeUpdate,
        user_id: int,
    ) -> Optional[RecipeRead]:
        """Update an existing recipe"""
        recipe = await crud.update_recipe(session, recipe_id, recipe_data, user_id)
        if recipe:
            return RecipeRead.model_validate(recipe)
        return None

    async def delete_recipe(
        self, session: AsyncSession, recipe_id: int, user_id: int
    ) -> bool:
        """Delete a recipe idempotently (no ownership info leak).

        Uses a conditional DELETE filtered by `creator_id` to ensure
        repeated calls are no-ops and to avoid extra SELECTs.
        """
        await session.execute(
            delete(Recipe).where(Recipe.id == recipe_id, Recipe.creator_id == user_id)
        )
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        return True

    async def create_workout_from_recipe(
        self, session: AsyncSession, user_id: int, recipe_id: int
    ) -> Workout:
        """Instantiate a Workout (with exercises and sets) from a saved recipe.

        - Creates a new workout using the recipe's name and workout_type_id
        - For each exercise template:
          - Creates the exercise attached to the workout
          - Creates its sets with reps/intensity/unit from the template, marked as not done
        """
        # Load recipe with relationships and ensure ownership
        recipe = await crud.get_recipe_by_id_for_user(session, recipe_id, user_id)
        if recipe is None:
            raise ValueError("Recipe not found or not accessible")

        # 1) Create the workout
        workout = await create_workout(
            session,
            WorkoutCreate(
                name=recipe.name,
                notes=None,
                start_time=datetime.now(timezone.utc),
                workout_type_id=recipe.workout_type_id,
            ),
            user_id,
        )

        # 2) Create exercises and sets from templates
        for exercise_template in recipe.exercise_templates:
            exercise = await create_exercise(
                session,
                ExerciseCreate(
                    timestamp=datetime.now(timezone.utc),
                    notes=None,
                    exercise_type_id=exercise_template.exercise_type_id,
                    workout_id=workout.id,
                ),
            )

            for set_template in exercise_template.set_templates:
                await create_exercise_set(
                    session,
                    ExerciseSetCreate(
                        reps=set_template.reps,
                        intensity=set_template.intensity,
                        intensity_unit_id=set_template.intensity_unit_id,
                        rest_time_seconds=None,
                        exercise_id=exercise.id,
                        done=False,
                    ),
                )

        # Return the workout with relationships loaded
        return await get_workout_by_id(session, workout.id, user_id)


# Create a singleton instance
recipe_service = RecipeService()
