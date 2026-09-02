from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class WorkoutSetInput(BaseModel):
    reps: int | None = Field(default=None, ge=0, le=1000)
    duration_seconds: int | None = Field(default=None, ge=0, le=86400)
    intensity: Decimal | None = Field(default=None, ge=0, le=100000)
    intensity_unit: str | None = Field(default=None, max_length=30)
    rpe: Decimal | None = Field(default=None, ge=0, le=10)
    rir: Decimal | None = Field(default=None, ge=0, le=20)
    rest_time_seconds: int | None = Field(default=None, ge=0, le=7200)
    notes: str | None = Field(default=None, max_length=1000)
    type: str | None = Field(default=None, max_length=30)
    done: bool = True

    @model_validator(mode="after")
    def require_reps_or_duration(self) -> "WorkoutSetInput":
        if self.reps is None and self.duration_seconds is None:
            raise ValueError("Each set requires reps or duration_seconds")
        return self


class WorkoutExerciseInput(BaseModel):
    exercise_type_id: int | None = Field(default=None, ge=1)
    exercise_name: str | None = Field(default=None, min_length=1, max_length=150)
    notes: str | None = Field(default=None, max_length=1000)
    sets: list[WorkoutSetInput] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def require_one_identifier(self) -> "WorkoutExerciseInput":
        if (self.exercise_type_id is None) == (self.exercise_name is None):
            raise ValueError("Provide exactly one of exercise_type_id or exercise_name")
        return self


class WorkoutLogInput(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    workout_type_id: int | None = Field(default=None, ge=1)
    start_time: datetime | None = None
    end_time: datetime | None = None
    notes: str | None = Field(default=None, max_length=1000)
    exercises: list[WorkoutExerciseInput] = Field(min_length=1, max_length=20)
    idempotency_key: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def validate_times(self) -> "WorkoutLogInput":
        if self.start_time and self.end_time and self.end_time < self.start_time:
            raise ValueError("end_time must not precede start_time")
        return self


class RoutineSetInput(BaseModel):
    reps: int | None = Field(default=None, ge=0, le=1000)
    duration_seconds: int | None = Field(default=None, ge=0, le=86400)
    intensity: Decimal | None = Field(default=None, ge=0, le=100000)
    intensity_unit: str | None = Field(default=None, max_length=30)
    rpe: Decimal | None = Field(default=None, ge=0, le=10)
    rir: Decimal | None = Field(default=None, ge=0, le=20)
    notes: str | None = Field(default=None, max_length=1000)
    type: str | None = Field(default=None, max_length=30)


class RoutineExerciseInput(BaseModel):
    exercise_type_id: int | None = Field(default=None, ge=1)
    exercise_name: str | None = Field(default=None, min_length=1, max_length=150)
    notes: str | None = Field(default=None, max_length=1000)
    sets: list[RoutineSetInput] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def require_one_identifier(self) -> "RoutineExerciseInput":
        if (self.exercise_type_id is None) == (self.exercise_name is None):
            raise ValueError("Provide exactly one of exercise_type_id or exercise_name")
        return self


class RoutineCreationInput(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    workout_type_id: int | None = Field(default=None, ge=1)
    exercises: list[RoutineExerciseInput] = Field(min_length=1, max_length=20)
    idempotency_key: str = Field(min_length=8, max_length=128)


class SetSummaryOutput(BaseModel):
    reps: int | None
    duration_seconds: int | None
    intensity: Decimal | None
    intensity_unit: str | None
    rpe: Decimal | None
    rir: Decimal | None
    notes: str | None


class ExerciseSummaryOutput(BaseModel):
    exercise_type_id: int
    name: str
    notes: str | None
    sets: list[SetSummaryOutput]


class WorkoutSummaryOutput(BaseModel):
    workout_id: int
    name: str | None
    start_time: datetime | None
    end_time: datetime | None
    notes: str | None
    exercises: list[ExerciseSummaryOutput]


class WorkoutDateSummaryOutput(BaseModel):
    date: date
    timezone: str
    workouts: list[WorkoutSummaryOutput]


class ExercisePerformanceOutput(BaseModel):
    exercise_type_id: int
    exercise_name: str
    workout_id: int
    performed_at: datetime | None
    sets: list[SetSummaryOutput]


class MutationResultOutput(BaseModel):
    id: int
    created: bool
    message: str


class WorkoutRecapOutput(BaseModel):
    workout_id: int
    recap: str | None
    generated: bool = False
