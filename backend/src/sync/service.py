import logging

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercise_sets.models import ExerciseSet
from src.exercises.models import Exercise, ExerciseType
from src.sync.models import GuestExerciseTypeMapping, GuestWorkoutMapping, SyncLog
from src.sync.schemas import GuestSyncPayload, GuestWorkout, SyncResult
from src.users.models import User
from src.workouts.models import Workout, WorkoutType

logger = logging.getLogger(__name__)

# The retired guest seed (pe-be-tracker-frontend/src/stores/seeds/exerciseTypes.ts):
# released catalog name -> seed description. Seeds carry no server ID, so an exact
# (name, description) match is the only way to recognize one; custom types get
# "Custom exercise" and never match.
_SEED_DESCRIPTIONS = {
    "Push-ups": "Upper body bodyweight exercise",
    "Barbell Squat": "Lower body exercise",
    "Bench Press": "Upper body strength exercise",
    "Barbell Deadlift": "Full body strength exercise",
    "Pull-ups": "Upper body bodyweight pulling exercise",
    "Barbell Row": "Back strength exercise",
    "Wide-Grip Lat Pulldown": "Upper back and lat exercise",
    "Face Pull": "Rear deltoid and upper back exercise",
    "Dumbbell Bicep Curl": "Bicep isolation exercise",
    "Hammer Curls": "Bicep and forearm exercise",
    "Overhead Press": "Shoulder and tricep exercise",
    "Dips": "Tricep and chest bodyweight exercise",
    "Barbell Incline Bench Press - Medium Grip": "Upper chest strength exercise",
    "Machine Triceps Extension": "Tricep isolation exercise",
    "Side Lateral Raise": "Side deltoid exercise",
    "Bulgarian Split Squats": "Single leg quad and glute exercise",
    "Romanian Deadlift": "Hamstring and glute exercise",
    "Walking Lunges": "Dynamic leg and glute exercise",
    "Leg Press": "Quad and glute machine exercise",
    "Standing Calf Raises": "Calf muscle exercise",
    "Leg Curls": "Hamstring isolation exercise",
    "Leg Extensions": "Quadricep isolation exercise",
}
# Seed names before #443 renamed them to the catalog names.
_PRE_443_NAMES = {
    "Squat": "Barbell Squat",
    "Deadlift": "Barbell Deadlift",
    "Lat Pulldowns": "Wide-Grip Lat Pulldown",
    "Face Pulls": "Face Pull",
    "Bicep Curls": "Dumbbell Bicep Curl",
    "Incline Bench Press": "Barbell Incline Bench Press - Medium Grip",
    "Tricep Extensions": "Machine Triceps Extension",
    "Lateral Raises": "Side Lateral Raise",
    "Romanian Deadlifts": "Romanian Deadlift",
    "Calf Raises": "Standing Calf Raises",
}
# (seed name, seed description) -> released catalog name
LEGACY_SEEDS = {
    (seed_name, _SEED_DESCRIPTIONS[name]): name
    for seed_name, name in ({n: n for n in _SEED_DESCRIPTIONS} | _PRE_443_NAMES).items()
}


