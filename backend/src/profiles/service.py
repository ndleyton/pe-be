from sqlalchemy.ext.asyncio import AsyncSession

from src.profiles import crud
from src.profiles.schemas import (
    PaginatedPublicWorkoutActivities,
    PublicExerciseSetRead,
    PublicProfileRead,
    PublicWorkoutActivityRead,
    PublicWorkoutActivitySummary,
    PublicWorkoutExerciseRead,
    PublicWorkoutTypeRead,
    SavePublicWorkoutAsRoutineRequest,
)
from src.routines.service import routine_service
from src.workouts.schemas import SaveWorkoutAsRoutineRequest
from src.workouts.models import Workout


class ProfileNotFoundError(LookupError):
    pass


def _duration_seconds(workout: Workout) -> int | None:
    if workout.start_time is None or workout.end_time is None:
        return None
    return max(0, int((workout.end_time - workout.start_time).total_seconds()))


def _summary(
    workout: Workout,
    exercise_count: int | None = None,
    set_count: int | None = None,
    exercise_names_preview: list[str] | None = None,
) -> PublicWorkoutActivitySummary:
    active_exercises = [
        exercise for exercise in workout.exercises if exercise.deleted_at is None
    ]
    if exercise_count is None:
        exercise_count = len(active_exercises)
    if set_count is None:
        set_count = sum(
            1
            for exercise in active_exercises
            for exercise_set in exercise.exercise_sets
            if exercise_set.deleted_at is None
        )
    if exercise_names_preview is None:
        exercise_names_preview = [
            exercise.exercise_type.name
            for exercise in active_exercises
            if exercise.exercise_type is not None
        ][:3]

    return PublicWorkoutActivitySummary(
        id=workout.id,
        name=workout.name,
        workout_type=PublicWorkoutTypeRead(
            id=workout.workout_type.id,
            name=workout.workout_type.name,
        ),
        start_time=workout.start_time,
        end_time=workout.end_time,
        duration_seconds=_duration_seconds(workout),
        exercise_count=exercise_count,
        set_count=set_count,
        exercise_names_preview=exercise_names_preview,
    )


def _activity_detail(workout: Workout) -> PublicWorkoutActivityRead:
    summary = _summary(workout)
    exercises = []
    for exercise in workout.exercises:
        if exercise.deleted_at is not None:
            continue
        sets = [
            PublicExerciseSetRead.model_validate(exercise_set, from_attributes=True)
            for exercise_set in exercise.exercise_sets
            if exercise_set.deleted_at is None
        ]
        exercises.append(
            PublicWorkoutExerciseRead(
                id=exercise.id,
                exercise_type=exercise.exercise_type,
                sets=sets,
            )
        )
    return PublicWorkoutActivityRead(**summary.model_dump(), exercises=exercises)


class ProfileService:
    async def get_public_profile(
        self, session: AsyncSession, username: str
    ) -> PublicProfileRead:
        user = await crud.get_public_user_by_username(session, username)
        if user is None or user.username is None:
            raise ProfileNotFoundError("Profile not found")
        count, last_activity_at = await crud.get_public_activity_stats(session, user.id)
        return PublicProfileRead(
            username=user.username,
            display_name=user.name,
            bio=user.bio,
            avatar_url=user.avatar_url,
            public_workout_count=count,
            last_public_activity_at=last_activity_at,
        )

    async def list_public_activities(
        self,
        session: AsyncSession,
        username: str,
        *,
        cursor: int | None,
        limit: int,
    ) -> PaginatedPublicWorkoutActivities:
        user = await crud.get_public_user_by_username(session, username)
        if user is None:
            raise ProfileNotFoundError("Profile not found")

        rows = await crud.get_public_activity_summaries(
            session, user.id, cursor=cursor, limit=limit
        )
        activities = [
            _summary(workout, exercise_count, set_count, names)
            for workout, exercise_count, set_count, names in rows
        ]
        next_cursor = activities[-1].id if len(activities) == limit else None
        return PaginatedPublicWorkoutActivities(
            data=activities, next_cursor=next_cursor
        )

    async def get_public_activity(
        self, session: AsyncSession, username: str, workout_id: int
    ) -> PublicWorkoutActivityRead:
        user = await crud.get_public_user_by_username(session, username)
        if user is None:
            raise ProfileNotFoundError("Activity not found")
        workout = await crud.get_public_activity_detail(session, user.id, workout_id)
        if workout is None:
            raise ProfileNotFoundError("Activity not found")
        return _activity_detail(workout)

    async def save_public_activity_as_routine(
        self,
        session: AsyncSession,
        username: str,
        workout_id: int,
        user_id: int,
        clone_request: SavePublicWorkoutAsRoutineRequest | None,
    ):
        source_user = await crud.get_public_user_by_username(session, username)
        if source_user is None:
            raise ProfileNotFoundError("Activity not found")
        source_workout = await crud.get_public_activity_detail(
            session, source_user.id, workout_id
        )
        if source_workout is None:
            raise ProfileNotFoundError("Activity not found")
        default_name = source_workout.name or f"Workout from @{source_user.username}"
        return await routine_service.clone_public_workout_to_private_routine(
            session,
            source_workout_id=workout_id,
            user_id=user_id,
            source_owner_id=source_user.id,
            clone_request=SaveWorkoutAsRoutineRequest(
                name=clone_request.name
                if clone_request and clone_request.name
                else default_name,
                description=clone_request.description if clone_request else None,
            ),
        )


profile_service = ProfileService()
