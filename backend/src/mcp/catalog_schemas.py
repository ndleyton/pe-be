from pydantic import BaseModel


class PublicMuscleDTO(BaseModel):
    id: int
    name: str
    group_id: int
    group: str
    is_primary: bool


class PublicExerciseTypeDTO(BaseModel):
    id: int
    name: str
    description: str | None
    equipment: str | None
    category: str | None
    instructions: str | None
    images_url: str | None
    muscles: list[PublicMuscleDTO]


class PublicSubstitutionItemDTO(BaseModel):
    exercise: PublicExerciseTypeDTO
    match_reason: str


class MuscleDTO(BaseModel):
    id: int
    name: str


class MuscleGroupDTO(BaseModel):
    id: int
    name: str
    muscles: list[MuscleDTO]
