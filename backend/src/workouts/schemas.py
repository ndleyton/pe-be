from typing import Optional, List
from datetime import datetime, timezone
from pydantic import validator, BaseModel, Field


class WorkoutBase(BaseModel):
    """Base schema for workout data"""
    name: Optional[str] = None
    notes: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    workout_type_id: int

    @validator('start_time', 'end_time', pre=True, always=True)
    def ensure_utc(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            # Parse ISO string, handle 'Z' as UTC
            v = datetime.fromisoformat(v.replace('Z', '+00:00'))
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)


class WorkoutCreate(WorkoutBase):
    """Schema for creating workouts"""
    pass


class WorkoutUpdate(WorkoutBase):
    """Schema for updating workouts"""
    workout_type_id: Optional[int] = None


class WorkoutRead(WorkoutBase):
    """Schema for reading workout data"""
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkoutTypeRead(BaseModel):
    """Schema for reading workout type data"""
    id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkoutTypeCreate(BaseModel):
    """Schema for creating workout types"""
    name: str = Field(..., min_length=1, description="Human-readable workout type name")
    description: str = "Custom workout type"

    @validator('name', pre=True)
    def validate_and_strip_name(cls, v):
        if v is None:
            raise ValueError('Name cannot be empty')
        v = v.strip()
        if not v:
            raise ValueError('Name cannot be empty')
        return v


# Workout parsing schemas
class WorkoutParseRequest(BaseModel):
    """Schema for workout text parsing request"""
    workout_text: str = Field(..., min_length=1, description="Raw workout text to parse")


class ParsedExerciseSet(BaseModel):
    """Schema for a parsed exercise set"""
    reps: Optional[int] = None
    intensity: Optional[float] = None
    intensity_unit: str
    rest_time_seconds: Optional[int] = None


class ParsedExercise(BaseModel):
    """Schema for a parsed exercise"""
    exercise_type_name: str
    notes: Optional[str] = None
    sets: List[ParsedExerciseSet]


class WorkoutParseResponse(BaseModel):
    """Schema for workout parsing response"""
    name: str
    notes: Optional[str] = None
    workout_type_id: int
    exercises: List[ParsedExercise]