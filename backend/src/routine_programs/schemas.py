from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.routine_programs.models import RoutineProgram


class RoutineProgramRoutineSummary(BaseModel):
    id: int
    name: str
    exercise_count: int
    set_count: int
    exercise_names_preview: List[str]

    model_config = ConfigDict(from_attributes=True)


class RoutineProgramDayBase(BaseModel):
    routine_id: int
    day_label: str = Field(..., min_length=1, max_length=255)
    sort_order: int
    week_number: Optional[int] = None
    phase_label: Optional[str] = None
    notes: Optional[str] = None


class RoutineProgramDayCreate(RoutineProgramDayBase):
    pass


class RoutineProgramDayRead(RoutineProgramDayBase):
    id: int
    routine: RoutineProgramRoutineSummary
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoutineProgramBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    visibility: Optional[RoutineProgram.ProgramVisibility] = None
    author: Optional[str] = None
    category: Optional[str] = None
    source_label: Optional[str] = None


class RoutineProgramCreate(RoutineProgramBase):
    days: List[RoutineProgramDayCreate] = []


class AdminRoutineProgramCreate(RoutineProgramCreate):
    is_readonly: Optional[bool] = None


class RoutineProgramUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    visibility: Optional[RoutineProgram.ProgramVisibility] = None
    author: Optional[str] = None
    category: Optional[str] = None
    source_label: Optional[str] = None
    days: Optional[List[RoutineProgramDayCreate]] = None


class RoutineProgramSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    creator_id: int
    visibility: RoutineProgram.ProgramVisibility
    author: Optional[str] = None
    category: Optional[str] = None
    source_label: Optional[str] = None
    is_readonly: bool
    times_used: int
    day_count: int
    routine_count: int
    exercise_count: int
    set_count: int
    day_labels_preview: List[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoutineProgramRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    creator_id: int
    visibility: RoutineProgram.ProgramVisibility
    author: Optional[str] = None
    category: Optional[str] = None
    source_label: Optional[str] = None
    is_readonly: bool
    times_used: int
    created_at: datetime
    updated_at: datetime
    days: List[RoutineProgramDayRead]

    model_config = ConfigDict(from_attributes=True)
