from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.exercise_sets.models import ExerciseSet
from src.exercises.models import Exercise, ExerciseType
from src.mcp.trainer_schemas import (
    ExercisePerformanceOutput,
    ExerciseSummaryOutput,
    SetSummaryOutput,
    WorkoutDateSummaryOutput,
    WorkoutSummaryOutput,
)
from src.workouts.models import Workout


def _set_summary(item: ExerciseSet) -> SetSummaryOutput:
    return SetSummaryOutput(
        reps=item.reps,
        duration_seconds=item.duration_seconds,
        intensity=item.intensity,
        intensity_unit=(
            item.intensity_unit.abbreviation if item.intensity_unit else None
        ),
        rpe=item.rpe,
        rir=item.rir,
        notes=item.notes,
    )


def _workout_summary(workout: Workout) -> WorkoutSummaryOutput:
    return WorkoutSummaryOutput(
        workout_id=workout.id,
        name=workout.name,
        start_time=workout.start_time,
        end_time=workout.end_time,
        notes=workout.notes,
        exercises=[
            ExerciseSummaryOutput(
                exercise_type_id=exercise.exercise_type_id,
                name=exercise.exercise_type.name,
                notes=exercise.notes,
                sets=[_set_summary(item) for item in exercise.exercise_sets],
            )
            for exercise in workout.exercises
        ],
    )


def _workout_graph_options():
    return (
        selectinload(Workout.exercises.and_(Exercise.deleted_at.is_(None))).joinedload(
            Exercise.exercise_type
        ),
        selectinload(Workout.exercises.and_(Exercise.deleted_at.is_(None)))
        .selectinload(Exercise.exercise_sets.and_(ExerciseSet.deleted_at.is_(None)))
        .joinedload(ExerciseSet.intensity_unit),
    )


class WorkoutHistoryService:
    async def get_last_workout_summary(
        self, session: AsyncSession, user_id: int
    ) -> WorkoutSummaryOutput | None:
        result = await session.execute(
            select(Workout)
            .options(*_workout_graph_options())
            .where(Workout.owner_id == user_id)
            .order_by(Workout.start_time.desc().nullslast(), Workout.id.desc())
            .limit(1)
        )
        workout = result.unique().scalar_one_or_none()
        return _workout_summary(workout) if workout else None

    async def get_workout_summary_by_date(
        self,
        session: AsyncSession,
        user_id: int,
        workout_date: date,
        user_timezone: str,
    ) -> WorkoutDateSummaryOutput:
        try:
            tz = ZoneInfo(user_timezone)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Invalid user timezone") from exc
        start = datetime.combine(workout_date, time.min, tzinfo=tz).astimezone(
            timezone.utc
        )
        end = datetime.combine(
            workout_date + timedelta(days=1), time.min, tzinfo=tz
        ).astimezone(timezone.utc)
        result = await session.execute(
            select(Workout)
            .options(*_workout_graph_options())
            .where(
                Workout.owner_id == user_id,
                Workout.start_time >= start,
                Workout.start_time < end,
            )
            .order_by(Workout.start_time.asc(), Workout.id.asc())
        )
        workouts = result.unique().scalars().all()
        return WorkoutDateSummaryOutput(
            date=workout_date,
            timezone=user_timezone,
            workouts=[_workout_summary(workout) for workout in workouts],
        )

    async def get_last_exercise_performance(
        self, session: AsyncSession, user_id: int, exercise_name: str
    ) -> ExercisePerformanceOutput | None:
        result = await session.execute(
            select(Exercise)
            .join(Workout, Workout.id == Exercise.workout_id)
            .join(ExerciseType, ExerciseType.id == Exercise.exercise_type_id)
            .options(
                selectinload(
                    Exercise.exercise_sets.and_(ExerciseSet.deleted_at.is_(None))
                ).joinedload(ExerciseSet.intensity_unit),
                selectinload(Exercise.exercise_type),
                selectinload(Exercise.workout),
            )
            .where(
                Workout.owner_id == user_id,
                Exercise.deleted_at.is_(None),
                func.lower(ExerciseType.name) == exercise_name.strip().lower(),
            )
            .order_by(Workout.start_time.desc().nullslast(), Exercise.id.desc())
            .limit(1)
        )
        exercise = result.unique().scalar_one_or_none()
        if exercise is None:
            return None
        return ExercisePerformanceOutput(
            exercise_type_id=exercise.exercise_type_id,
            exercise_name=exercise.exercise_type.name,
            workout_id=exercise.workout_id,
            performed_at=exercise.workout.start_time,
            sets=[_set_summary(item) for item in exercise.exercise_sets],
        )
