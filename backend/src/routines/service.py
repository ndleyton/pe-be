from collections import Counter
from typing import List, Optional

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone

from src.routines import crud
from src.routines.schemas import (
    AdminRoutineCreate,
    RoutineCreate,
    RoutineRead,
    RoutineUpdate,
    RoutineSummary,
)
from src.workouts.models import Workout
from src.routines.models import Routine
from src.exercises.intensity_units import normalize_intensity_for_storage
from src.exercises.models import Exercise, ExerciseType, IntensityUnit
from src.exercise_sets.models import ExerciseSet


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

    async def get_visible_routines_summary(
        self,
        session: AsyncSession,
        user_id: int | None,
        offset: int,
        limit: int,
        order_by: str,
    ) -> List[RoutineSummary]:
        """Get routines visible to the current viewer as a summary list."""
        routines_summary = await crud.get_visible_routines_summary(
            session, user_id, offset, limit, order_by
        )
        return [RoutineSummary.model_validate(r) for r in routines_summary]

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

        # Basic rate-limiting/idempotency: check if user just started this routine
        # (within the last 10 seconds)
        from datetime import timedelta

        recent_stmt = (
            select(Workout)
            .where(
                Workout.owner_id == user_id,
                Workout.start_time > datetime.now(timezone.utc) - timedelta(seconds=10),
            )
            .order_by(Workout.start_time.desc())
            .limit(1)
        )
        recent_workout = (await session.execute(recent_stmt)).scalar_one_or_none()
        # Note: We can't easily check if it was from THIS routine without a back-ref,
        # but checking for ANY workout started in the last 10s is a safe enough heuristic
        # for preventing accidental double-clicks/useEffect runs.
        if recent_workout and recent_workout.name.startswith(routine.name):
            return recent_workout

        intensity_unit_ids = {
            set_template.intensity_unit_id
            for exercise_template in routine.exercise_templates
            for set_template in exercise_template.set_templates
        }
        intensity_units_by_id: dict[int, IntensityUnit] = {}
        intensity_units_by_abbreviation: dict[str, IntensityUnit] = {}
        if intensity_unit_ids:
            result = await session.execute(
                select(IntensityUnit).where(IntensityUnit.id.in_(intensity_unit_ids))
            )
            intensity_units_by_id = {
                intensity_unit.id: intensity_unit
                for intensity_unit in result.scalars().all()
            }

        canonical_unit_keys = set()
        for exercise_template in routine.exercise_templates:
            for set_template in exercise_template.set_templates:
                source_unit = (
                    intensity_units_by_id.get(set_template.intensity_unit_id)
                    or set_template.intensity_unit
                )
                _, canonical_unit_key = normalize_intensity_for_storage(
                    set_template.intensity,
                    source_unit,
                )
                if canonical_unit_key is not None:
                    canonical_unit_keys.add(canonical_unit_key)

        if canonical_unit_keys:
            query_clauses = []
            if intensity_unit_ids:
                query_clauses.append(IntensityUnit.id.in_(intensity_unit_ids))
            query_clauses.append(
                func.lower(IntensityUnit.abbreviation).in_(canonical_unit_keys)
            )
            result = await session.execute(
                select(IntensityUnit).where(or_(*query_clauses))
            )
            intensity_units = result.scalars().all()
            intensity_units_by_id = {unit.id: unit for unit in intensity_units}
            intensity_units_by_abbreviation = {
                unit.abbreviation.lower(): unit
                for unit in intensity_units
                if unit.abbreviation
            }
        else:
            intensity_units_by_abbreviation = {
                unit.abbreviation.lower(): unit
                for unit in intensity_units_by_id.values()
                if unit.abbreviation
            }

        for exercise_type_id, count in Counter(
            exercise_template.exercise_type_id
            for exercise_template in routine.exercise_templates
        ).items():
            await session.execute(
                update(ExerciseType)
                .where(ExerciseType.id == exercise_type_id)
                .values(times_used=ExerciseType.times_used + count)
            )

        workout = Workout(
            name=routine.name,
            notes=None,
            start_time=datetime.now(timezone.utc),
            workout_type_id=routine.workout_type_id,
            owner_id=user_id,
        )
        session.add(workout)

        for exercise_template in routine.exercise_templates:
            exercise = Exercise(
                timestamp=datetime.now(timezone.utc),
                notes=exercise_template.notes,
                exercise_type_id=exercise_template.exercise_type_id,
                workout=workout,
            )
            session.add(exercise)

            for set_template in exercise_template.set_templates:
                source_unit = (
                    intensity_units_by_id.get(set_template.intensity_unit_id)
                    or set_template.intensity_unit
                )
                canonical_intensity, canonical_unit_key = (
                    normalize_intensity_for_storage(
                        set_template.intensity,
                        source_unit,
                    )
                )
                canonical_intensity_unit = source_unit
                if canonical_unit_key is not None:
                    canonical_intensity_unit = (
                        intensity_units_by_abbreviation.get(canonical_unit_key)
                        or source_unit
                    )

                exercise_set = ExerciseSet(
                    reps=set_template.reps,
                    duration_seconds=set_template.duration_seconds,
                    intensity=set_template.intensity,
                    rpe=set_template.rpe,
                    rir=set_template.rir,
                    canonical_intensity=canonical_intensity,
                    intensity_unit_id=set_template.intensity_unit_id,
                    canonical_intensity_unit_id=(
                        canonical_intensity_unit.id
                        if canonical_intensity_unit is not None
                        else set_template.intensity_unit_id
                    ),
                    rest_time_seconds=None,
                    exercise=exercise,
                    done=False,
                )
                session.add(exercise_set)

        try:
            await session.flush()
            await session.commit()
        except Exception:
            await session.rollback()
            raise

        result = await session.execute(
            select(Workout)
            .options(
                joinedload(Workout.exercises)
                .joinedload(Exercise.exercise_sets)
                .joinedload(ExerciseSet.intensity_unit),
                joinedload(Workout.exercises)
                .joinedload(Exercise.exercise_sets)
                .joinedload(ExerciseSet.canonical_intensity_unit),
            )
            .where(Workout.id == workout.id, Workout.owner_id == user_id)
        )
        return result.unique().scalar_one()


routine_service = RoutineService()
