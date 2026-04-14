import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Optional

from src.sync.schemas import GuestSyncPayload, SyncResult
from src.workouts.models import Workout, WorkoutType
from src.exercises.models import Exercise, ExerciseType
from src.exercise_sets.models import ExerciseSet
from src.sync.models import SyncLog

logger = logging.getLogger(__name__)


class SyncService:
    @staticmethod
    async def sync_guest_data(
        session: AsyncSession,
        payload: GuestSyncPayload,
        user_id: int,
        idempotency_key: Optional[str] = None,
    ) -> SyncResult:
        """
        Synchronize guest data to the server in a single transaction.
        Supports request-level idempotency via an idempotency key.
        """
        # 0. Check for existing idempotency key
        if idempotency_key:
            stmt = select(SyncLog).where(
                SyncLog.user_id == user_id, SyncLog.idempotency_key == idempotency_key
            )
            existing_log = (await session.execute(stmt)).scalar_one_or_none()
            if existing_log:
                logger.info(
                    f"Returning cached sync result for idempotency key: {idempotency_key}"
                )
                return SyncResult(
                    success=existing_log.success,
                    syncedWorkouts=existing_log.synced_workouts,
                    syncedExercises=existing_log.synced_exercises,
                    syncedSets=existing_log.synced_sets,
                    syncedRoutines=existing_log.synced_routines,
                )

        synced_workouts = 0
        synced_exercises = 0
        synced_sets = 0
        # TODO: Implement routine synchronization
        synced_routines = 0

        # 1. Map Exercise Types
        # We need to map guest UUIDs to server IDs
        exercise_type_map: Dict[str, int] = {}

        for guest_et in payload.exerciseTypes:
            existing_et = None

            # 1a. Try to find by external_id (server ID)
            if guest_et.external_id and guest_et.external_id.isdigit():
                stmt = select(ExerciseType).where(ExerciseType.id == int(guest_et.external_id))
                existing_et = (await session.execute(stmt)).scalar_one_or_none()

            # 1b. Try to find by name (case-insensitive) if not found by ID
            if not existing_et:
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
                # Workout types are usually globally defined
                new_wt = WorkoutType(
                    name=guest_wt.name,
                    description=guest_wt.description or "Synced from guest data",
                )
                session.add(new_wt)
                await session.flush()
                workout_type_map[guest_wt.id] = new_wt.id

        # 3. Create Workouts, Exercises, and Sets (Atomic)
        try:
            for guest_w in payload.workouts:
                server_wt_id = workout_type_map.get(guest_w.workout_type_id)

                # Fallback: if not in map, maybe it's already a server ID
                if not server_wt_id and guest_w.workout_type_id.isdigit():
                    candidate_id = int(guest_w.workout_type_id)
                    stmt = select(WorkoutType).where(WorkoutType.id == candidate_id)
                    existing = (await session.execute(stmt)).scalar_one_or_none()
                    if existing:
                        server_wt_id = existing.id

                if not server_wt_id:
                    # Fallback to Strength Training (ID 4) if not found
                    server_wt_id = 4

                # Idempotency check: Don't create if a workout with same start_time exists for user
                stmt = select(Workout).where(
                    Workout.owner_id == user_id,
                    Workout.start_time == guest_w.start_time,
                )
                existing_workout = (await session.execute(stmt)).scalar_one_or_none()
                if existing_workout:
                    logger.info(
                        f"Skipping duplicate workout with start_time {guest_w.start_time}"
                    )
                    continue

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

                    # Fallback: if not in map, maybe it's already a server ID (e.g. from a partial previous sync or stale state)
                    if not server_et_id and guest_e.exercise_type_id.isdigit():
                        candidate_id = int(guest_e.exercise_type_id)
                        # Verify it exists and is accessible
                        stmt = select(ExerciseType).where(
                            (ExerciseType.id == candidate_id) &
                            ((ExerciseType.owner_id == user_id) | (ExerciseType.status == "released"))
                        )
                        existing = (await session.execute(stmt)).scalar_one_or_none()
                        if existing:
                            server_et_id = existing.id

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

            # Store sync log if idempotency key is present
            if idempotency_key:
                sync_log = SyncLog(
                    user_id=user_id,
                    idempotency_key=idempotency_key,
                    success=True,
                    synced_workouts=synced_workouts,
                    synced_exercises=synced_exercises,
                    synced_sets=synced_sets,
                    synced_routines=synced_routines,
                )
                session.add(sync_log)

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
                error=str(e),
            )
