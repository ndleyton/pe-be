from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


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
    
    class Config:
        from_attributes = True


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
    set_templates: List[SetTemplateRead] = []
    
    class Config:
        from_attributes = True


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
    created_at: datetime
    updated_at: datetime
    exercise_templates: List[ExerciseTemplateRead] = []
    
    class Config:
        from_attributes = True


class RecipeUpdate(BaseModel):
    """Schema for updating recipes"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    workout_type_id: Optional[int] = None