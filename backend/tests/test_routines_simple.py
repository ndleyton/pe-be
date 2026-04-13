"""
Simplified routine CRUD unit tests focusing on core business logic.
These tests validate the routine models, schemas, and basic CRUD operations.
"""

import pytest
from pydantic import ValidationError

from src.routines.schemas import (
    RoutineCreate,
    RoutineUpdate,
    ExerciseTemplateCreate,
    SetTemplateCreate,
)


class TestRoutineSchemas:
    """Test routine Pydantic schemas for validation and serialization."""

    def test_set_template_create_valid(self):
        """Test creating a valid SetTemplateCreate."""
        set_data = SetTemplateCreate(reps=10, intensity=50.0, intensity_unit_id=1)
        assert set_data.reps == 10
        assert set_data.intensity == 50.0
        assert set_data.intensity_unit_id == 1

    def test_set_template_create_optional_fields(self):
        """Test SetTemplateCreate with optional fields."""
        set_data = SetTemplateCreate(intensity_unit_id=1)
        assert set_data.reps is None
        assert set_data.intensity is None
        assert set_data.intensity_unit_id == 1

    def test_set_template_create_invalid_intensity_unit(self):
        """Test SetTemplateCreate with invalid intensity unit."""
        with pytest.raises(ValidationError):
            SetTemplateCreate()  # Missing required intensity_unit_id

    def test_exercise_template_create_valid(self):
        """Test creating a valid ExerciseTemplateCreate."""
        exercise_data = ExerciseTemplateCreate(
            exercise_type_id=1,
            set_templates=[
                SetTemplateCreate(reps=10, intensity=50.0, intensity_unit_id=1),
                SetTemplateCreate(reps=8, intensity=60.0, intensity_unit_id=1),
            ],
        )
        assert exercise_data.exercise_type_id == 1
        assert len(exercise_data.set_templates) == 2

    def test_exercise_template_create_empty_sets(self):
        """Test ExerciseTemplateCreate with no sets."""
        exercise_data = ExerciseTemplateCreate(exercise_type_id=1)
        assert exercise_data.exercise_type_id == 1
        assert len(exercise_data.set_templates) == 0

    def test_routine_create_valid(self):
        """Test creating a valid RoutineCreate."""
        routine_data = RoutineCreate(
            name="Test Routine",
            description="A test workout routine",
            workout_type_id=1,
            exercise_templates=[
                ExerciseTemplateCreate(
                    exercise_type_id=1,
                    set_templates=[
                        SetTemplateCreate(reps=10, intensity=50.0, intensity_unit_id=1)
                    ],
                )
            ],
        )
        assert routine_data.name == "Test Routine"
        assert routine_data.description == "A test workout routine"
        assert routine_data.workout_type_id == 1
        assert len(routine_data.exercise_templates) == 1

    def test_routine_create_minimal(self):
        """Test RoutineCreate with minimal required fields."""
        routine_data = RoutineCreate(name="Minimal Routine", workout_type_id=1)
        assert routine_data.name == "Minimal Routine"
        assert routine_data.description is None
        assert routine_data.workout_type_id == 1
        assert len(routine_data.exercise_templates) == 0

    def test_routine_create_invalid_name_empty(self):
        """Test RoutineCreate with invalid empty name."""
        with pytest.raises(ValidationError) as exc_info:
            RoutineCreate(name="", workout_type_id=1)
        assert "at least 1 character" in str(exc_info.value)

    def test_routine_create_invalid_name_too_long(self):
        """Test RoutineCreate with name too long."""
        long_name = "a" * 256  # Exceeds 255 character limit
        with pytest.raises(ValidationError) as exc_info:
            RoutineCreate(name=long_name, workout_type_id=1)
        assert "at most 255 characters" in str(exc_info.value)

    def test_routine_create_missing_required_fields(self):
        """Test RoutineCreate with missing required fields."""
        with pytest.raises(ValidationError):
            RoutineCreate()  # Missing name and workout_type_id

    def test_routine_update_partial(self):
        """Test RoutineUpdate allows partial updates."""
        update_data = RoutineUpdate(name="Updated Name")
        assert update_data.name == "Updated Name"
        assert update_data.description is None
        assert update_data.workout_type_id is None

    def test_routine_update_all_fields(self):
        """Test RoutineUpdate with all fields."""
        update_data = RoutineUpdate(
            name="Updated Routine", description="Updated description", workout_type_id=2
        )
        assert update_data.name == "Updated Routine"
        assert update_data.description == "Updated description"
        assert update_data.workout_type_id == 2

    def test_routine_update_empty_name_invalid(self):
        """Test RoutineUpdate with invalid empty name."""
        with pytest.raises(ValidationError) as exc_info:
            RoutineUpdate(name="")
        assert "at least 1 character" in str(exc_info.value)