async def _resolve_exercise_types(session, workouts, definitions, user_id):
    refs = {e.exercise_type_id for workout in workouts for e in workout.exercises}
    by_id = {}
    for definition in definitions:
        if definition.id in refs:
            if definition.id in by_id and by_id[definition.id] != definition:
                raise ValueError(
                    f"Conflicting definitions for exercise type {definition.id}"
                )
            by_id[definition.id] = definition

    local_ids = {ref for ref in refs if not ref.isdecimal()}
    mapped = (
        dict(
            (
                await session.execute(
                    select(
                        GuestExerciseTypeMapping.guest_id,
                        GuestExerciseTypeMapping.exercise_type_id,
                    ).where(
                        GuestExerciseTypeMapping.user_id == user_id,
                        GuestExerciseTypeMapping.guest_id.in_(local_ids),
                    )
                )
            ).all()
        )
        if local_ids
        else {}
    )

    server_ids = {}
    for ref in refs:
        definition = by_id.get(ref)
        explicit = definition.external_id if definition else None
        if explicit is not None and not explicit.isdecimal():
            raise ValueError(f"Invalid external exercise type ID for {ref}")
        targets = {
            int(id_)
            for id_ in (ref if ref.isdecimal() else None, explicit, mapped.get(ref))
            if id_ is not None
        }
        if len(targets) > 1:
            raise ValueError(f"Conflicting server exercise type IDs for {ref}")
        if targets:
            server_ids[ref] = targets.pop()
        elif definition is None:
            raise ValueError(f"Missing exercise type definition for {ref}")

    seed_refs = {
        ref: LEGACY_SEEDS[key]
        for ref in refs - server_ids.keys()
        if (key := (by_id[ref].name, by_id[ref].description)) in LEGACY_SEEDS
    }
    if seed_refs:
        # At most one released type per lower(name): uq_exercise_types_released_lower_name.
        released = dict(
            (
                await session.execute(
                    select(func.lower(ExerciseType.name), ExerciseType.id).where(
                        ExerciseType.status == "released",
                        func.lower(ExerciseType.name).in_(
                            {name.lower() for name in seed_refs.values()}
                        ),
                    )
                )
            ).all()
        )
        for ref, name in seed_refs.items():
            if name.lower() in released:
                server_ids[ref] = released[name.lower()]

    if server_ids:
        visible = set(
            await session.scalars(
                select(ExerciseType.id).where(
                    ExerciseType.id.in_(set(server_ids.values())),
                    (ExerciseType.status == "released")
                    | (ExerciseType.owner_id == user_id),
                )
            )
        )
        for ref, server_id in server_ids.items():
            if server_id not in visible:
                raise ValueError(f"Exercise type {ref} is unavailable")

    for ref in sorted(local_ids - mapped.keys()):
        if ref not in server_ids:
            definition = by_id[ref]
            # Target the partial unique index used by the private exercise editor.
            insert_candidate = (
                insert(ExerciseType)
                .values(
                    name=definition.name,
                    description=definition.description,
                    default_intensity_unit=definition.default_intensity_unit,
                    owner_id=user_id,
                    status="candidate",
                )
                .on_conflict_do_nothing(
                    index_elements=[
                        ExerciseType.owner_id,
                        func.lower(ExerciseType.name),
                    ],
                    index_where=text(
                        "owner_id IS NOT NULL AND status IN ('candidate', 'in_review')"
                    ),
                )
                .returning(ExerciseType.id)
            )
            candidate_id = await session.scalar(insert_candidate)
            if candidate_id is None:
                existing = select(ExerciseType.id).where(
                    ExerciseType.owner_id == user_id,
                    ExerciseType.status.in_(("candidate", "in_review")),
                    func.lower(ExerciseType.name) == func.lower(definition.name),
                )
                candidate_id = (await session.execute(existing)).scalar_one()
            server_ids[ref] = candidate_id
        session.add(
            GuestExerciseTypeMapping(
                user_id=user_id, guest_id=ref, exercise_type_id=server_ids[ref]
            )
        )
    return server_ids


