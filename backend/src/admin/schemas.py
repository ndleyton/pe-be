from __future__ import annotations

from pydantic import BaseModel, ConfigDict, model_validator


class AdminExerciseImageOption(BaseModel):
    key: str
    label: str
    description: str
    option_source: str
    images: list[str]
    candidate_ids: list[int]
    source_images: list[str]
    is_current: bool
    model_config = ConfigDict(populate_by_name=True)


class AdminExerciseImageOptionSpec(BaseModel):
    key: str
    label: str
    description: str
    option_source: str
    model_config = ConfigDict(populate_by_name=True)


class AdminExerciseImageOptionsResponse(BaseModel):
    exercise_type_id: int
    exercise_name: str
    current_images: list[str]
    reference_images: list[str]
    supports_revert_to_reference: bool
    available_options: list[AdminExerciseImageOptionSpec]
    options: list[AdminExerciseImageOption]


class AdminGenerateExerciseImageOptionsRequest(BaseModel):
    option_key: str | None = None


class AdminApplyExerciseImageOptionRequest(BaseModel):
    option_key: str | None = None
    use_reference: bool = False

    @model_validator(mode="after")
    def validate_choice(self) -> "AdminApplyExerciseImageOptionRequest":
        if self.use_reference and self.option_key:
            raise ValueError("Choose either use_reference or option_key, not both")
        if not self.use_reference and not self.option_key:
            raise ValueError("An option_key is required unless use_reference is true")
        return self
