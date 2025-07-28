from typing import Optional, List, TYPE_CHECKING, Any
from datetime import datetime, timezone, date
from pydantic import (
    ConfigDict,
    field_validator,
    BaseModel,
    Field,
    computed_field,
    model_validator,
)
import json
from src.core.config import settings


class ExerciseBase(BaseModel):
    """Base schema for exercise data"""

    timestamp: Optional[datetime] = None
    notes: Optional[str] = None
    exercise_type_id: int
    workout_id: int

    @field_validator("timestamp", mode="before")
    @classmethod
    def ensure_utc_timestamp(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            # Parse ISO string, handle 'Z' as UTC
            v = datetime.fromisoformat(v.replace("Z", "+00:00"))
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
    exercise_type: "ExerciseTypeRead"
    exercise_sets: List["ExerciseSetRead"] = []
    model_config = ConfigDict(from_attributes=True)


class ExerciseTypeCreate(BaseModel):
    """Schema for creating exercise types"""

    name: str = Field(
        ..., min_length=1, description="Human-readable exercise type name"
    )
    description: str = "Custom exercise"
    default_intensity_unit: int = 1
    muscle_ids: Optional[List[int]] = Field(
        default=None,
        description="List of muscle IDs to associate with this exercise type (optional)",
    )

    @field_validator("name", mode="before")
    @classmethod
    def validate_and_strip_name(cls, v):
        if v is None:
            raise ValueError("Name cannot be empty")
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v


class MuscleGroupRead(BaseModel):
    """Schema for reading muscle group data"""

    id: int
    name: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MuscleRead(BaseModel):
    """Schema for reading muscle data"""

    id: int
    name: str
    muscle_group_id: int
    muscle_group: MuscleGroupRead
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ExerciseTypeRead(BaseModel):
    """Schema for reading exercise type data"""

    id: int
    name: str
    description: str
    default_intensity_unit: int
    times_used: int
    muscles: List[MuscleRead] = []
    images_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def extract_muscles_from_relationship(cls, data: Any) -> Any:
        """Extract muscles from exercise_muscles relationship"""
        if isinstance(data, dict):
            return data

        # Handle SQLAlchemy model objects
        if hasattr(data, "exercise_muscles") and hasattr(data, "__dict__"):
            # Convert to dict first
            result = {}
            for key, value in data.__dict__.items():
                if not key.startswith("_"):
                    result[key] = value

            # Extract muscles from exercise_muscles relationship
            if data.exercise_muscles:
                result["muscles"] = [
                    {
                        "id": em.muscle.id,
                        "name": em.muscle.name,
                        "muscle_group_id": em.muscle.muscle_group_id,
                        "muscle_group": {
                            "id": em.muscle.muscle_group.id,
                            "name": em.muscle.muscle_group.name,
                            "created_at": em.muscle.muscle_group.created_at,
                            "updated_at": em.muscle.muscle_group.updated_at,
                        },
                        "created_at": em.muscle.created_at,
                        "updated_at": em.muscle.updated_at,
                    }
                    for em in data.exercise_muscles
                    if hasattr(em, "muscle")
                    and em.muscle
                    and hasattr(em.muscle, "muscle_group")
                    and em.muscle.muscle_group
                ]
            else:
                result["muscles"] = []

            return result

        return data

    @computed_field
    @property
    def images(self) -> List[str]:
        """Process image URLs with IMAGE_URL_PREFIX for relative URLs"""
        if not self.images_url:
            return []

        try:
            image_list = (
                json.loads(self.images_url)
                if isinstance(self.images_url, str)
                else self.images_url
            )
            if not isinstance(image_list, list):
                return []

            processed_images = []
            for image_url in image_list:
                if not image_url:
                    continue

                # If it's already an absolute URL, use as-is
                if image_url.startswith(("http://", "https://")):
                    processed_images.append(image_url)
                else:
                    # For relative URLs, prepend the IMAGE_URL_PREFIX
                    if settings.IMAGE_URL_PREFIX:
                        processed_images.append(
                            f"{settings.IMAGE_URL_PREFIX.rstrip('/')}/{image_url.lstrip('/')}"
                        )
                    else:
                        processed_images.append(image_url)

            return processed_images
        except (json.JSONDecodeError, TypeError):
            return []

    model_config = ConfigDict(from_attributes=True)


class IntensityUnitRead(BaseModel):
    """Schema for reading intensity unit data"""

    id: int
    name: str
    abbreviation: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


if TYPE_CHECKING:
    from src.exercise_sets.schemas import ExerciseSetRead

# Runtime import to ensure forward refs are available when model_rebuild is executed
from src.exercise_sets.schemas import ExerciseSetRead  # noqa: E402,F401

# After all class definitions, resolve forward references
ExerciseRead.model_rebuild()


# Exercise Type Statistics Schemas
class ProgressiveOverloadStat(BaseModel):
    """Schema for progressive overload data points"""

    date: date
    max_weight: float = Field(..., alias="maxWeight")
    total_volume: float = Field(..., alias="totalVolume")
    reps: int
    model_config = ConfigDict(populate_by_name=True)


class LastWorkoutStat(BaseModel):
    """Schema for last workout statistics"""

    date: datetime
    sets: int
    total_reps: int = Field(..., alias="totalReps")
    max_weight: float = Field(..., alias="maxWeight")
    total_volume: float = Field(..., alias="totalVolume")
    model_config = ConfigDict(populate_by_name=True)


class PersonalBestStat(BaseModel):
    """Schema for personal best statistics"""

    date: datetime
    weight: float
    reps: int
    volume: float
    model_config = ConfigDict(populate_by_name=True)


class IntensityUnitSummary(BaseModel):
    """Schema for intensity unit summary"""

    id: int
    name: str
    abbreviation: str
    model_config = ConfigDict(populate_by_name=True)


class ExerciseTypeStats(BaseModel):
    """Schema for comprehensive exercise type statistics"""

    progressive_overload: List[ProgressiveOverloadStat] = Field(
        ..., alias="progressiveOverload"
    )
    last_workout: Optional[LastWorkoutStat] = Field(None, alias="lastWorkout")
    personal_best: Optional[PersonalBestStat] = Field(None, alias="personalBest")
    total_sets: int = Field(..., alias="totalSets")
    intensity_unit: Optional[IntensityUnitSummary] = Field(None, alias="intensityUnit")
    model_config = ConfigDict(populate_by_name=True)


class PaginatedExerciseTypesResponse(BaseModel):
    """Schema for paginated exercise types response"""

    data: List[ExerciseTypeRead]
    next_cursor: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)
