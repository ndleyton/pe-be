import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import RedirectResponse
from httpx_oauth.oauth2 import OAuth2Error

from src.core.config import settings
from src.core.observability import configure_observability
from src.core.errors import DomainValidationError
from src.core.logging import configure_logging, reset_request_id, set_request_id
from src.users.router import router as users_router
from src.workouts.router import router as workouts_router
from src.exercises.router import router as exercises_router
from src.exercise_sets.router import router as exercise_sets_router
from src.routines.router import router as routines_router
from src.admin.router import router as admin_router
from src.health.router import router as health_router
from src.chat.router import router as chat_router

configure_logging(settings.LOG_LEVEL)
logger = logging.getLogger("src.request")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application with all domain routers"""

    fastapi_kwargs = {
        "title": "PE Tracker API",
        "description": "Personal Exercise Tracker API with domain-driven architecture",
        "version": f"2.0.0-{settings.API_VERSION}",
    }
    if settings.ENVIRONMENT == "production":
        fastapi_kwargs["proxy_headers"] = True

    app = FastAPI(**fastapi_kwargs)

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id
        token = set_request_id(request_id)
        started_at = perf_counter()

        try:
            try:
                response = await call_next(request)
            except Exception:
                duration_ms = round((perf_counter() - started_at) * 1000, 2)
                logger.exception(
                    "%s %s -> 500 %.2fms",
                    request.method,
                    request.url.path,
                    duration_ms,
                )
                raise

            duration_ms = round((perf_counter() - started_at) * 1000, 2)
            response.headers["X-Request-ID"] = request_id
            logger.info(
                "%s %s -> %s %.2fms",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )
            return response
        finally:
            reset_request_id(token)

    base_frontend = settings.FRONTEND_URL.rstrip("/")
    # Derive a 127.0.0.1 variant if the base contains 'localhost'
    localhost_variant = (
        base_frontend.replace("localhost", "127.0.0.1")
        if "localhost" in base_frontend
        else None
    )

    # Common dev hosts to allow.
    allowed_origins = {
        base_frontend,
        localhost_variant,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    }
    # Remove any None entries
    allowed_origins = [origin for origin in allowed_origins if origin]

    # Regex to match local dev hosts and optionally preview hosts without
    # hardcoding one ephemeral deployment URL into the application.
    origin_regexes = [r"http://(localhost|127\.0\.0\.1):\d+$"]
    if settings.ADDITIONAL_CORS_ALLOWED_ORIGIN_REGEX:
        origin_regexes.append(f"(?:{settings.ADDITIONAL_CORS_ALLOWED_ORIGIN_REGEX})")
    allow_origin_regex = "|".join(origin_regexes)

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=allow_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include domain routers with API prefix
    api_prefix = settings.API_PREFIX

    # Users & Auth routes – keep the API prefix so endpoints remain backward-compatible
    app.include_router(users_router, prefix=api_prefix)

    # Domain-specific routes with API prefix
    app.include_router(
        workouts_router, prefix=f"{api_prefix}/workouts", tags=["workouts"]
    )
    app.include_router(
        exercises_router, prefix=f"{api_prefix}/exercises", tags=["exercises"]
    )
    app.include_router(
        exercise_sets_router,
        prefix=f"{api_prefix}/exercise-sets",
        tags=["exercise-sets"],
    )
    app.include_router(
        routines_router, prefix=f"{api_prefix}/routines", tags=["routines"]
    )
    app.include_router(chat_router, prefix=f"{api_prefix}", tags=["chat"])
    app.include_router(admin_router, prefix=api_prefix, tags=["admin"])
    app.include_router(health_router, tags=["health"])

    # Register OAuth2 error handler so Google sign-in redirects work as before
    async def oauth_exception_handler(request: Request, exc: OAuth2Error):
        """Return a redirect to the frontend with an error query parameter."""
        error_code = exc.error or "oauth_error"
        redirect_url = f"{settings.FRONTEND_URL.rstrip('/')}/?error={error_code}"
        return RedirectResponse(redirect_url)

    async def domain_validation_exception_handler(
        request: Request, exc: DomainValidationError
    ):
        response = {
            "detail": exc.message,
            "code": exc.code.value,
        }
        if exc.field is not None:
            response["field"] = exc.field
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=response,
        )

    app.add_exception_handler(OAuth2Error, oauth_exception_handler)
    app.add_exception_handler(
        DomainValidationError, domain_validation_exception_handler
    )
    configure_observability(app)

    return app


# Create app instance
app = create_app()
