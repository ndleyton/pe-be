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

# --- Workout Endpoints ---
workouts_router = APIRouter(prefix="/api/workouts", tags=["workouts"]) 

# --- Exercise Endpoints ---
from .models import Exercise
from .schemas import ExerciseCreate, ExerciseRead
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, APIRouter, status
from .users import current_active_user, User
from .db import get_async_session

exercises_router = APIRouter(prefix="/api/exercises", tags=["exercises"])

@exercises_router.post("/", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    exercise_in: ExerciseCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    exercise = Exercise(**exercise_in.dict())
    session.add(exercise)
    await session.commit()
    await session.refresh(exercise)
    return exercise


@workouts_router.post("/", response_model=WorkoutRead, status_code=status.HTTP_201_CREATED)
async def create_workout(
    workout_in: WorkoutBase,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    # Create a new Workout instance
    workout = Workout(
        **workout_in.dict(),
        owner_id=user.id
    )
    session.add(workout)
    await session.commit()
    await session.refresh(workout)
    return workout


@workouts_router.get("/mine", response_model=List[WorkoutRead])
async def get_my_workouts(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    result = await session.execute(select(Workout).where(Workout.owner_id == user.id).order_by(Workout.start_time.desc()))
    workouts = result.scalars().all()
    return workouts

app.include_router(workouts_router)
