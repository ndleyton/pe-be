import logging
from typing import Optional

from fastapi.responses import RedirectResponse
from fastapi import Depends, HTTPException, Request, status, Response
from fastapi_users import BaseUserManager, FastAPIUsers, IntegerIDMixin, models
from fastapi_users.authentication import (
    AuthenticationBackend,
    Authenticator,
    CookieTransport,
    JWTStrategy,
)
from fastapi_users.manager import UserManagerDependency
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from httpx_oauth.clients.google import GoogleOAuth2
from opentelemetry import trace

from src.core.config import settings
from src.core.dependencies import get_user_db

logger = logging.getLogger(__name__)
_tracer = trace.get_tracer(__name__)

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
        logger.info("User registered user_id=%s", user.id)

    async def on_after_forgot_password(
        self, user, token: str, request: Optional[Request] = None
    ):
        logger.info("Password reset requested user_id=%s", user.id)

    async def on_after_request_verify(
        self, user, token: str, request: Optional[Request] = None
    ):
        logger.info("Verification requested user_id=%s", user.id)


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
        logger.debug("Prepared login redirect redirect_url=%s", redirect_url)
        response = RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)
        self._set_login_cookie(
            response, token
        )  # Use the parent's method to set the cookie
        return response


class TracedJWTStrategy(JWTStrategy):
    """JWT strategy that emits spans around token parsing and user loading."""

    async def read_token(
        self, token: Optional[str], user_manager: BaseUserManager[models.UP, models.ID]
    ) -> Optional[models.UP]:
        with _tracer.start_as_current_span("auth.jwt.read_token") as span:
            span.set_attribute("auth.token_present", token is not None)
            span.set_attribute("auth.jwt.algorithm", self.algorithm)

            user = await super().read_token(token, user_manager)

            span.set_attribute("auth.user_found", user is not None)
            if user is not None:
                span.set_attribute("enduser.id", str(user.id))

            return user


class TracedAuthenticator(Authenticator):
    """Authenticator wrapper that makes auth dependency time visible in traces."""

    async def _authenticate(
        self,
        *args,
        user_manager: BaseUserManager[models.UP, models.ID],
        optional: bool = False,
        active: bool = False,
        verified: bool = False,
        superuser: bool = False,
        **kwargs,
    ):
        with _tracer.start_as_current_span("auth.current_user") as span:
            enabled_backends = kwargs.get("enabled_backends", self.backends)
            span.set_attribute("auth.backend_count", len(self.backends))
            span.set_attribute("auth.enabled_backend_count", len(enabled_backends))
            span.set_attribute("auth.optional", optional)
            span.set_attribute("auth.active_required", active)
            span.set_attribute("auth.verified_required", verified)
            span.set_attribute("auth.superuser_required", superuser)

            try:
                user, token = await super()._authenticate(
                    *args,
                    user_manager=user_manager,
                    optional=optional,
                    active=active,
                    verified=verified,
                    superuser=superuser,
                    **kwargs,
                )
            except HTTPException as exc:
                span.set_attribute("auth.result", "rejected")
                span.set_attribute("http.status_code", exc.status_code)
                raise

            span.set_attribute("auth.result", "authenticated" if user else "anonymous")
            span.set_attribute("auth.token_present", token is not None)
            if user is not None:
                span.set_attribute("enduser.id", str(user.id))

            return user, token


class TracedFastAPIUsers(FastAPIUsers[models.UP, models.ID]):
    """FastAPIUsers variant that uses traced authentication dependencies."""

    def __init__(
        self,
        get_user_manager: UserManagerDependency[models.UP, models.ID],
        auth_backends,
    ):
        self.authenticator = TracedAuthenticator(auth_backends, get_user_manager)
        self.get_user_manager = get_user_manager
        self.current_user = self.authenticator.current_user


def get_jwt_strategy() -> JWTStrategy:
    """JWT strategy for authentication"""
    return TracedJWTStrategy(
        secret=SECRET, lifetime_seconds=settings.JWT_LIFETIME_SECONDS
    )


# Authentication backend
auth_backend = AuthenticationBackend(
    name="jwt",
    transport=CookieTransportWithRedirect(
        cookie_name="personalbestie_session",
        cookie_max_age=3600 * 24 * 7,
        cookie_secure=settings.COOKIE_SECURE,
        cookie_samesite=settings.COOKIE_SAMESITE,
        cookie_domain=settings.COOKIE_DOMAIN,
    ),
    get_strategy=get_jwt_strategy,
)

# This will be initialized in dependencies.py after User model is available
fastapi_users = None
current_active_user = None
