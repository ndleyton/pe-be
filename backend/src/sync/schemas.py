from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
from pydantic import BaseModel, field_validator

class GuestIntensityUnit(BaseModel):
    id: int
    name: str

class GuestExerciseType(BaseModel):
    id: str  # Guest UUID
    name: str
    description: Optional[str] = None
    default_intensity_unit: Optional[int] = None

class GuestWorkoutType(BaseModel):
    id: str  # Guest UUID
    name: str
    description: Optional[str] = None

class GuestExerciseSet(BaseModel):
    id: str
    reps: Optional[int] = None
    duration_seconds: Optional[int] = None
    intensity: Optional[Decimal] = None
    rpe: Optional[Decimal] = None
    intensity_unit_id: int
    rest_time_seconds: Optional[int] = None
    done: bool = False
    notes: Optional[str] = None

class GuestExercise(BaseModel):
    id: str
    timestamp: Optional[datetime] = None
    notes: Optional[str] = None
    exercise_type_id: str
    exercise_sets: List[GuestExerciseSet] = []

    @field_validator("timestamp", mode="before")
    @classmethod
    def ensure_utc(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            v = datetime.fromisoformat(v.replace("Z", "+00:00"))
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)

class GuestWorkout(BaseModel):
    id: str
    name: Optional[str] = None
    notes: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    workout_type_id: str
    exercises: List[GuestExercise] = []

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def ensure_utc(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            v = datetime.fromisoformat(v.replace("Z", "+00:00"))
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)

class GuestSyncPayload(BaseModel):
    workouts: List[GuestWorkout] = []
    exerciseTypes: List[GuestExerciseType] = []
    workoutTypes: List[GuestWorkoutType] = []

class SyncResult(BaseModel):
    success: bool
    syncedWorkouts: int
    syncedExercises: int
    syncedSets: int
    syncedRoutines: int
