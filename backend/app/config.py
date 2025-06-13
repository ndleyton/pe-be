from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Required for production, but have defaults for testing
    SECRET: str = Field("test-secret-key-for-development", env="SECRET_KEY")
    GOOGLE_CLIENT_ID: str = Field("test-google-client-id", env="GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str = Field("test-google-client-secret", env="GOOGLE_CLIENT_SECRET")
    
    # Optional settings with defaults
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"
    FRONTEND_URL: str = "http://localhost:5173"
    FRONTEND_POST_LOGIN_PATH: str = "/dashboard"
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@host:port/db"
    
    # Environment indicator
    ENVIRONMENT: str = Field("development", env="ENVIRONMENT")

    model_config = SettingsConfigDict(env_file=".env", extra='ignore', env_prefix="", case_sensitive=True)

settings = Settings()