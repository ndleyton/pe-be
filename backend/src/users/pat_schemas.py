from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

PATScope = Literal["trainer:read", "trainer:write"]


class PersonalAccessTokenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    scopes: list[PATScope] = Field(min_length=1, max_length=2)
    expires_in_days: int | None = Field(default=None, ge=1)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("scopes")
    @classmethod
    def deduplicate_scopes(cls, value: list[PATScope]) -> list[PATScope]:
        scopes = list(dict.fromkeys(value))
        if "trainer:write" in scopes and "trainer:read" not in scopes:
            raise ValueError("trainer:write requires trainer:read")
        return scopes


class PersonalAccessTokenSummary(BaseModel):
    id: int
    name: str
    token_prefix: str
    scopes: list[str]
    expires_at: datetime
    revoked_at: datetime | None
    last_used_at: datetime | None
    created_at: datetime


class PersonalAccessTokenCreated(PersonalAccessTokenSummary):
    token: str


class PATPrincipal(BaseModel):
    user_id: int
    credential_id: int
    scopes: frozenset[str]
