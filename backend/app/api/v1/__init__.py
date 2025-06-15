from fastapi import APIRouter, Request, Response
from fastapi.responses import RedirectResponse
from httpx_oauth.oauth2 import OAuth2Error

from app.users import (
    fastapi_users,
    auth_backend,
    google_oauth_client,
    SECRET,
    FRONTEND_URL,
)
from app.schemas import UserRead, UserCreate, UserUpdate
from app.router import workouts, exercises, workout_types

__all__ = ["api_router", "oauth_exception_handler"]

api_router = APIRouter()

# --- Auth & User Routes ---
api_router.include_router(
    fastapi_users.get_auth_router(auth_backend), prefix="/auth/jwt", tags=["auth"]
)
api_router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate), prefix="/auth", tags=["auth"]
)
api_router.include_router(
    fastapi_users.get_reset_password_router(), prefix="/auth", tags=["auth"]
)
api_router.include_router(
    fastapi_users.get_verify_router(UserRead), prefix="/auth", tags=["auth"]
)
api_router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate), prefix="/users", tags=["users"]
)

# --- Domain Routers ---
api_router.include_router(workouts.workouts_router, prefix="/workouts", tags=["workouts"])
api_router.include_router(exercises.exercises_router, prefix="/exercises", tags=["exercises"])
api_router.include_router(
    workout_types.workout_types_router, prefix="/workout-types", tags=["workout_types"]
)

# --- Google OAuth Routes ---

google_oauth_router = fastapi_users.get_oauth_router(
    oauth_client=google_oauth_client,
    backend=auth_backend,
    state_secret=SECRET,
)
api_router.include_router(google_oauth_router, prefix="/auth/google", tags=["auth"])

# OAuth error handler to be registered on main app
async def oauth_exception_handler(request: Request, exc: OAuth2Error) -> Response:
    error_code = exc.error or "oauth_error"
    redirect_url = f"{FRONTEND_URL.rstrip('/')}/?error={error_code}"
    return RedirectResponse(redirect_url)

# --- Health Endpoint ---
@api_router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
