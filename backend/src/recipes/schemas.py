from typing import Optional, List
from datetime import datetime
from pydantic import ConfigDict, BaseModel, Field
from src.recipes.models import Recipe as RecipeModel


class ExerciseTypeRead(BaseModel):
    """Schema for reading exercise types in recipes"""

    id: int
    name: str
    description: Optional[str] = None
    default_intensity_unit: int
    times_used: int
    model_config = ConfigDict(from_attributes=True)


class IntensityUnitRead(BaseModel):
    """Schema for reading intensity units in recipes"""

    id: int
    name: str
    abbreviation: str
    model_config = ConfigDict(from_attributes=True)


class SetTemplateBase(BaseModel):
    """Base schema for set template data"""

    reps: Optional[int] = None
    intensity: Optional[float] = None
    intensity_unit_id: int


class SetTemplateCreate(SetTemplateBase):
    """Schema for creating set templates"""

    pass


class SetTemplateRead(SetTemplateBase):
    """Schema for reading set templates"""

    id: int
    created_at: datetime
    updated_at: datetime
    intensity_unit: Optional[IntensityUnitRead] = None
    model_config = ConfigDict(from_attributes=True)


class ExerciseTemplateBase(BaseModel):
    """Base schema for exercise template data"""

    exercise_type_id: int


class ExerciseTemplateCreate(ExerciseTemplateBase):
    """Schema for creating exercise templates"""

    set_templates: List[SetTemplateCreate] = []


class ExerciseTemplateRead(ExerciseTemplateBase):
    """Schema for reading exercise templates"""

    id: int
    created_at: datetime
    updated_at: datetime
    exercise_type: Optional[ExerciseTypeRead] = None
    set_templates: List[SetTemplateRead] = []
    model_config = ConfigDict(from_attributes=True)


class RecipeBase(BaseModel):
    """Base schema for recipe data"""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    workout_type_id: int


class RecipeCreate(RecipeBase):
    """Schema for creating recipes"""

    exercise_templates: List[ExerciseTemplateCreate] = []


class RecipeRead(RecipeBase):
    """Schema for reading recipes"""

    id: int
    creator_id: int
    visibility: RecipeModel.RecipeVisibility
    is_readonly: bool
    created_at: datetime
    updated_at: datetime
    exercise_templates: List[ExerciseTemplateRead] = []
    model_config = ConfigDict(from_attributes=True)


class RecipeUpdate(BaseModel):
    """Schema for updating recipes"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    workout_type_id: Optional[int] = None


# Pydantic schema reuses model enum to avoid drift
RecipeVisibility = RecipeModel.RecipeVisibility


class AdminRecipeCreate(RecipeBase):
    """Admin-only creation schema with additional controls.

    Allows setting visibility and is_readonly at creation time.
    """

    exercise_templates: List[ExerciseTemplateCreate] = []
    visibility: Optional[RecipeVisibility] = None
    is_readonly: Optional[bool] = None
