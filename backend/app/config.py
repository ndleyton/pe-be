from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    SECRET: str
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"
    FRONTEND_URL: str = "http://localhost:5173"
    FRONTEND_POST_LOGIN_PATH: str = "/dashboard"
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@host:port/db"
    # Add other configurations as needed

    model_config = SettingsConfigDict(env_file=".env", extra='ignore')

settings = Settings()