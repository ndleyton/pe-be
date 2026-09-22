from typing import Literal, Optional
from datetime import datetime
from decimal import Decimal
from pydantic import ConfigDict, BaseModel, model_validator


class ExerciseSetBase(BaseModel):
    """Base schema for exercise set data"""

    reps: Optional[int] = None
    duration_seconds: Optional[int] = None
    intensity: Optional[Decimal] = None
    rpe: Optional[Decimal] = None
    rir: Optional[Decimal] = None
    intensity_unit_id: int
    exercise_id: int
    rest_time_seconds: Optional[int] = None
    done: bool = False
    notes: Optional[str] = None
    type: Optional[str] = None
    side: Optional[Literal["left", "right", "both"]] = None
    position: Optional[int] = None


class ExerciseSetCreate(ExerciseSetBase):
    """Schema for creating exercise sets"""

    pass


class ExerciseSetUpdate(BaseModel):
    """Schema for updating exercise sets"""

    reps: Optional[int] = None
    duration_seconds: Optional[int] = None
    intensity: Optional[Decimal] = None
    rpe: Optional[Decimal] = None
    rir: Optional[Decimal] = None
    intensity_unit_id: Optional[int] = None
    rest_time_seconds: Optional[int] = None
    done: Optional[bool] = None
    notes: Optional[str] = None
    type: Optional[str] = None
    side: Optional[Literal["left", "right", "both"]] = None


class ExerciseSetRead(ExerciseSetBase):
    """Schema for reading exercise set data"""

    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ExerciseSetPairItem(BaseModel):
    reps: Optional[int] = None
    duration_seconds: Optional[int] = None
    intensity: Optional[Decimal] = None
    rpe: Optional[Decimal] = None
    rir: Optional[Decimal] = None
    intensity_unit_id: int
    rest_time_seconds: Optional[int] = None
    done: Literal[False] = False
    notes: Optional[str] = None
    type: Optional[str] = None
    side: Literal["left", "right"]


class ExerciseSetPairCreate(BaseModel):
    exercise_id: int
    sets: tuple[ExerciseSetPairItem, ExerciseSetPairItem]

    @model_validator(mode="after")
    def validate_left_then_right(self):
        if [item.side for item in self.sets] != ["left", "right"]:
            raise ValueError("sets must be ordered left then right")
        return self


class ExerciseSetOrderUpdate(BaseModel):
    ordered_set_ids: list[int]
    expected_set_ids: list[int]
