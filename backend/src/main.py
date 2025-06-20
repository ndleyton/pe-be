from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from httpx_oauth.oauth2 import OAuth2Error

from src.core.config import settings
from src.users.router import router as users_router
from src.workouts.router import router as workouts_router
from src.exercises.router import router as exercises_router
from src.exercise_sets.router import router as exercise_sets_router


def create_app() -> FastAPI:
    """Create and configure the FastAPI application with all domain routers"""
    
    app = FastAPI(
        title="PE Tracker API",
        description="Personal Exercise Tracker API with domain-driven architecture",
        version="2.0.0"
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include domain routers with API prefix
    api_prefix = settings.API_PREFIX

    # Users & Auth routes – keep the API prefix so endpoints remain backward-compatible
    app.include_router(users_router, prefix=api_prefix)
    
    # Domain-specific routes with API prefix
    app.include_router(workouts_router, prefix=f"{api_prefix}/workouts", tags=["workouts"])
    app.include_router(exercises_router, prefix=f"{api_prefix}/exercises", tags=["exercises"])
    app.include_router(exercise_sets_router, prefix=f"{api_prefix}/exercise-sets", tags=["exercise-sets"])


    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {"status": "healthy", "message": "PE Tracker API is running"}

    # Register OAuth2 error handler so Google sign-in redirects work as before
    async def oauth_exception_handler(request: Request, exc: OAuth2Error):
        """Return a redirect to the frontend with an error query parameter."""
        error_code = exc.error or "oauth_error"
        redirect_url = f"{settings.FRONTEND_URL.rstrip('/')}/?error={error_code}"
        return RedirectResponse(redirect_url)

    app.add_exception_handler(OAuth2Error, oauth_exception_handler)

    return app


# Create app instance
app = create_app() 