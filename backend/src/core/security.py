import logging
from typing import Optional

import jwt
from fastapi.responses import RedirectResponse
from fastapi import Depends, Request, status, Response
from fastapi_users import BaseUserManager, IntegerIDMixin, exceptions, models
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi_users.jwt import decode_jwt
from httpx_oauth.clients.google import GoogleOAuth2

from src.core.config import settings
from src.core.dependencies import get_user_db
from src.core.observability import set_current_span_attributes, traced_span

logger = logging.getLogger(__name__)

SECRET = settings.SECRET_KEY
GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET = settings.GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI = settings.GOOGLE_REDIRECT_URI
FRONTEND_URL = settings.FRONTEND_URL
FRONTEND_POST_LOGIN_PATH = settings.FRONTEND_POST_LOGIN_PATH


class TracedGoogleOAuth2(GoogleOAuth2):
    """Add provider-specific spans around Google OAuth network calls."""

    async def get_access_token(
        self, code: str, redirect_uri: str, code_verifier: Optional[str] = None
    ):
        attributes = {
            "auth.oauth.provider": self.name,
            "auth.oauth.phase": "access_token",
            "auth.oauth.redirect_uri": redirect_uri,
            "auth.oauth.pkce": code_verifier is not None,
        }
        set_current_span_attributes(attributes)
        with traced_span("auth.oauth.google.exchange_token", attributes=attributes):
            token = await super().get_access_token(code, redirect_uri, code_verifier)
            set_current_span_attributes(
                {
                    "auth.oauth.refresh_token_present": token.get("refresh_token")
                    is not None,
                    "auth.oauth.expires_at_present": token.get("expires_at")
                    is not None,
                    "auth.oauth.id_token_present": token.get("id_token") is not None,
                }
            )
        return token

    async def get_profile(self, token: str):
        attributes = {
            "auth.oauth.provider": self.name,
            "auth.oauth.phase": "profile",
        }
        set_current_span_attributes(attributes)
        with traced_span("auth.oauth.google.fetch_profile", attributes=attributes):
            profile = await super().get_profile(token)
            set_current_span_attributes(
                {
                    "auth.oauth.google.profile.email_count": len(
                        profile.get("emailAddresses", [])
                    ),
                }
            )
        return profile


# Google OAuth client
google_oauth_client = TracedGoogleOAuth2(
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

    async def get_logout_response(self) -> Response:
        """Clear auth cookies defensively for both current and legacy setups."""
        response = Response(status_code=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(
            self.cookie_name,
            path=self.cookie_path,
            domain=self.cookie_domain,
            secure=self.cookie_secure,
            httponly=self.cookie_httponly,
            samesite=self.cookie_samesite,
        )

        # Also clear a host-only cookie when the deployment has since started
        # using an explicit cookie domain.
        if self.cookie_domain is not None:
            response.delete_cookie(
                self.cookie_name,
                path=self.cookie_path,
                secure=self.cookie_secure,
                httponly=self.cookie_httponly,
                samesite=self.cookie_samesite,
            )

        return response


class TracedJWTStrategy(JWTStrategy):
    """Expose JWT decode and user fetch latency as child spans."""

    async def read_token(
        self,
        token: Optional[str],
        user_manager: BaseUserManager[models.UP, models.ID],
    ) -> Optional[models.UP]:
        if token is None:
            return None

        with traced_span(
            "auth.jwt.decode",
            attributes={"auth.backend": "jwt"},
        ) as span:
            try:
                data = decode_jwt(
                    token,
                    self.decode_key,
                    self.token_audience,
                    algorithms=[self.algorithm],
                )
                user_id = data.get("sub")
                span.set_attribute("auth.jwt.subject_present", user_id is not None)
                if user_id is None:
                    span.set_attribute("auth.jwt.valid", False)
                    return None
                span.set_attribute("auth.jwt.valid", True)
            except jwt.PyJWTError:
                span.set_attribute("auth.jwt.valid", False)
                return None

        with traced_span(
            "auth.user.lookup",
            attributes={"auth.backend": "jwt"},
        ):
            try:
                parsed_id = user_manager.parse_id(user_id)
                return await user_manager.get(parsed_id)
            except (exceptions.UserNotExists, exceptions.InvalidID):
                return None


def get_jwt_strategy() -> JWTStrategy:
    """JWT strategy for authentication"""
    return TracedJWTStrategy(
        secret=SECRET,
        lifetime_seconds=settings.JWT_LIFETIME_SECONDS,
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
