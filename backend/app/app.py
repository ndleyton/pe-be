import os 
from typing import List 
from fastapi import Depends, FastAPI, APIRouter, status, HTTPException, Request, Response
from fastapi.responses import RedirectResponse 
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from httpx_oauth.oauth2 import OAuth2Error

from app.db import User, Workout, get_async_session
from app.schemas import UserCreate, UserRead, UserUpdate, WorkoutRead, WorkoutBase
from app.users import (
    SECRET,
    auth_backend,
    current_active_user,
    fastapi_users,
    google_oauth_client,
    get_user_manager, 
    FRONTEND_URL,
)
from .router import workouts, exercises, workout_types


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    fastapi_users.get_auth_router(auth_backend), prefix="/auth/jwt", tags=["auth"]
)

app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)
app.include_router(
    workouts.workouts_router, 
    prefix="/api/workouts", 
    tags=["workouts"]
    )
app.include_router(
    exercises.exercises_router, 
    prefix="/api/exercises", 
    tags=["exercises"]
)
app.include_router(
    workout_types.workout_types_router, 
    prefix="/api/workout-types", 
    tags=["workout_types"]
) 
# --- Google OAuth Routes ---

async def oauth_exception_handler(request: Request, exc: OAuth2Error) -> Response:
    """
    Redirects the user to the frontend login page with an error query parameter
    when an OAuth flow fails (e.g., user cancels).
    """
    # Use exc.error as it's typically the short code like 'access_denied'
    error_code = exc.error or "oauth_error"
    # Redirect to frontend login page (root) with error information
    # Example: http://localhost:5173/?error=access_denied
    redirect_url = f"{FRONTEND_URL.rstrip('/')}/?error={error_code}"
    return RedirectResponse(redirect_url)

# Register the exception handler for OAuth2Error
app.add_exception_handler(OAuth2Error, oauth_exception_handler)

# Use get_oauth_router which sets up both /authorize and /callback
# It uses the backend and user_manager internally in its callback handler
google_oauth_router = fastapi_users.get_oauth_router(
    oauth_client=google_oauth_client,
    backend=auth_backend, # Provide the auth backend (now cookie-based)
    state_secret=SECRET, # Secret for the state token
    # redirect_url=GOOGLE_REDIRECT_URI # Optional: Can specify backend callback URL here, but often inferred
)
app.include_router(
    google_oauth_router, prefix="/auth/google", tags=["auth"]
)

@app.get("/")
def read_root():
    return {"msg": "Fitness Tracker API is running!"}

@app.get("/authenticated-route")
async def authenticated_route(user: User = Depends(current_active_user)):
    return {"message": f"Hello {user.email}!"}



