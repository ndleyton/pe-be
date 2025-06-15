import os
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from httpx_oauth.oauth2 import OAuth2Error

from app.db import User
from app.users import current_active_user
from app.config import settings
from app.api.v1 import api_router, oauth_exception_handler

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount unified API router under the configured prefix (e.g., /api/v1)
app.include_router(api_router, prefix=settings.API_PREFIX)

# Register OAuth error handler
app.add_exception_handler(OAuth2Error, oauth_exception_handler)

@app.get("/")
def read_root():
    return {"msg": "Fitness Tracker API is running!"}

@app.get("/authenticated-route")
async def authenticated_route(user: User = Depends(current_active_user)):
    return {"message": f"Hello {user.email}!"}



