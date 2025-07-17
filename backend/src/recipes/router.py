from typing import List
from fastapi import Depends, APIRouter, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.recipes.schemas import RecipeRead, RecipeCreate, RecipeUpdate
from src.recipes.service import recipe_service
from src.core.database import get_async_session
from src.users.router import current_active_user
from src.users.models import User

router = APIRouter(tags=["recipes"])


@router.get("/", response_model=List[RecipeRead])
async def get_user_recipes(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get all recipes for the authenticated user"""
    return await recipe_service.get_user_recipes(session, user.id)


@router.get("/{recipe_id}", response_model=RecipeRead)
async def get_recipe(
    recipe_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get a specific recipe by ID"""
    recipe = await recipe_service.get_recipe(session, recipe_id, user.id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.post("/", response_model=RecipeRead, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    recipe_in: RecipeCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new recipe"""
    return await recipe_service.create_recipe(session, recipe_in, user.id)


@router.put("/{recipe_id}", response_model=RecipeRead)
async def update_recipe(
    recipe_id: int,
    recipe_in: RecipeUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Update an existing recipe"""
    recipe = await recipe_service.update_recipe(session, recipe_id, recipe_in, user.id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Delete a recipe"""
    success = await recipe_service.delete_recipe(session, recipe_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Recipe not found")
