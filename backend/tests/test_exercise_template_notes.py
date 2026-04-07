import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.routines.service import routine_service
from src.routines.schemas import RoutineCreate, ExerciseTemplateCreate, SetTemplateCreate
from src.routines.models import Routine
from src.exercises.models import ExerciseType, IntensityUnit
from src.workouts.models import WorkoutType
from src.users.models import User

@pytest.mark.integration
@pytest.mark.asyncio
async def test_exercise_template_notes_propagation(db_session: AsyncSession):
    """Test that notes from an ExerciseTemplate are propagated to the Exercise when creating a workout."""
    # Setup
    wt = WorkoutType(name="Notes Strength", description="desc")
    iu = IntensityUnit(name="Kilograms", abbreviation="kg")
    db_session.add_all([wt, iu])
    await db_session.flush()

    et = ExerciseType(
        name="Notes Exercise", description="x", default_intensity_unit=iu.id
    )
    db_session.add(et)
    await db_session.flush()

    user = User(
        email="notes@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    # Create routine with notes
    routine_notes = "Focus on the mind-muscle connection."
    routine_data = RoutineCreate(
        name="Routine with Notes",
        workout_type_id=wt.id,
        exercise_templates=[
            ExerciseTemplateCreate(
                exercise_type_id=et.id,
                notes=routine_notes,
                set_templates=[
                    SetTemplateCreate(reps=10, intensity=50.0, intensity_unit_id=iu.id)
                ]
            )
        ]
    )
    
    routine_read = await routine_service.create_routine(db_session, routine_data, user.id)
    assert routine_read.exercise_templates[0].notes == routine_notes

    # Act: Create workout from routine
    workout = await routine_service.create_workout_from_routine(
        db_session, user.id, routine_read.id
    )

    # Assert: Exercise in workout should have the same notes
    from src.exercises.models import Exercise
    res = await db_session.execute(
        select(Exercise).where(Exercise.workout_id == workout.id)
    )
    exercises = res.unique().scalars().all()
    assert len(exercises) == 1
    assert exercises[0].notes == routine_notes
