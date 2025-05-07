import os
from typing import Optional

from fastapi.responses import RedirectResponse # Import RedirectResponse
from fastapi import Depends, Request, status, Response
from fastapi_users import BaseUserManager, FastAPIUsers, IntegerIDMixin, models
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from httpx_oauth.clients.google import GoogleOAuth2

from app.db import User, get_user_db

from dotenv import load_dotenv
load_dotenv()

SECRET = os.getenv("SECRET", "DEFAULT_SECRET_CHANGE_ME_IN_ENV")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173") # Get frontend URL

print(GOOGLE_CLIENT_ID)
print(GOOGLE_CLIENT_SECRET)

google_oauth_client = GoogleOAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
)


class UserManager(IntegerIDMixin, BaseUserManager[User, int]):
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        print(f"User {user.id} has registered.")

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        print(f"User {user.id} has forgot their password. Reset token: {token}")

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        print(f"Verification requested for user {user.id}. Verification token: {token}")


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)


# --- Custom CookieTransport for Redirect ---
class CookieTransportWithRedirect(CookieTransport):
    async def get_login_response(self, token: str) -> Response:
        """
        Called by the backend after successful login to get the response.
        We want to set the cookie and redirect to the frontend.
        """
        response = RedirectResponse(FRONTEND_URL, status_code=status.HTTP_302_FOUND)
        self._set_login_cookie(response, token) # Use the parent's method to set the cookie
        return response

def get_jwt_strategy() -> JWTStrategy[models.UP, models.ID]:
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=CookieTransportWithRedirect(cookie_name="fitnessapp", cookie_max_age=3600), 
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, int](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)