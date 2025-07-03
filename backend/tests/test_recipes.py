import pytest
import anyio
from fastapi.testclient import TestClient
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.core.config import settings
from src.recipes.models import Recipe, ExerciseTemplate, SetTemplate
from src.recipes.crud import (
    create_recipe, 
    get_recipe_by_id, 
    get_user_recipes,
    update_recipe,
    delete_recipe
)
from src.recipes.schemas import RecipeCreate, RecipeUpdate, ExerciseTemplateCreate, SetTemplateCreate
from src.exercises.models import ExerciseType, IntensityUnit
from src.workouts.models import WorkoutType
from src.users.models import User


@pytest.mark.skip(reason="Async integration tests disabled due to fixture scope issues. Use test_recipes_simple.py and test_recipe_crud_unit.py instead.")
class TestRecipesCRUD:
    """Test Recipe CRUD operations.
    
    NOTE: These async integration tests are currently disabled due to fixture scope issues.
    See test_recipes_simple.py and test_recipe_crud_unit.py for working unit tests.
    """

    @pytest.fixture
    @pytest.mark.anyio
    async def test_user(self, db_session: AsyncSession):
        """Create a test user."""
        user = User(
            email="test@example.com",
            hashed_password="hashed_password",
            is_active=True,
            is_superuser=False,
            is_verified=True,
            name="Test User"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    @pytest.mark.anyio
    async def test_workout_type(self, db_session: AsyncSession):
        """Create a test workout type."""
        workout_type = WorkoutType(name="Test Workout Type")
        db_session.add(workout_type)
        await db_session.commit()
        await db_session.refresh(workout_type)
        return workout_type

    @pytest.fixture
    @pytest.mark.anyio
    async def test_exercise_type(self, db_session: AsyncSession):
        """Create a test exercise type."""
        exercise_type = ExerciseType(
            name="Test Exercise",
            description="Test exercise description",
            default_intensity_unit=1,
            times_used=0
        )
        db_session.add(exercise_type)
        await db_session.commit()
        await db_session.refresh(exercise_type)
        return exercise_type

    @pytest.fixture
    @pytest.mark.anyio
    async def test_intensity_unit(self, db_session: AsyncSession):
        """Create a test intensity unit."""
        intensity_unit = IntensityUnit(
            name="Kilograms",
            abbreviation="kg"
        )
        db_session.add(intensity_unit)
        await db_session.commit()
        await db_session.refresh(intensity_unit)
        return intensity_unit

    @pytest.fixture
    async def recipe_create_data(self, test_workout_type, test_exercise_type, test_intensity_unit):
        """Create test recipe data."""
        return RecipeCreate(
            name="Test Recipe",
            description="A test recipe for workouts",
            workout_type_id=test_workout_type.id,
            exercise_templates=[
                ExerciseTemplateCreate(
                    exercise_type_id=test_exercise_type.id,
                    set_templates=[
                        SetTemplateCreate(
                            reps=10,
                            intensity=50.0,
                            intensity_unit_id=test_intensity_unit.id
                        ),
                        SetTemplateCreate(
                            reps=8,
                            intensity=60.0,
                            intensity_unit_id=test_intensity_unit.id
                        )
                    ]
                )
            ]
        )

    @pytest.mark.anyio
    @pytest.mark.anyio
    async def test_create_recipe(self, db_session: AsyncSession, test_user, recipe_create_data):
        """Test creating a recipe."""
        recipe = await create_recipe(db_session, recipe_create_data, test_user.id)
        
        assert recipe is not None
        assert recipe.name == "Test Recipe"
        assert recipe.description == "A test recipe for workouts"
        assert recipe.creator_id == test_user.id
        assert recipe.workout_type_id == recipe_create_data.workout_type_id
        assert len(recipe.exercise_templates) == 1
        assert len(recipe.exercise_templates[0].set_templates) == 2

    @pytest.mark.anyio
    async def test_get_recipe_by_id(self, db_session: AsyncSession, test_user, recipe_create_data):
        """Test getting a recipe by ID."""
        # Create a recipe first
        created_recipe = await create_recipe(db_session, recipe_create_data, test_user.id)
        
        # Retrieve it
        retrieved_recipe = await get_recipe_by_id(db_session, created_recipe.id, test_user.id)
        
        assert retrieved_recipe is not None
        assert retrieved_recipe.id == created_recipe.id
        assert retrieved_recipe.name == "Test Recipe"
        assert retrieved_recipe.creator_id == test_user.id
        assert len(retrieved_recipe.exercise_templates) == 1

    @pytest.mark.anyio
    async def test_get_recipe_by_id_wrong_user(self, db_session: AsyncSession, test_user, recipe_create_data):
        """Test getting a recipe by ID with wrong user (should return None)."""
        # Create a recipe
        created_recipe = await create_recipe(db_session, recipe_create_data, test_user.id)
        
        # Try to retrieve with different user ID
        retrieved_recipe = await get_recipe_by_id(db_session, created_recipe.id, 999)
        
        assert retrieved_recipe is None

    @pytest.mark.anyio
    async def test_get_user_recipes(self, db_session: AsyncSession, test_user, recipe_create_data):
        """Test getting all recipes for a user."""
        # Create multiple recipes
        recipe1 = await create_recipe(db_session, recipe_create_data, test_user.id)
        
        # Create second recipe with different name
        recipe_create_data.name = "Second Recipe"
        recipe2 = await create_recipe(db_session, recipe_create_data, test_user.id)
        
        # Retrieve all user recipes
        user_recipes = await get_user_recipes(db_session, test_user.id)
        
        assert len(user_recipes) == 2
        recipe_names = [recipe.name for recipe in user_recipes]
        assert "Test Recipe" in recipe_names
        assert "Second Recipe" in recipe_names

    @pytest.mark.anyio
    async def test_get_user_recipes_empty(self, db_session: AsyncSession, test_user):
        """Test getting recipes for user with no recipes."""
        user_recipes = await get_user_recipes(db_session, test_user.id)
        assert len(user_recipes) == 0

    @pytest.mark.anyio
    async def test_update_recipe(self, db_session: AsyncSession, test_user, recipe_create_data):
        """Test updating a recipe."""
        # Create a recipe
        created_recipe = await create_recipe(db_session, recipe_create_data, test_user.id)
        
        # Update it
        update_data = RecipeUpdate(
            name="Updated Recipe Name",
            description="Updated description"
        )
        updated_recipe = await update_recipe(db_session, created_recipe.id, update_data, test_user.id)
        
        assert updated_recipe is not None
        assert updated_recipe.name == "Updated Recipe Name"
        assert updated_recipe.description == "Updated description"
        assert updated_recipe.id == created_recipe.id

    @pytest.mark.anyio
    async def test_update_recipe_wrong_user(self, db_session: AsyncSession, test_user, recipe_create_data):
        """Test updating a recipe with wrong user (should return None)."""
        # Create a recipe
        created_recipe = await create_recipe(db_session, recipe_create_data, test_user.id)
        
        # Try to update with different user ID
        update_data = RecipeUpdate(name="Hacked Recipe")
        updated_recipe = await update_recipe(db_session, created_recipe.id, update_data, 999)
        
        assert updated_recipe is None

    @pytest.mark.anyio
    async def test_delete_recipe(self, db_session: AsyncSession, test_user, recipe_create_data):
        """Test deleting a recipe."""
        # Create a recipe
        created_recipe = await create_recipe(db_session, recipe_create_data, test_user.id)
        
        # Verify it exists
        found_recipe = await get_recipe_by_id(db_session, created_recipe.id, test_user.id)
        assert found_recipe is not None
        
        # Delete it
        delete_result = await delete_recipe(db_session, created_recipe.id, test_user.id)
        assert delete_result is True
        
        # Verify it's gone
        deleted_recipe = await get_recipe_by_id(db_session, created_recipe.id, test_user.id)
        assert deleted_recipe is None

    @pytest.mark.anyio
    async def test_delete_recipe_wrong_user(self, db_session: AsyncSession, test_user, recipe_create_data):
        """Test deleting a recipe with wrong user (should return False)."""
        # Create a recipe
        created_recipe = await create_recipe(db_session, recipe_create_data, test_user.id)
        
        # Try to delete with different user ID
        delete_result = await delete_recipe(db_session, created_recipe.id, 999)
        assert delete_result is False
        
        # Verify it still exists
        found_recipe = await get_recipe_by_id(db_session, created_recipe.id, test_user.id)
        assert found_recipe is not None

    @pytest.mark.anyio
    async def test_delete_nonexistent_recipe(self, db_session: AsyncSession, test_user):
        """Test deleting a recipe that doesn't exist."""
        delete_result = await delete_recipe(db_session, 999, test_user.id)
        assert delete_result is False

    @pytest.mark.anyio
    async def test_recipe_cascade_delete(self, db_session: AsyncSession, test_user, recipe_create_data):
        """Test that deleting a recipe cascades to exercise and set templates."""
        # Create a recipe with templates
        created_recipe = await create_recipe(db_session, recipe_create_data, test_user.id)
        
        # Verify templates exist
        exercise_template_result = await db_session.execute(
            select(ExerciseTemplate).where(ExerciseTemplate.recipe_id == created_recipe.id)
        )
        exercise_templates = exercise_template_result.scalars().all()
        assert len(exercise_templates) == 1
        
        set_template_result = await db_session.execute(
            select(SetTemplate).where(SetTemplate.exercise_template_id == exercise_templates[0].id)
        )
        set_templates = set_template_result.scalars().all()
        assert len(set_templates) == 2
        
        # Delete the recipe
        await delete_recipe(db_session, created_recipe.id, test_user.id)
        
        # Verify templates are gone
        exercise_template_result = await db_session.execute(
            select(ExerciseTemplate).where(ExerciseTemplate.recipe_id == created_recipe.id)
        )
        exercise_templates = exercise_template_result.scalars().all()
        assert len(exercise_templates) == 0
        
        set_template_result = await db_session.execute(
            select(SetTemplate).where(SetTemplate.exercise_template_id.in_([et.id for et in exercise_templates]))
        )
        set_templates = set_template_result.scalars().all()
        assert len(set_templates) == 0


class TestRecipesAPI:
    """Test Recipe API endpoints."""
    
    def test_get_recipes_unauthorized(self, client: TestClient):
        """Test getting recipes without authentication."""
        response = client.get(f"{settings.API_PREFIX}/recipes")
        assert response.status_code == 401
    
    def test_create_recipe_unauthorized(self, client: TestClient):
        """Test creating recipe without authentication."""
        recipe_data = {
            "name": "Test Recipe",
            "workout_type_id": 1,
            "exercise_templates": []
        }
        response = client.post(f"{settings.API_PREFIX}/recipes", json=recipe_data)
        assert response.status_code == 401
    
    def test_get_recipe_by_id_unauthorized(self, client: TestClient):
        """Test getting recipe by ID without authentication."""
        response = client.get(f"{settings.API_PREFIX}/recipes/1")
        assert response.status_code == 401
    
    def test_update_recipe_unauthorized(self, client: TestClient):
        """Test updating recipe without authentication."""
        update_data = {"name": "Updated Recipe"}
        response = client.put(f"{settings.API_PREFIX}/recipes/1", json=update_data)
        assert response.status_code == 401
    
    def test_delete_recipe_unauthorized(self, client: TestClient):
        """Test deleting recipe without authentication."""
        response = client.delete(f"{settings.API_PREFIX}/recipes/1")
        assert response.status_code == 401
    
    # Note: Add authenticated API tests once you have test user authentication fixtures
    # These would test the full API endpoints with proper authentication headers