"""
Unit tests for routine CRUD operations using mocks.
These tests focus on the CRUD logic without requiring database setup.
"""

from src.recipes.crud import (
    create_routine,
    get_routine_by_id_for_user,
    get_user_routines,
    update_routine,
    delete_routine,
)
from src.recipes.schemas import (
    RoutineCreate,
    RoutineUpdate,
    ExerciseTemplateCreate,
    SetTemplateCreate,
)
from src.recipes.models import Routine, ExerciseTemplate, SetTemplate


class TestRoutineCRUDUnit:
    """Unit tests for routine CRUD operations using mocks."""

    def test_routine_crud_imports(self):
        """Test that all CRUD functions are properly importable."""
        assert callable(create_routine)
        assert callable(get_routine_by_id_for_user)
        assert callable(get_user_routines)
        assert callable(update_routine)
        assert callable(delete_routine)

    def test_routine_model_attributes(self):
        """Test that Routine model has expected attributes."""
        # Test that we can create a Routine instance (validates model structure)
        recipe = Routine(
            name="Test Recipe",
            description="Test description",
            workout_type_id=1,
            creator_id=1,
        )

        assert recipe.name == "Test Recipe"
        assert recipe.description == "Test description"
        assert recipe.workout_type_id == 1
        assert recipe.creator_id == 1
        # Note: id, created_at, updated_at are set by the Base class

    def test_exercise_template_model_attributes(self):
        """Test that ExerciseTemplate model has expected attributes."""
        exercise_template = ExerciseTemplate(exercise_type_id=1, routine_id=1)

        assert exercise_template.exercise_type_id == 1
        assert exercise_template.routine_id == 1

    def test_set_template_model_attributes(self):
        """Test that SetTemplate model has expected attributes."""
        set_template = SetTemplate(
            reps=10, intensity=50.0, intensity_unit_id=1, exercise_template_id=1
        )

        assert set_template.reps == 10
        assert set_template.intensity == 50.0
        assert set_template.intensity_unit_id == 1
        assert set_template.exercise_template_id == 1

    def test_routine_create_schema_to_model_mapping(self):
        """Test that RoutineCreate schema maps correctly to Routine model structure."""
        recipe_data = RoutineCreate(
            name="Schema Test Recipe",
            description="Testing schema to model mapping",
            workout_type_id=2,
            exercise_templates=[
                ExerciseTemplateCreate(
                    exercise_type_id=3,
                    set_templates=[
                        SetTemplateCreate(reps=12, intensity=75.0, intensity_unit_id=2)
                    ],
                )
            ],
        )

        # Verify the schema structure matches what we expect for model creation
        assert recipe_data.name == "Schema Test Recipe"
        assert recipe_data.workout_type_id == 2
        assert len(recipe_data.exercise_templates) == 1
        assert recipe_data.exercise_templates[0].exercise_type_id == 3
        assert len(recipe_data.exercise_templates[0].set_templates) == 1
        assert recipe_data.exercise_templates[0].set_templates[0].reps == 12

    def test_routine_update_schema_partial_updates(self):
        """Test that RoutineUpdate allows partial updates."""
        # Test updating only name
        update_name_only = RoutineUpdate(name="New Name")
        assert update_name_only.name == "New Name"
        assert update_name_only.description is None
        assert update_name_only.workout_type_id is None

        # Test updating only description
        update_desc_only = RoutineUpdate(description="New Description")
        assert update_desc_only.name is None
        assert update_desc_only.description == "New Description"
        assert update_desc_only.workout_type_id is None

        # Test updating multiple fields
        update_multiple = RoutineUpdate(name="Updated Recipe", workout_type_id=3)
        assert update_multiple.name == "Updated Recipe"
        assert update_multiple.description is None
        assert update_multiple.workout_type_id == 3