class TestRoutineBusinessLogic:
    """Test routine business logic and data transformations."""

    def test_routine_creation_workflow(self):
        """Test complete routine creation workflow."""
        # Simulate creating a routine from workout data
        exercise_templates = [
            ExerciseTemplateCreate(
                exercise_type_id=1,  # Bench Press
                set_templates=[
                    SetTemplateCreate(
                        reps=10, intensity=135.0, intensity_unit_id=2
                    ),  # lbs
                    SetTemplateCreate(reps=8, intensity=155.0, intensity_unit_id=2),
                    SetTemplateCreate(reps=6, intensity=175.0, intensity_unit_id=2),
                ],
            ),
            ExerciseTemplateCreate(
                exercise_type_id=2,  # Squats
                set_templates=[
                    SetTemplateCreate(reps=12, intensity=225.0, intensity_unit_id=2),
                    SetTemplateCreate(reps=10, intensity=245.0, intensity_unit_id=2),
                ],
            ),
        ]

        routine_data = RoutineCreate(
            name="Push Day Workout",
            description="Upper body push workout focusing on chest and triceps",
            workout_type_id=1,
            exercise_templates=exercise_templates,
        )

        # Validate the routine structure
        assert routine_data.name == "Push Day Workout"
        assert len(routine_data.exercise_templates) == 2

        # Validate first exercise (Bench Press)
        bench_press = routine_data.exercise_templates[0]
        assert bench_press.exercise_type_id == 1
        assert len(bench_press.set_templates) == 3

        # Validate progressive overload in sets
        sets = bench_press.set_templates
        assert sets[0].reps == 10 and sets[0].intensity == 135.0
        assert sets[1].reps == 8 and sets[1].intensity == 155.0
        assert sets[2].reps == 6 and sets[2].intensity == 175.0

        # Validate second exercise (Squats)
        squats = routine_data.exercise_templates[1]
        assert squats.exercise_type_id == 2
        assert len(squats.set_templates) == 2

    def test_routine_update_preserves_structure(self):
        """Test that routine updates preserve existing structure."""
        original_routine = RoutineCreate(
            name="Original Routine",
            description="Original description",
            workout_type_id=1,
            exercise_templates=[
                ExerciseTemplateCreate(
                    exercise_type_id=1,
                    set_templates=[SetTemplateCreate(reps=10, intensity_unit_id=1)],
                )
            ],
        )

        # Simulate partial update
        update_data = RoutineUpdate(
            name="Updated Routine Name", description="Updated description"
        )

        # Verify update data is separate from original
        assert update_data.name == "Updated Routine Name"
        assert update_data.workout_type_id is None  # Not being updated
        assert original_routine.name == "Original Routine"  # Original unchanged

    def test_empty_routine_valid(self):
        """Test that a routine with no exercises is valid."""
        empty_routine = RoutineCreate(
            name="Empty Routine", workout_type_id=1, exercise_templates=[]
        )

        assert empty_routine.name == "Empty Routine"
        assert len(empty_routine.exercise_templates) == 0

    def test_complex_workout_routine(self):
        """Test a complex routine with multiple exercises and varied set schemes."""
        complex_routine = RoutineCreate(
            name="Full Body Strength",
            description="Comprehensive full body workout with compound movements",
            workout_type_id=1,
            exercise_templates=[
                # Deadlifts - pyramid scheme
                ExerciseTemplateCreate(
                    exercise_type_id=3,
                    set_templates=[
                        SetTemplateCreate(reps=8, intensity=225.0, intensity_unit_id=2),
                        SetTemplateCreate(reps=6, intensity=275.0, intensity_unit_id=2),
                        SetTemplateCreate(reps=4, intensity=315.0, intensity_unit_id=2),
                        SetTemplateCreate(reps=6, intensity=275.0, intensity_unit_id=2),
                        SetTemplateCreate(reps=8, intensity=225.0, intensity_unit_id=2),
                    ],
                ),
                # Pull-ups - bodyweight
                ExerciseTemplateCreate(
                    exercise_type_id=4,
                    set_templates=[
                        SetTemplateCreate(reps=8, intensity_unit_id=3),  # bodyweight
                        SetTemplateCreate(reps=6, intensity_unit_id=3),
                        SetTemplateCreate(reps=4, intensity_unit_id=3),
                    ],
                ),
                # Cardio - time-based
                ExerciseTemplateCreate(
                    exercise_type_id=5,
                    set_templates=[
                        SetTemplateCreate(
                            intensity_unit_id=4
                        ),  # time-based, no reps/weight
                    ],
                ),
            ],
        )

        assert len(complex_routine.exercise_templates) == 3
        assert (
            len(complex_routine.exercise_templates[0].set_templates) == 5
        )  # Deadlifts
        assert len(complex_routine.exercise_templates[1].set_templates) == 3  # Pull-ups
        assert len(complex_routine.exercise_templates[2].set_templates) == 1  # Cardio


