from typing import Optional, List
from datetime import datetime, timezone
from fastapi_users import schemas
from pydantic import validator, BaseModel, Field

class UserRead(schemas.BaseUser[int]):
    pass


class UserCreate(schemas.BaseUserCreate):
    pass


class UserUpdate(schemas.BaseUserUpdate):
    pass


# --- Workout Schemas ---

class ExerciseBase(BaseModel):
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
    pass

class ExerciseRead(ExerciseBase):
    id: int
    created_at: datetime
    updated_at: datetime
    exercise_type: 'ExerciseTypeRead'

    class Config:
        orm_mode = True # For SQLAlchemy model conversion

class WorkoutBase(BaseModel):
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

class WorkoutUpdate(WorkoutBase):
    workout_type_id: Optional[int] = None

class WorkoutRead(WorkoutBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True # For SQLAlchemy model conversion

# --- Workout Type Schemas ---

class WorkoutTypeRead(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True # For SQLAlchemy model conversion

# --- Exercise Type Schemas ---

class ExerciseTypeCreate(BaseModel):
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

class ExerciseTypeRead(BaseModel):
    id: int
    name: str
    description: str
    default_intensity_unit: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True  # For SQLAlchemy model conversion