from typing import List
from fastapi import Depends, APIRouter, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.routines.schemas import RecipeRead, RecipeCreate, RecipeUpdate
from src.workouts.schemas import WorkoutRead
from src.routines.service import recipe_service
from src.core.database import get_async_session
from src.users.router import current_active_user
from src.users.models import User

# NOTE: Recipes are exposed to users as "Routines" in the API and UI
# The database table and model names remain as "recipes" for consistency
router = APIRouter(tags=["routines"])


@router.get("/", response_model=List[RecipeRead])
async def get_user_recipes(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
    offset: int = 0,
    limit: int = 100,
):
    """Get all routines for the authenticated user"""
    return await recipe_service.get_user_recipes(session, user.id, offset, limit)


@router.get("/{recipe_id}", response_model=RecipeRead)
async def get_recipe(
    recipe_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get a specific routine by ID"""
    recipe = await recipe_service.get_recipe(session, recipe_id, user.id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Routine not found")
    return recipe


@router.post("/", response_model=RecipeRead, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    recipe_in: RecipeCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new routine"""
    return await recipe_service.create_recipe(session, recipe_in, user.id)


@router.put("/{recipe_id}", response_model=RecipeRead)
async def update_recipe(
    recipe_id: int,
    recipe_in: RecipeUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Update an existing routine"""
    recipe = await recipe_service.update_recipe(session, recipe_id, recipe_in, user.id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Routine not found")
    return recipe


@router.post(
    "/{recipe_id}/start",
    response_model=WorkoutRead,
    status_code=status.HTTP_201_CREATED,
)
async def start_workout_from_recipe(
    recipe_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a workout from a saved routine (recipe) and return it."""
    try:
        workout = await recipe_service.create_workout_from_recipe(
            session, user.id, recipe_id
        )
        return workout
    except ValueError:
        raise HTTPException(status_code=404, detail="Routine not found")


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Delete a routine"""
    # Idempotent delete: 204 whether missing or not owned
    await recipe_service.delete_recipe(session, recipe_id, user.id)
