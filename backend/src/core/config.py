import os
from pathlib import Path
from pydantic import Field, field_validator, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Required for production, but have defaults for testing
    # In a production environment, these should be set via environment variables.
    # For local development, you can use a .env file (see .env.example).
    # Note: The default values are for demonstration and should be replaced for production.
    SECRET_KEY: str = Field("test-secret-key", validation_alias="SECRET_KEY")
    ENVIRONMENT: str = Field("development", validation_alias="ENVIRONMENT")
    GOOGLE_CLIENT_ID: str = Field(
        "test-google-client-id", validation_alias="GOOGLE_CLIENT_ID"
    )
    GOOGLE_CLIENT_SECRET: str = Field(
        "test-google-client-secret", validation_alias="GOOGLE_CLIENT_SECRET"
    )

    # This should point to your backend's OAuth callback endpoint.
    GOOGLE_REDIRECT_URI: str = Field(
        "http://localhost:8000/api/v1/auth/google/callback",
        validation_alias="GOOGLE_REDIRECT_URI",
    )

    # Frontend URL - used for CORS and post-login redirects
    FRONTEND_URL: str = Field("http://localhost:5173", validation_alias="FRONTEND_URL")
    FRONTEND_POST_LOGIN_PATH: str = Field(
        "/workouts", validation_alias="FRONTEND_POST_LOGIN_PATH"
    )
    ADDITIONAL_CORS_ALLOWED_ORIGIN_REGEX: str = Field(
        "",
        validation_alias="ADDITIONAL_CORS_ALLOWED_ORIGIN_REGEX",
        description="Optional regex for extra browser origins allowed to call the API",
    )
    DATABASE_URL: str = Field(
        "postgresql+asyncpg://postgres:postgres@localhost:5432/pe_be",
        validation_alias="DATABASE_URL",
        description="PostgreSQL database connection URL",
    )

    API_VERSION: str = Field("v1", validation_alias="API_VERSION")
    OPENAI_API_KEY: str = Field("", validation_alias="OPENAI_API_KEY")
    GOOGLE_AI_KEY: str = Field("", validation_alias="GOOGLE_AI_KEY")

    # Chat/tool calling safety
    CHAT_MAX_TOOL_ITERATIONS: int = Field(
        3,
        validation_alias="CHAT_MAX_TOOL_ITERATIONS",
        description="Max number of tool-calling iterations in chat loop",
    )
    CHAT_ATTACHMENT_STORAGE_DIR: str = Field(
        str(Path(__file__).resolve().parents[2] / ".chat_attachments"),
        validation_alias="CHAT_ATTACHMENT_STORAGE_DIR",
        description="Filesystem path for uploaded chat attachments",
    )
    CHAT_ATTACHMENT_MAX_BYTES: int = Field(
        10 * 1024 * 1024,
        validation_alias="CHAT_ATTACHMENT_MAX_BYTES",
        description="Max accepted chat attachment size in bytes",
    )
    CHAT_ATTACHMENT_ALLOWED_MIME_TYPES: tuple[str, ...] = Field(
        ("image/png", "image/jpeg", "image/webp"),
        validation_alias="CHAT_ATTACHMENT_ALLOWED_MIME_TYPES",
        description="Allowed MIME types for chat image uploads",
    )
    CHAT_ATTACHMENT_ORPHAN_TTL_HOURS: int = Field(
        24,
        validation_alias="CHAT_ATTACHMENT_ORPHAN_TTL_HOURS",
        description="Delete unattached chat uploads older than this many hours",
    )
    CHAT_ATTACHMENT_CLEANUP_BATCH_SIZE: int = Field(
        25,
        validation_alias="CHAT_ATTACHMENT_CLEANUP_BATCH_SIZE",
        description="Max number of stale chat uploads to clean up per sweep",
    )
    JOB_CHAT_ATTACHMENT_CLEANUP_ENABLED: bool = Field(
        True,
        validation_alias="JOB_CHAT_ATTACHMENT_CLEANUP_ENABLED",
        description="Enable the scheduled chat attachment cleanup job",
    )
    JOB_CLOSE_STALE_OPEN_WORKOUTS_ENABLED: bool = Field(
        True,
        validation_alias="JOB_CLOSE_STALE_OPEN_WORKOUTS_ENABLED",
        description="Enable the scheduled stale open workout auto-close job",
    )
    JOB_CLOSE_STALE_OPEN_WORKOUTS_MAX_AGE_HOURS: int = Field(
        24,
        validation_alias="JOB_CLOSE_STALE_OPEN_WORKOUTS_MAX_AGE_HOURS",
        description="Max age in hours before an open workout is auto-closed",
    )
    CHAT_RATE_LIMIT_WINDOW_SECONDS: int = Field(
        60,
        validation_alias="CHAT_RATE_LIMIT_WINDOW_SECONDS",
        description="Time window for chat request rate limiting",
    )
    CHAT_RATE_LIMIT_MAX_REQUESTS: int = Field(
        20,
        validation_alias="CHAT_RATE_LIMIT_MAX_REQUESTS",
        description="Max chat requests allowed per window",
    )
    CHAT_ATTACHMENT_RATE_LIMIT_WINDOW_SECONDS: int = Field(
        60,
        validation_alias="CHAT_ATTACHMENT_RATE_LIMIT_WINDOW_SECONDS",
        description="Time window for chat attachment upload rate limiting",
    )
    CHAT_ATTACHMENT_RATE_LIMIT_MAX_REQUESTS: int = Field(
        10,
        validation_alias="CHAT_ATTACHMENT_RATE_LIMIT_MAX_REQUESTS",
        description="Max chat attachment uploads allowed per window",
    )

    # Langfuse configuration
    LANGFUSE_PUBLIC_KEY: str = Field("", validation_alias="LANGFUSE_PUBLIC_KEY")
    LANGFUSE_SECRET_KEY: str = Field("", validation_alias="LANGFUSE_SECRET_KEY")
    LANGFUSE_HOST: str = Field(
        "https://us.cloud.langfuse.com", validation_alias="LANGFUSE_HOST"
    )

    # Import database configuration (for external data sources)
    IMPORT_DATABASE_HOST: str = Field(
        "localhost", validation_alias="IMPORT_DATABASE_HOST"
    )
    IMPORT_DATABASE_PORT: int = Field(5432, validation_alias="IMPORT_DATABASE_PORT")
    IMPORT_DATABASE_NAME: str = Field(
        "gym_tracker_development", validation_alias="IMPORT_DATABASE_NAME"
    )
    IMPORT_DATABASE_USER: str = Field(
        "postgres", validation_alias="IMPORT_DATABASE_USER"
    )
    IMPORT_DATABASE_PASSWORD: str = Field(
        "postgres", validation_alias="IMPORT_DATABASE_PASSWORD"
    )

    # Image configuration
    IMAGE_URL_PREFIX: str = Field(
        "",
        validation_alias="IMAGE_URL_PREFIX",
        description="URL prefix for exercise images",
    )

    @computed_field
    @property
    def API_PREFIX(self) -> str:
        return f"/api/{self.API_VERSION}"

    # Cookie security settings
    COOKIE_SECURE: bool = Field(
        False,
        validation_alias="COOKIE_SECURE",
        description="Enable secure cookies for HTTPS",
    )
    COOKIE_SAMESITE: str = Field("lax", validation_alias="COOKIE_SAMESITE")
    COOKIE_DOMAIN: str | None = Field(None, validation_alias="COOKIE_DOMAIN")

    # JWT lifetime configuration (in seconds)
    JWT_LIFETIME_SECONDS: int = Field(
        3600 * 24 * 7,
        validation_alias="JWT_LIFETIME_SECONDS",
        description="JWT token lifetime in seconds (default: 7 days)",
    )

    LOG_LEVEL: str = Field("INFO", validation_alias="LOG_LEVEL")
    OTEL_ENABLED: bool = Field(False, validation_alias="OTEL_ENABLED")
    OTEL_SERVICE_NAME: str = Field(
        "pe-be-backend", validation_alias="OTEL_SERVICE_NAME"
    )
    OTEL_SERVICE_VERSION: str = Field(
        "", validation_alias="OTEL_SERVICE_VERSION"
    )
    OTEL_EXPORTER_OTLP_ENDPOINT: str = Field(
        "", validation_alias="OTEL_EXPORTER_OTLP_ENDPOINT"
    )
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: str = Field(
        "", validation_alias="OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"
    )
    OTEL_EXPORTER_OTLP_HEADERS: str = Field(
        "", validation_alias="OTEL_EXPORTER_OTLP_HEADERS"
    )
    OTEL_TRACES_SAMPLER_ARG: float = Field(
        0.1, validation_alias="OTEL_TRACES_SAMPLER_ARG"
    )
    OTEL_EXCLUDED_URLS: str = Field("/health", validation_alias="OTEL_EXCLUDED_URLS")

    # Environment indicator
    ENVIRONMENT: str = Field("development", validation_alias="ENVIRONMENT")

    model_config = SettingsConfigDict(
        env_file=os.getenv("ENV_FILE", ".env"),
        extra="ignore",
        env_prefix="",
        case_sensitive=True,
    )

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Validate that DATABASE_URL is properly formatted"""
        if not v.startswith(("postgresql://", "postgresql+asyncpg://")):
            raise ValueError(
                "DATABASE_URL must start with postgresql:// or postgresql+asyncpg://"
            )

        # Check for placeholder values
        if "user:pass@host:port" in v:
            raise ValueError(
                "DATABASE_URL contains placeholder values. Please set a valid DATABASE_URL environment variable."
            )

        return v

    @field_validator("OTEL_TRACES_SAMPLER_ARG")
    @classmethod
    def validate_sample_rate(cls, v: float) -> float:
        if not 0 <= v <= 1:
            raise ValueError("OTEL trace sampler arg must be between 0 and 1")
        return v


# Global settings instance
settings = Settings()
