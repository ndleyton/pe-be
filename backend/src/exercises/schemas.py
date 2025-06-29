from typing import Optional, List
from datetime import datetime, timezone
from pydantic import validator, BaseModel, Field


class ExerciseBase(BaseModel):
    """Base schema for exercise data"""
    timestamp: Optional[datetime] = None
    notes: Optional[str] = None
    exercise_type_id: int
    workout_id: int

    @validator('timestamp', pre=True, always=True)
    def ensure_utc_timestamp(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            # Parse ISO string, handle 'Z' as UTC
            v = datetime.fromisoformat(v.replace('Z', '+00:00'))
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)


class ExerciseCreate(ExerciseBase):
    """Schema for creating exercises"""
    pass


class ExerciseRead(ExerciseBase):
    """Schema for reading exercise data"""
    id: int
    created_at: datetime
    updated_at: datetime
    exercise_type: 'ExerciseTypeRead'
    exercise_sets: List['ExerciseSetRead'] = []

    class Config:
        from_attributes = True


class ExerciseTypeCreate(BaseModel):
    """Schema for creating exercise types"""
    name: str = Field(..., min_length=1, description="Human-readable exercise type name")
    description: str = "Custom exercise"
    default_intensity_unit: int = 1

    @validator('name', pre=True)
    def validate_and_strip_name(cls, v):
        if v is None:
            raise ValueError('Name cannot be empty')
        v = v.strip()
        if not v:
            raise ValueError('Name cannot be empty')
        return v


class MuscleGroupRead(BaseModel):
    """Schema for reading muscle group data"""
    id: int
    name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MuscleRead(BaseModel):
    """Schema for reading muscle data"""
    id: int
    name: str
    muscle_group_id: int
    muscle_group: MuscleGroupRead
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExerciseTypeRead(BaseModel):
    """Schema for reading exercise type data"""
    id: int
    name: str
    description: str
    default_intensity_unit: int
    times_used: int
    muscles: List[MuscleRead] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IntensityUnitRead(BaseModel):
    """Schema for reading intensity unit data"""
    id: int
    name: str
    abbreviation: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Forward reference will be resolved by Pydantic
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.exercise_sets.schemas import ExerciseSetRead 

# Runtime import to ensure forward refs are available when model_rebuild is executed
from src.exercise_sets.schemas import ExerciseSetRead  # noqa: E402,F401

# After all class definitions, resolve forward references
ExerciseRead.model_rebuild() 