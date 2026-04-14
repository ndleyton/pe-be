import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict

from src.sync.schemas import GuestSyncPayload, SyncResult
from src.workouts.models import Workout, WorkoutType
from src.exercises.models import Exercise, ExerciseType
from src.exercise_sets.models import ExerciseSet

logger = logging.getLogger(__name__)


class SyncService:
    @staticmethod
    async def sync_guest_data(
        session: AsyncSession, payload: GuestSyncPayload, user_id: int
    ) -> SyncResult:
        """
        Synchronize guest data to the server in a single transaction.
        """
        synced_workouts = 0
        synced_exercises = 0
        synced_sets = 0
        # TODO: Implement routine synchronization
        synced_routines = 0

        # 1. Map Exercise Types
        # We need to map guest UUIDs to server IDs
        exercise_type_map: Dict[str, int] = {}

        # First, check for existing exercise types by name (released)
        # or created by this user
        for guest_et in payload.exerciseTypes:
            # Try to find by name (case-insensitive)
            stmt = (
                select(ExerciseType)
                .where(
                    (ExerciseType.name.ilike(guest_et.name))
                    & (
                        (ExerciseType.owner_id == user_id)
                        | (ExerciseType.status == "released")
                    )
                )
                .limit(1)
            )
            result = await session.execute(stmt)
            existing_et = result.scalar_one_or_none()

            if existing_et:
                exercise_type_map[guest_et.id] = existing_et.id
            else:
                # Create a new candidate exercise type
                new_et = ExerciseType(
                    name=guest_et.name,
                    description=guest_et.description or "Synced from guest data",
                    default_intensity_unit=guest_et.default_intensity_unit,
                    owner_id=user_id,
                    status="candidate",
                )
                session.add(new_et)
                await session.flush()  # Get the ID
                exercise_type_map[guest_et.id] = new_et.id

        # 2. Map Workout Types
        workout_type_map: Dict[str, int] = {}
        for guest_wt in payload.workoutTypes:
            stmt = (
                select(WorkoutType)
                .where(WorkoutType.name.ilike(guest_wt.name))
                .limit(1)
            )
            result = await session.execute(stmt)
            existing_wt = result.scalar_one_or_none()

            if existing_wt:
                workout_type_map[guest_wt.id] = existing_wt.id
            else:
                # Workout types are usually globally defined, but if it doesn't exist,
                # we'll just use a default or create it if the system allows.
                # For now, let's just create it if it doesn't exist.
                new_wt = WorkoutType(
                    name=guest_wt.name,
                    description=guest_wt.description or "Synced from guest data",
                )
                session.add(new_wt)
                await session.flush()
                workout_type_map[guest_wt.id] = new_wt.id

        # 3. Create Workouts, Exercises, and Sets
        try:
            for guest_w in payload.workouts:
                server_wt_id = workout_type_map.get(guest_w.workout_type_id)
                if not server_wt_id:
                    # Fallback to Strength Training (ID 4) if not found
                    server_wt_id = 4

                workout = Workout(
                    name=guest_w.name,
                    notes=guest_w.notes,
                    start_time=guest_w.start_time,
                    end_time=guest_w.end_time,
                    workout_type_id=server_wt_id,
                    owner_id=user_id,
                )
                session.add(workout)
                await session.flush()
                synced_workouts += 1

                for guest_e in guest_w.exercises:
                    server_et_id = exercise_type_map.get(guest_e.exercise_type_id)
                    if not server_et_id:
                        logger.warning(
                            f"Skipping exercise with unknown type: {guest_e.exercise_type_id}"
                        )
                        continue

                    exercise = Exercise(
                        timestamp=guest_e.timestamp or guest_w.start_time,
                        notes=guest_e.notes,
                        exercise_type_id=server_et_id,
                        workout_id=workout.id,
                    )
                    session.add(exercise)
                    await session.flush()
                    synced_exercises += 1

                    for guest_s in guest_e.exercise_sets:
                        exercise_set = ExerciseSet(
                            reps=guest_s.reps,
                            duration_seconds=guest_s.duration_seconds,
                            intensity=guest_s.intensity,
                            rpe=guest_s.rpe,
                            intensity_unit_id=guest_s.intensity_unit_id,
                            exercise_id=exercise.id,
                            rest_time_seconds=guest_s.rest_time_seconds,
                            done=guest_s.done,
                            notes=guest_s.notes,
                        )
                        session.add(exercise_set)
                        synced_sets += 1

            # Commit everything
            await session.commit()
            return SyncResult(
                success=True,
                syncedWorkouts=synced_workouts,
                syncedExercises=synced_exercises,
                syncedSets=synced_sets,
                syncedRoutines=synced_routines,
            )
        except Exception as e:
            logger.exception("Bulk sync failed")
            await session.rollback()
            return SyncResult(
                success=False,
                syncedWorkouts=0,
                syncedExercises=0,
                syncedSets=0,
                syncedRoutines=0,
                error=str(e),
            )
