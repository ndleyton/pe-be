import os # Import os
from fastapi import Depends, FastAPI, APIRouter # Import APIRouter
from fastapi.middleware.cors import CORSMiddleware

from app.db import User
from app.schemas import UserCreate, UserRead, UserUpdate
from app.users import (
    SECRET,
    auth_backend,
    current_active_user,
    fastapi_users,
    google_oauth_client,
    get_user_manager, 
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
