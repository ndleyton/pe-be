import os
from typing import Optional

from fastapi import Depends, Request, APIRouter
from fastapi_users import FastAPIUsers, BaseUserManager, IntegerIDMixin, schemas
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from httpx_oauth.clients.google import GoogleOAuth2
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.models import User as SQLUser, OAuthAccount

from dotenv import load_dotenv

load_dotenv()

# --- Environment Variables & Configuration ---
SECRET = os.getenv("SECRET", "DEFAULT_SECRET_CHANGE_ME_IN_ENV")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

if not SECRET:
    print("WARNING: SECRET environment variable is not set.")
    # raise ValueError("Missing SECRET environment variable")

# --- Pydantic Schemas ---
class UserRead(schemas.BaseUser[int]):
    name: Optional[str] = None

class UserCreate(schemas.BaseUserCreate):
    name: Optional[str] = None

class UserUpdate(schemas.BaseUserUpdate):
    name: Optional[str] = None

# --- User Database Adapter ---
async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, SQLUser, OAuthAccount, SQLUser.id)

# --- User Manager ---
class UserManager(IntegerIDMixin, BaseUserManager[SQLUser, int]):
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

    async def on_after_register(self, user: SQLUser, request: Optional[Request] = None):
        print(f"User {user.id} has registered.")

    async def on_after_forgot_password(
        self, user: SQLUser, token: str, request: Optional[Request] = None
    ):
        print(f"User {user.id} has forgot their password. Reset token: {token}")

    async def on_after_request_verify(
        self, user: SQLUser, token: str, request: Optional[Request] = None
    ):
        print(f"Verification requested for user {user.id}. Verification token: {token}")

# --- User Manager Dependency for FastAPIUsers ---
async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)


# --- Authentication Backend Setup (JWT) ---
bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)

jwt_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

print("GOOGLE_CLIENT_ID:", GOOGLE_CLIENT_ID)
print("GOOGLE_CLIENT_SECRET:", GOOGLE_CLIENT_SECRET)
print("GOOGLE_REDIRECT_URI:", GOOGLE_REDIRECT_URI)

google_oauth_client = GoogleOAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
)

# --- FastAPIUsers Instance ---
fastapi_users = FastAPIUsers[SQLUser, int](
    get_user_manager,
    [jwt_backend],
)

# --- Dependency for getting current active user ---
current_active_user = fastapi_users.current_user(active=True)

# --- Routers ---
router = APIRouter()

# associate_by_email=True,        # Optional: Uncomment to link accounts by email
# is_verified_by_default=True,    # Optional: Uncomment if Google login implies verified email
# Google OAuth2 login/callback endpoints
router.include_router(
    fastapi_users.get_oauth_router(
        oauth_client=google_oauth_client, # The specific OAuth client
        backend=jwt_backend,              # Backend to use AFTER callback (will issue JWT)
        user_manager_dependency=get_user_manager, # Dependency to get UserManager
        state_secret=SECRET,              # Secret for signing the OAuth state token
        redirect_url=GOOGLE_REDIRECT_URI, # Optional but recommended for clarity
    ),
    prefix="/auth/google", # Determines /authorize and /callback paths
    tags=["auth"],
)

# JWT login/logout
router.include_router(
    fastapi_users.get_auth_router(jwt_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)

# Registration
router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)

# Password reset
router.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)

# Email verification
router.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)

# User management
router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# Example protected route
@router.get("/users/me/info", response_model=UserRead)
async def get_user_info(user: SQLUser = Depends(current_active_user)):
    """Returns current logged-in user's information (requires JWT or Google OAuth)."""
    return user
