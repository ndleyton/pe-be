import re
from typing import Optional

from fastapi_users import schemas
from pydantic import field_validator


USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
USERNAME_MIN_LENGTH = 3


class UserRead(schemas.BaseUser[int]):
    """Schema for reading user data"""

    pass


class UserCreate(schemas.BaseUserCreate):
    """Schema for creating new users"""

    username: Optional[str] = None

    @field_validator("username", mode="before")
    @classmethod
    def validate_username(cls, value):
        if value is None:
            return value

        username = str(value).strip()
        if len(username) < USERNAME_MIN_LENGTH:
            raise ValueError(
                f"Username must be at least {USERNAME_MIN_LENGTH} characters long"
            )
        if not USERNAME_PATTERN.fullmatch(username):
            raise ValueError(
                "Username may only contain letters, numbers, underscores, and hyphens"
            )
        return username.lower()


class UserUpdate(schemas.BaseUserUpdate):
    """Schema for updating user data"""

    pass
