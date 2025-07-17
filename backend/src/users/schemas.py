from fastapi_users import schemas


class UserRead(schemas.BaseUser[int]):
    """Schema for reading user data"""

    pass


class UserCreate(schemas.BaseUserCreate):
    """Schema for creating new users"""

    pass


class UserUpdate(schemas.BaseUserUpdate):
    """Schema for updating user data"""

    pass
