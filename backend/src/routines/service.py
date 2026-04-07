from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from datetime import datetime, timezone

from src.routines import crud
from src.routines.schemas import (
    AdminRoutineCreate,
    RoutineCreate,
    RoutineRead,
    RoutineUpdate,
)
from src.workouts.schemas import WorkoutCreate
from src.workouts.models import Workout
from src.routines.models import Routine
from src.workouts.crud import create_workout, get_workout_by_id
from src.exercises.schemas import ExerciseCreate
from src.exercise_sets.schemas import ExerciseSetCreate
from src.exercises.crud import create_exercise
from src.exercise_sets.crud import create_exercise_set


class RoutineService:
    """Service layer for routine operations."""

    async def get_visible_routines(
        self,
        session: AsyncSession,
        user_id: int | None,
        offset: int,
        limit: int,
    ) -> List[RoutineRead]:
        """Get routines visible to the current viewer with pagination."""
        routines = await crud.get_visible_routines(session, user_id, offset, limit)
        return [RoutineRead.model_validate(routine) for routine in routines]

    async def get_routine(
        self, session: AsyncSession, routine_id: int, user_id: int | None
    ) -> Optional[RoutineRead]:
        """Get a specific routine by ID."""
        routine = (
            await crud.get_routine_by_id_for_user(session, routine_id, user_id)
            if user_id is not None
            else await crud.get_public_routine_by_id(session, routine_id)
        )
        if routine:
            return RoutineRead.model_validate(routine)
        return None

    async def create_routine(
        self, session: AsyncSession, routine_data: RoutineCreate, user_id: int
    ) -> RoutineRead:
        """Create a new routine."""
        routine = await crud.create_routine(session, routine_data, user_id)
        return RoutineRead.model_validate(routine)

    async def create_routine_admin(
        self, session: AsyncSession, routine_data: AdminRoutineCreate, user_id: int
    ) -> RoutineRead:
        """Create a new routine with admin-only fields."""
        routine = await crud.create_routine_admin(session, routine_data, user_id)
        return RoutineRead.model_validate(routine)

    async def update_routine(
        self,
        session: AsyncSession,
        routine_id: int,
        routine_data: RoutineUpdate,
        user_id: int,
        is_superuser: bool = False,
    ) -> Optional[RoutineRead]:
        """Update an existing routine."""
        routine = await crud.update_routine(
            session, routine_id, routine_data, user_id, is_superuser=is_superuser
        )
        if routine:
            return RoutineRead.model_validate(routine)
        return None

    async def delete_routine(
        self,
        session: AsyncSession,
        routine_id: int,
        user_id: int,
        is_superuser: bool = False,
    ) -> bool:
        """Delete a routine idempotently without leaking ownership details."""
        delete_query = delete(Routine).where(Routine.id == routine_id)
        if not is_superuser:
            delete_query = delete_query.where(Routine.creator_id == user_id)

        await session.execute(delete_query)
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        return True

    async def create_workout_from_routine(
        self, session: AsyncSession, user_id: int, routine_id: int
    ) -> Workout:
        """Instantiate a Workout (with exercises and sets) from a saved routine.

        - Creates a new workout using the routine's name and workout_type_id
        - For each exercise template:
          - Creates the exercise attached to the workout
          - Creates its sets with reps/intensity/unit from the template, marked as not done
        """
        routine = await crud.get_routine_by_id_for_user(session, routine_id, user_id)
        if routine is None:
            raise ValueError("Routine not found or not accessible")

        # 1) Create the workout
        workout = await create_workout(
            session,
            WorkoutCreate(
                name=routine.name,
                notes=None,
                start_time=datetime.now(timezone.utc),
                workout_type_id=routine.workout_type_id,
            ),
            user_id,
        )

        # 2) Create exercises and sets from templates
        for exercise_template in routine.exercise_templates:
            exercise = await create_exercise(
                session,
                ExerciseCreate(
                    timestamp=datetime.now(timezone.utc),
                    notes=exercise_template.notes,
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


routine_service = RoutineService()
