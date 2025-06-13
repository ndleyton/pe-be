import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Required for production, but have defaults for testing
    SECRET: str = os.getenv("SECRET_KEY", "test-secret-key-for-development")
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "test-google-client-id")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
    
    # Optional settings with defaults
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"
    FRONTEND_URL: str = "http://localhost:5173"
    FRONTEND_POST_LOGIN_PATH: str = "/dashboard"
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@host:port/db"
    
    # Environment indicator
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    model_config = SettingsConfigDict(env_file=".env", extra='ignore')

settings = Settings()