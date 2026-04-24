from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.routines.schemas import RoutineRead


class PublicProfileRead(BaseModel):
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    public_workout_count: int
    last_public_activity_at: Optional[datetime] = None


class PublicWorkoutTypeRead(BaseModel):
    id: int
    name: str


class PublicWorkoutActivitySummary(BaseModel):
    id: int
    name: Optional[str] = None
    workout_type: PublicWorkoutTypeRead
    start_time: Optional[datetime] = None
    end_time: datetime
    duration_seconds: Optional[int] = None
    exercise_count: int
    set_count: int
    exercise_names_preview: List[str]


class PaginatedPublicWorkoutActivities(BaseModel):
    data: List[PublicWorkoutActivitySummary]
    next_cursor: Optional[int] = None


class PublicIntensityUnitRead(BaseModel):
    id: int
    name: str
    abbreviation: str
    model_config = ConfigDict(from_attributes=True)


class PublicExerciseTypeRead(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)


class PublicExerciseSetRead(BaseModel):
    reps: Optional[int] = None
    duration_seconds: Optional[int] = None
    intensity: Optional[Decimal] = None
    rpe: Optional[Decimal] = None
    rir: Optional[Decimal] = None
    intensity_unit: Optional[PublicIntensityUnitRead] = None
    type: Optional[str] = None


class PublicWorkoutExerciseRead(BaseModel):
    exercise_type: PublicExerciseTypeRead
    sets: List[PublicExerciseSetRead]


class PublicWorkoutActivityRead(PublicWorkoutActivitySummary):
    exercises: List[PublicWorkoutExerciseRead]


class SavePublicWorkoutAsRoutineRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None


class SavePublicWorkoutAsRoutineResponse(RoutineRead):
    pass
