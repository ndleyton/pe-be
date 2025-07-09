from pydantic import Field, field_validator, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Required for production, but have defaults for testing
    # In a production environment, these should be set via environment variables.
    # For local development, you can use a .env file (see .env.example).
    # Note: The default values are for demonstration and should be replaced for production.
    SECRET_KEY: str = Field("test-secret-key", env="SECRET_KEY")
    ENVIRONMENT: str = Field("development", env="ENVIRONMENT")
    GOOGLE_CLIENT_ID: str = Field("test-google-client-id", env="GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str = Field("test-google-client-secret", env="GOOGLE_CLIENT_SECRET")

    # This should point to your backend's OAuth callback endpoint.
    GOOGLE_REDIRECT_URI: str = Field("http://localhost:8000/api/v1/auth/google/callback", env="GOOGLE_REDIRECT_URI")

    # Frontend URL - used for CORS and post-login redirects
    FRONTEND_URL: str = Field("http://localhost:5173", env="FRONTEND_URL")
    FRONTEND_POST_LOGIN_PATH: str = Field("/dashboard", env="FRONTEND_POST_LOGIN_PATH")
    DATABASE_URL: str = Field(
        "postgresql+asyncpg://postgres:postgres@localhost:5432/pe_be",
        env="DATABASE_URL",
        description="PostgreSQL database connection URL"
    )
    
    API_VERSION: str = Field("v1", env="API_VERSION")
    OPENAI_API_KEY: str = Field("", env="OPENAI_API_KEY")
    
    @computed_field
    @property
    def API_PREFIX(self) -> str:
        return f"/api/{self.API_VERSION}"
    
    # Cookie security settings
    COOKIE_SECURE: bool = Field(False, env="COOKIE_SECURE", description="Enable secure cookies for HTTPS")
    
    # Environment indicator
    ENVIRONMENT: str = Field("development", env="ENVIRONMENT")

    model_config = SettingsConfigDict(env_file=".env", extra='ignore', env_prefix="", case_sensitive=True)
    
    @field_validator('DATABASE_URL')
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Validate that DATABASE_URL is properly formatted"""
        if not v.startswith(('postgresql://', 'postgresql+asyncpg://')):
            raise ValueError('DATABASE_URL must start with postgresql:// or postgresql+asyncpg://')
        
        # Check for placeholder values
        placeholder_indicators = ['user:pass@host:port', 'localhost:5432/pe_be']
        if any(placeholder in v for placeholder in ['user:pass@host:port']):
            raise ValueError('DATABASE_URL contains placeholder values. Please set a valid DATABASE_URL environment variable.')
        
        return v

# Global settings instance
settings = Settings() 