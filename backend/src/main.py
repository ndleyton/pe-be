from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

    # Users and Auth routes (no additional prefix as they include their own)
    app.include_router(users_router)
    
    # Domain-specific routes with API prefix
    app.include_router(workouts_router, prefix=f"{api_prefix}/workouts", tags=["workouts"])
    app.include_router(exercises_router, prefix=f"{api_prefix}/exercises", tags=["exercises"])
    app.include_router(exercise_sets_router, prefix=f"{api_prefix}/exercise-sets", tags=["exercise-sets"])

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {"status": "healthy", "message": "PE Tracker API is running"}

    return app


# Create app instance
app = create_app() 