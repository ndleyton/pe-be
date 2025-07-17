from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from src.recipes import crud
from src.recipes.schemas import RecipeCreate, RecipeRead, RecipeUpdate


class RecipeService:
    """Service layer for recipe operations"""

    async def get_user_recipes(
        self, session: AsyncSession, user_id: int
    ) -> List[RecipeRead]:
        """Get all recipes for a user"""
        recipes = await crud.get_user_recipes(session, user_id)
        return [RecipeRead.from_orm(recipe) for recipe in recipes]

    async def get_recipe(
        self, session: AsyncSession, recipe_id: int, user_id: int
    ) -> Optional[RecipeRead]:
        """Get a specific recipe by ID"""
        recipe = await crud.get_recipe_by_id(session, recipe_id, user_id)
        if recipe:
            return RecipeRead.from_orm(recipe)
        return None

    async def create_recipe(
        self, session: AsyncSession, recipe_data: RecipeCreate, user_id: int
    ) -> RecipeRead:
        """Create a new recipe"""
        recipe = await crud.create_recipe(session, recipe_data, user_id)
        return RecipeRead.from_orm(recipe)

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
            return RecipeRead.from_orm(recipe)
        return None

    async def delete_recipe(
        self, session: AsyncSession, recipe_id: int, user_id: int
    ) -> bool:
        """Delete a recipe"""
        return await crud.delete_recipe(session, recipe_id, user_id)


# Create a singleton instance
recipe_service = RecipeService()