class SyncService:
    @staticmethod
    async def sync_guest_data(
        session: AsyncSession,
        payload: GuestSyncPayload,
        user_id: int,
        idempotency_key: str | None = None,
    ) -> SyncResult:
        try:
            # Serialize imports for this account across request keys and server processes.
            await session.execute(
                select(User.id)
                .where(User.id == user_id)
                .with_for_update(key_share=True)
            )
            submitted: dict[str, GuestWorkout] = {}
            for workout_data in payload.workouts:
                if (
                    workout_data.id in submitted
                    and submitted[workout_data.id] != workout_data
                ):
                    raise ValueError(
                        f"Conflicting workouts with guest ID {workout_data.id}"
                    )
                submitted[workout_data.id] = workout_data
            workout_ids = dict(
                (
                    await session.execute(
                        select(
                            GuestWorkoutMapping.guest_id, GuestWorkoutMapping.workout_id
                        ).where(
                            GuestWorkoutMapping.user_id == user_id,
                            GuestWorkoutMapping.guest_id.in_(submitted),
                        )
                    )
                ).all()
            )
            if idempotency_key:
                log = await session.scalar(
                    select(SyncLog).where(
                        SyncLog.user_id == user_id,
                        SyncLog.idempotency_key == idempotency_key,
                    )
                )
                if log:
                    if workout_ids.keys() != submitted.keys():
                        raise ValueError(
                            "Cannot confirm every workout for this idempotency key"
                        )
                    result = SyncResult(
                        success=log.success,
                        workoutIdMap=workout_ids,
                        syncedWorkouts=log.synced_workouts,
                        syncedExercises=log.synced_exercises,
                        syncedSets=log.synced_sets,
                        syncedRoutines=log.synced_routines,
                    )
                    await session.commit()
                    return result

            pending = [w for ref, w in submitted.items() if ref not in workout_ids]
            exercise_type_map = await _resolve_exercise_types(
                session, pending, payload.exerciseTypes, user_id
            )
            synced_workouts = synced_exercises = synced_sets = 0
            workout_type_map: dict[str, int] = {}
            needed_types = {workout.workout_type_id for workout in pending}
            for guest_wt in payload.workoutTypes:
                if guest_wt.id not in needed_types:
                    continue
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

            for guest_w in pending:
                server_wt_id = workout_type_map.get(guest_w.workout_type_id)

                # Fallback: if not in map, maybe it's already a server ID
                if not server_wt_id and guest_w.workout_type_id.isdigit():
                    candidate_id = int(guest_w.workout_type_id)
                    stmt = select(WorkoutType).where(WorkoutType.id == candidate_id)
                    existing = (await session.execute(stmt)).scalar_one_or_none()
                    if existing:
                        server_wt_id = existing.id

                if not server_wt_id:
                    # Fallback to "Strength Training" resolved by name instead of ID 4
                    stmt = (
                        select(WorkoutType)
                        .where(WorkoutType.name.ilike("Strength Training"))
                        .limit(1)
                    )
                    existing_st = (await session.execute(stmt)).scalar_one_or_none()
                    if existing_st:
                        server_wt_id = existing_st.id
                    else:
                        # Ensure we have at least one valid type if seeker fails
                        new_st = WorkoutType(
                            name="Strength Training",
                            description="Default strength training type created during sync",
                        )
                        session.add(new_st)
                        await session.flush()
                        server_wt_id = new_st.id

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
                workout_ids[guest_w.id] = workout.id
                session.add(
                    GuestWorkoutMapping(
                        user_id=user_id, guest_id=guest_w.id, workout_id=workout.id
                    )
                )
                synced_workouts += 1

                for guest_e in guest_w.exercises:
                    exercise = Exercise(
                        timestamp=guest_e.timestamp or guest_w.start_time,
                        notes=guest_e.notes,
                        exercise_type_id=exercise_type_map[guest_e.exercise_type_id],
                        workout_id=workout.id,
                    )
                    session.add(exercise)
                    await session.flush()
                    synced_exercises += 1

                    used_positions: set[int] = set()
                    for fallback_position, guest_s in enumerate(guest_e.exercise_sets):
                        position = (
                            guest_s.position
                            if guest_s.position is not None
                            else fallback_position
                        )
                        if position < 0 or position in used_positions:
                            raise ValueError(
                                "Guest set positions must be unique and nonnegative"
                            )
                        used_positions.add(position)
                        exercise_set = ExerciseSet(
                            reps=guest_s.reps,
                            duration_seconds=guest_s.duration_seconds,
                            intensity=guest_s.intensity,
                            rpe=guest_s.rpe,
                            rir=guest_s.rir,
                            intensity_unit_id=guest_s.intensity_unit_id,
                            exercise_id=exercise.id,
                            rest_time_seconds=guest_s.rest_time_seconds,
                            done=guest_s.done,
                            notes=guest_s.notes,
                            type=guest_s.type,
                            side=guest_s.side,
                            position=position,
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
                    synced_routines=0,
                )
                session.add(sync_log)

            # Atomic commit of all side-effects and the idempotency mark
            await session.commit()
            return SyncResult(
                success=True,
                syncedWorkouts=synced_workouts,
                syncedExercises=synced_exercises,
                syncedSets=synced_sets,
                workoutIdMap=workout_ids,
                syncedRoutines=0,
            )
        except ValueError as exc:
            await session.rollback()
            return SyncResult(success=False, error=str(exc))
        except Exception:
            logger.exception("Bulk sync failed")
            await session.rollback()
            return SyncResult(success=False, error="Guest import failed")
