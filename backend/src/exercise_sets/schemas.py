from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class ExerciseSetBase(BaseModel):
    """Base schema for exercise set data"""

    reps: Optional[int] = None
    intensity: Optional[float] = None
    intensity_unit_id: int
    exercise_id: int
    rest_time_seconds: Optional[int] = None
    done: bool = False
    notes: Optional[str] = None
    type: Optional[str] = None


class ExerciseSetCreate(ExerciseSetBase):
    """Schema for creating exercise sets"""

    pass


class ExerciseSetUpdate(BaseModel):
    """Schema for updating exercise sets"""

    reps: Optional[int] = None
    intensity: Optional[float] = None
    intensity_unit_id: Optional[int] = None
    rest_time_seconds: Optional[int] = None
    done: Optional[bool] = None
    notes: Optional[str] = None
    type: Optional[str] = None


class ExerciseSetRead(ExerciseSetBase):
    """Schema for reading exercise set data"""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