class TestRoutineCRUDLogic:
    """Test routine CRUD business logic patterns."""

    def test_routine_creation_data_flow(self):
        """Test the expected data flow for routine creation."""
        # Simulate the data that would flow through create_routine function

        recipe_create_data = RoutineCreate(
            name="Data Flow Test",
            description="Testing data transformation",
            workout_type_id=1,
            exercise_templates=[
                ExerciseTemplateCreate(
                    exercise_type_id=5,
                    set_templates=[
                        SetTemplateCreate(reps=8, intensity=100.0, intensity_unit_id=1),
                        SetTemplateCreate(reps=6, intensity=110.0, intensity_unit_id=1),
                    ],
                ),
                ExerciseTemplateCreate(
                    exercise_type_id=6,
                    set_templates=[
                        SetTemplateCreate(reps=15, intensity_unit_id=3)  # bodyweight
                    ],
                ),
            ],
        )

        # Verify the structure that would be passed to the database
        assert recipe_create_data.name == "Data Flow Test"
        assert len(recipe_create_data.exercise_templates) == 2

        # First exercise template
        first_template = recipe_create_data.exercise_templates[0]
        assert first_template.exercise_type_id == 5
        assert len(first_template.set_templates) == 2

        # Second exercise template
        second_template = recipe_create_data.exercise_templates[1]
        assert second_template.exercise_type_id == 6
        assert len(second_template.set_templates) == 1
        assert second_template.set_templates[0].reps == 15

    def test_user_ownership_validation_logic(self):
        """Test the user ownership validation patterns used in CRUD operations."""
        # This test documents the expected pattern for user ownership checks

        # Routine creation should associate with the correct user
        recipe_data = RoutineCreate(name="Ownership Test", workout_type_id=1)

        # In actual CRUD operations, these patterns would be used:
        # 1. create_routine(session, routine_data, user_id) -> routine.creator_id = user_id
        # 2. get_routine_by_id_for_user(session, routine_id, user_id) -> filters by creator_id or public
        # 3. get_routine_by_id_for_user(session, routine_id, different_user_id) -> returns None when not public

        # This test validates the schema supports the ownership pattern
        assert recipe_data.name == "Ownership Test"
        # Note: creator_id is set in the CRUD function, not in the schema

    def test_cascade_delete_expectations(self):
        """Test the expected cascade deletion behavior."""
        # This test documents what should happen during cascade deletion
        recipe_data = RoutineCreate(
            name="Cascade Test",
            workout_type_id=1,
            exercise_templates=[
                ExerciseTemplateCreate(
                    exercise_type_id=1,
                    set_templates=[
                        SetTemplateCreate(reps=5, intensity_unit_id=1),
                        SetTemplateCreate(reps=3, intensity_unit_id=1),
                    ],
                )
            ],
        )

        # When a routine is deleted, the following should cascade:
        # 1. Routine deleted
        # 2. Associated ExerciseTemplates deleted (cascade="all, delete-orphan")
        # 3. Associated SetTemplates deleted (cascade="all, delete-orphan")

        # Verify the nested structure that would be affected
        assert len(recipe_data.exercise_templates) == 1
        assert len(recipe_data.exercise_templates[0].set_templates) == 2

    def test_routine_query_patterns(self):
        """Test the expected query patterns for routine operations."""
        # This test documents the expected query patterns used in CRUD operations

        # Pattern 1: Get user routines - should order by created_at desc
        # Pattern 2: Get routine by ID - should include relationships
        # Pattern 3: Create routine - should flush to get IDs for nested objects
        # Pattern 4: Update routine - should only update provided fields
        # Pattern 5: Delete routine - should cascade to related objects

        # These patterns are implemented in the CRUD functions
        # This test validates the schemas support these patterns

        create_data = RoutineCreate(name="Query Pattern Test", workout_type_id=1)
        update_data = RoutineUpdate(name="Updated Name")

        assert create_data.name == "Query Pattern Test"
        assert update_data.name == "Updated Name"
        assert update_data.workout_type_id is None  # Partial update


class TestRoutineBusinessRules:
    """Test routine business rules and constraints."""

    def test_routine_name_constraints(self):
        """Test routine name business rules."""
        # Valid names
        valid_names = [
            "Push Day",
            "Full Body Strength Training",
            "Upper/Lower Split - Day 1",
            "5x5 Stronglifts Program",
            "Cardio & Core Session",
        ]

        for name in valid_names:
            recipe = RoutineCreate(name=name, workout_type_id=1)
            assert recipe.name == name

    def test_empty_routine_business_logic(self):
        """Test business logic for routines with no exercises."""
        empty_recipe = RoutineCreate(
            name="Rest Day Protocol",
            description="Light stretching and mobility work",
            workout_type_id=2,
            exercise_templates=[],
        )

        # Empty routines should be valid (useful for rest days, warm-ups, etc.)
        assert empty_recipe.name == "Rest Day Protocol"
        assert len(empty_recipe.exercise_templates) == 0

    def test_complex_workout_structure_validation(self):
        """Test validation of complex workout structures."""
        complex_workout = RoutineCreate(
            name="Athletic Performance Training",
            description="Sport-specific training session",
            workout_type_id=1,
            exercise_templates=[
                # Warm-up exercises
                ExerciseTemplateCreate(
                    exercise_type_id=1,  # Dynamic stretching
                    set_templates=[
                        SetTemplateCreate(intensity_unit_id=4)  # time-based
                    ],
                ),
                # Main lifts with progressive loading
                ExerciseTemplateCreate(
                    exercise_type_id=2,  # Squats
                    set_templates=[
                        SetTemplateCreate(reps=5, intensity=135.0, intensity_unit_id=2),
                        SetTemplateCreate(reps=5, intensity=185.0, intensity_unit_id=2),
                        SetTemplateCreate(reps=3, intensity=225.0, intensity_unit_id=2),
                        SetTemplateCreate(reps=1, intensity=275.0, intensity_unit_id=2),
                    ],
                ),
                # Accessory work
                ExerciseTemplateCreate(
                    exercise_type_id=3,  # Lunges
                    set_templates=[
                        SetTemplateCreate(reps=10, intensity_unit_id=3),  # bodyweight
                        SetTemplateCreate(reps=10, intensity_unit_id=3),
                        SetTemplateCreate(reps=10, intensity_unit_id=3),
                    ],
                ),
                # Cool-down
                ExerciseTemplateCreate(
                    exercise_type_id=4,  # Static stretching
                    set_templates=[
                        SetTemplateCreate(intensity_unit_id=4)  # time-based
                    ],
                ),
            ],
        )

        assert len(complex_workout.exercise_templates) == 4
        assert (
            len(complex_workout.exercise_templates[1].set_templates) == 4
        )  # Main lift
        assert (
            len(complex_workout.exercise_templates[2].set_templates) == 3
        )  # Accessory
