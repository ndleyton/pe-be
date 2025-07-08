from typing import Optional

from fastapi.responses import RedirectResponse
from fastapi import Depends, Request, status, Response
from fastapi_users import BaseUserManager, FastAPIUsers, IntegerIDMixin, models
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from httpx_oauth.clients.google import GoogleOAuth2

from src.core.config import settings
from src.core.dependencies import get_user_db

SECRET = settings.SECRET_KEY
GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET = settings.GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI = settings.GOOGLE_REDIRECT_URI
FRONTEND_URL = settings.FRONTEND_URL
FRONTEND_POST_LOGIN_PATH = settings.FRONTEND_POST_LOGIN_PATH

# Google OAuth client
google_oauth_client = GoogleOAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
)


class UserManager(IntegerIDMixin, BaseUserManager):
    """User manager for handling user operations"""
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

    async def on_after_register(self, user, request: Optional[Request] = None):
        print(f"User {user.id} has registered.")

    async def on_after_forgot_password(
        self, user, token: str, request: Optional[Request] = None
    ):
        print(f"User {user.id} has forgot their password. Reset token: {token}")

    async def on_after_request_verify(
        self, user, token: str, request: Optional[Request] = None
    ):
        print(f"Verification requested for user {user.id}. Verification token: {token}")


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    """FastAPI dependency for user manager"""
    yield UserManager(user_db)


class CookieTransportWithRedirect(CookieTransport):
    """Custom cookie transport that redirects after login"""
    
    async def get_login_response(self, token: str) -> Response:
        """
        Called by the backend after successful login to get the response.
        We want to set the cookie and redirect to the frontend's dashboard/workouts page.
        """
        # Ensures no double slashes if FRONTEND_URL ends with / and FRONTEND_POST_LOGIN_PATH starts with /
        redirect_url = f"{FRONTEND_URL.rstrip('/')}{FRONTEND_POST_LOGIN_PATH}"
        response = RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)
        self._set_login_cookie(response, token) # Use the parent's method to set the cookie
        return response


def get_jwt_strategy() -> JWTStrategy:
    """JWT strategy for authentication"""
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)


# Authentication backend
auth_backend = AuthenticationBackend(
    name="jwt",
    transport=CookieTransportWithRedirect(
        cookie_name="fitnessapp", 
        cookie_max_age=3600*24*7, # 7 days
        cookie_secure=settings.COOKIE_SECURE, # Configurable via COOKIE_SECURE environment variable
        cookie_samesite="lax"
        ), 
    get_strategy=get_jwt_strategy,
)

# This will be initialized in dependencies.py after User model is available
fastapi_users = None
current_active_user = None 