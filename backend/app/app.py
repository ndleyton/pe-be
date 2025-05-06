from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import User
from app.schemas import UserCreate, UserRead, UserUpdate
from app.users import (
    SECRET,
    GOOGLE_REDIRECT_URI,
    auth_backend,
    current_active_user,
    fastapi_users,
    google_oauth_client,
)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # or ["*"] for all, but more secure to specify
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
    fastapi_users.get_oauth_router(
        oauth_client=google_oauth_client, 
        backend=auth_backend, 
        state_secret=SECRET,
        redirect_url=GOOGLE_REDIRECT_URI),
    prefix="/auth/google",
    tags=["auth"],
)

@app.get("/")
def read_root():
    return {"msg": "Fitness Tracker API is running!"}

@app.get("/authenticated-route")
async def authenticated_route(user: User = Depends(current_active_user)):
    return {"message": f"Hello {user.email}!"}
