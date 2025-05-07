from typing import Optional, List
from datetime import datetime
from fastapi_users import schemas

class UserRead(schemas.BaseUser[int]):
    pass


class UserCreate(schemas.BaseUserCreate):
    pass


class UserUpdate(schemas.BaseUserUpdate):
    pass


# --- Workout Schemas ---
class WorkoutBase(schemas.BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    workout_type_id: int

class WorkoutRead(WorkoutBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True # For SQLAlchemy model conversion