class TestRoutineValidation:
    """Test routine schema validation edge cases and error handling."""

    def test_negative_values_handling(self):
        """Test that negative values are handled (currently allowed but could be restricted)."""
        # Note: Current schema allows negative values - this test documents the current behavior
        # In a real application, you might want to add validation to prevent negative reps
        set_data = SetTemplateCreate(reps=-5, intensity_unit_id=1)
        assert set_data.reps == -5  # Currently allowed

    def test_zero_values_valid(self):
        """Test that zero values are handled correctly."""
        # Zero reps might be valid for some exercises (planks, etc.)
        set_data = SetTemplateCreate(reps=0, intensity_unit_id=1)
        assert set_data.reps == 0

    def test_large_values_accepted(self):
        """Test that large valid values are accepted."""
        set_data = SetTemplateCreate(
            reps=1000,  # High rep endurance work
            intensity=500.0,  # Heavy weight
            intensity_unit_id=1,
        )
        assert set_data.reps == 1000
        assert set_data.intensity == 500.0

    def test_routine_name_whitespace_handling(self):
        """Test routine name with various whitespace scenarios."""
        # Leading/trailing whitespace should be handled by validation
        routine_data = RoutineCreate(name="  Valid Routine Name  ", workout_type_id=1)
        # Note: Pydantic doesn't automatically strip whitespace unless configured
        assert routine_data.name == "  Valid Routine Name  "


# Test data constants that could be used in integration tests
SAMPLE_ROUTINES = {
    "beginner_push": RoutineCreate(
        name="Beginner Push Workout",
        description="Basic upper body push exercises for beginners",
        workout_type_id=1,
        exercise_templates=[
            ExerciseTemplateCreate(
                exercise_type_id=1,  # Push-ups
                set_templates=[
                    SetTemplateCreate(reps=8, intensity_unit_id=3),  # bodyweight
                    SetTemplateCreate(reps=6, intensity_unit_id=3),
                    SetTemplateCreate(reps=4, intensity_unit_id=3),
                ],
            ),
            ExerciseTemplateCreate(
                exercise_type_id=2,  # Dumbbell Press
                set_templates=[
                    SetTemplateCreate(
                        reps=12, intensity=20.0, intensity_unit_id=2
                    ),  # lbs
                    SetTemplateCreate(reps=10, intensity=25.0, intensity_unit_id=2),
                ],
            ),
        ],
    ),
    "minimal": RoutineCreate(name="Quick Workout", workout_type_id=1),
}
