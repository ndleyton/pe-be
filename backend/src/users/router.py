from fastapi import APIRouter, Depends
from fastapi_users import FastAPIUsers

from src.users.models import User, OAuthAccount
from src.users.schemas import UserRead, UserCreate, UserUpdate
from src.core.config import settings
from src.core.security import (
    auth_backend,
    get_user_manager,
    google_oauth_client
)
from src.core.dependencies import get_user_db, set_user_models

# Set user models for dependencies
set_user_models(User, OAuthAccount)

# Initialize FastAPI Users
fastapi_users = FastAPIUsers[User, int](get_user_manager, [auth_backend])

# Create router
router = APIRouter()

# Include auth routes
router.include_router(
    fastapi_users.get_auth_router(auth_backend), 
    prefix="/auth/jwt", 
    tags=["auth"]
)

router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)

router.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)

router.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)

router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

router.include_router(
    fastapi_users.get_oauth_router(google_oauth_client, auth_backend, settings.SECRET_KEY, redirect_url=f"{settings.FRONTEND_URL.rstrip('/')}{settings.FRONTEND_POST_LOGIN_PATH}"),
    prefix="/auth/google",
    tags=["auth"],
)

# Export current user dependency
current_active_user = fastapi_users.current_user(active=True) 