import os
from typing import Any
from pathlib import Path
from pydantic import Field, field_validator, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


WORKOUT_PHOTO_OPTIMIZED_OUTPUT_FORMATS = frozenset(
    {"avif", "gif", "jpeg", "jpg", "png", "webp"}
)


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
        "/auth/complete", validation_alias="FRONTEND_POST_LOGIN_PATH"
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
    CHAT_MODEL: str = Field(
        "gemini-2.5-flash",
        validation_alias="CHAT_MODEL",
        description="Gemini model for chat interactions",
    )
    WORKOUT_PARSER_MODEL: str = Field(
        "gemini-2.5-flash-lite",
        validation_alias="WORKOUT_PARSER_MODEL",
        description="Gemini model for workout text parsing",
    )
    WORKOUT_RECAP_MODEL: str = Field(
        "gemini-2.5-flash-lite",
        validation_alias="WORKOUT_RECAP_MODEL",
        description="Gemini model for workout recap generation",
    )

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
    JOB_EXERCISE_IMAGE_CLEANUP_ENABLED: bool = Field(
        True,
        validation_alias="JOB_EXERCISE_IMAGE_CLEANUP_ENABLED",
        description="Enable the scheduled exercise image cleanup job",
    )
    EXERCISE_IMAGE_CLEANUP_BATCH_SIZE: int = Field(
        25,
        validation_alias="EXERCISE_IMAGE_CLEANUP_BATCH_SIZE",
        description="Max exercise image candidate rows to clean up per sweep",
    )
    EXERCISE_IMAGE_DELETED_RETENTION_DAYS: int = Field(
        7,
        validation_alias="EXERCISE_IMAGE_DELETED_RETENTION_DAYS",
        description="Retention for deleted exercise image uploads before cleanup",
    )
    EXERCISE_IMAGE_REJECTED_RETENTION_DAYS: int = Field(
        90,
        validation_alias="EXERCISE_IMAGE_REJECTED_RETENTION_DAYS",
        description="Retention for rejected or abandoned exercise images before cleanup",
    )
    EXERCISE_IMAGE_ORPHAN_GRACE_HOURS: int = Field(
        24,
        validation_alias="EXERCISE_IMAGE_ORPHAN_GRACE_HOURS",
        description="Grace period before removing upload files with no database row",
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
    WORKOUT_PHOTO_STORAGE_DIR: str = Field(
        str(Path(__file__).resolve().parents[2] / ".workout_photos"),
        validation_alias="WORKOUT_PHOTO_STORAGE_DIR",
        description="Filesystem path for uploaded workout photos",
    )
    WORKOUT_PHOTO_MAX_BYTES: int = Field(
        10 * 1024 * 1024,
        validation_alias="WORKOUT_PHOTO_MAX_BYTES",
        description="Max accepted workout photo size in bytes",
    )
    WORKOUT_PHOTO_ALLOWED_MIME_TYPES: tuple[str, ...] = Field(
        ("image/jpeg", "image/png", "image/webp"),
        validation_alias="WORKOUT_PHOTO_ALLOWED_MIME_TYPES",
        description="Allowed MIME types for workout photo uploads",
    )
    WORKOUT_PHOTO_RATE_LIMIT_WINDOW_SECONDS: int = Field(
        60,
        validation_alias="WORKOUT_PHOTO_RATE_LIMIT_WINDOW_SECONDS",
        description="Time window for workout photo upload rate limiting",
    )
    WORKOUT_PHOTO_RATE_LIMIT_MAX_REQUESTS: int = Field(
        10,
        validation_alias="WORKOUT_PHOTO_RATE_LIMIT_MAX_REQUESTS",
        description="Max workout photo uploads allowed per window",
    )
    WORKOUT_PHOTO_MAX_EDGE_PX: int = Field(
        6000,
        gt=0,
        validation_alias="WORKOUT_PHOTO_MAX_EDGE_PX",
        description="Max longest edge accepted for source workout photo uploads",
    )
    WORKOUT_PHOTO_MAX_PIXELS: int = Field(
        16_000_000,
        gt=0,
        validation_alias="WORKOUT_PHOTO_MAX_PIXELS",
        description="Max decoded pixel count accepted for source workout photo uploads",
    )
    WORKOUT_PHOTO_OPTIMIZED_MAX_EDGE_PX: int = Field(
        1600,
        gt=0,
        validation_alias="WORKOUT_PHOTO_OPTIMIZED_MAX_EDGE_PX",
        description="Max longest edge for optimized workout photos",
    )
    WORKOUT_PHOTO_OPTIMIZED_FORMAT: str = Field(
        "webp",
        validation_alias="WORKOUT_PHOTO_OPTIMIZED_FORMAT",
        description="Output format for optimized workout photos",
    )
    EXERCISE_TYPES_USAGE_CACHE_TTL_SECONDS: int = Field(
        60,
        validation_alias="EXERCISE_TYPES_USAGE_CACHE_TTL_SECONDS",
        description="TTL for usage-sorted public exercise-type list responses",
    )
    EXERCISE_TYPES_NAME_CACHE_TTL_SECONDS: int = Field(
        3600,
        validation_alias="EXERCISE_TYPES_NAME_CACHE_TTL_SECONDS",
        description="TTL for name-sorted public exercise-type list responses",
    )
    TAXONOMY_CACHE_TTL_SECONDS: int = Field(
        86400,
        validation_alias="TAXONOMY_CACHE_TTL_SECONDS",
        description="TTL for slow-changing taxonomy GET responses",
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
    EXERCISE_IMAGE_STORAGE_DIR: str = Field(
        str(Path(__file__).resolve().parents[2] / ".exercise_images"),
        validation_alias="EXERCISE_IMAGE_STORAGE_DIR",
        description="Filesystem path for exercise reference and generated images",
    )
    EXERCISE_IMAGE_PHASE_MODEL: str = Field(
        "gemini-2.5-flash-image",
        validation_alias="EXERCISE_IMAGE_PHASE_MODEL",
        description="Gemini image model for phase image generation",
    )
    EXERCISE_IMAGE_REFERENCE_MODEL: str = Field(
        "gemini-2.5-flash-image",
        validation_alias="EXERCISE_IMAGE_REFERENCE_MODEL",
        description="Gemini image model for regenerate-from-reference pipeline",
    )
    EXERCISE_IMAGE_REFERENCE_TIMEOUT_SECONDS: int = Field(
        20,
        validation_alias="EXERCISE_IMAGE_REFERENCE_TIMEOUT_SECONDS",
        description="Timeout for downloading reference exercise images",
    )
    EXERCISE_IMAGE_UPLOAD_MAX_BYTES: int = Field(
        5 * 1024 * 1024,
        validation_alias="EXERCISE_IMAGE_UPLOAD_MAX_BYTES",
        description="Max accepted exercise type candidate upload size in bytes",
    )
    EXERCISE_IMAGE_UPLOAD_MAX_COUNT_PER_TYPE: int = Field(
        4,
        validation_alias="EXERCISE_IMAGE_UPLOAD_MAX_COUNT_PER_TYPE",
        description="Max active uploaded reference images per candidate exercise type",
    )
    EXERCISE_IMAGE_UPLOAD_MAX_BYTES_PER_USER: int = Field(
        100 * 1024 * 1024,
        validation_alias="EXERCISE_IMAGE_UPLOAD_MAX_BYTES_PER_USER",
        description="Max bytes of active exercise image uploads per user",
    )
    EXERCISE_IMAGE_UPLOAD_MAX_PIXELS: int = Field(
        16_000_000,
        validation_alias="EXERCISE_IMAGE_UPLOAD_MAX_PIXELS",
        description="Max decoded pixels for exercise type candidate uploads",
    )
    EXERCISE_IMAGE_UPLOAD_ALLOWED_MIME_TYPES: tuple[str, ...] = Field(
        ("image/png", "image/jpeg", "image/webp"),
        validation_alias="EXERCISE_IMAGE_UPLOAD_ALLOWED_MIME_TYPES",
        description="Allowed MIME types for exercise type candidate uploads",
    )
    EXERCISE_IMAGE_PUBLISHED_MAX_EDGE_PX: int = Field(
        1600,
        validation_alias="EXERCISE_IMAGE_PUBLISHED_MAX_EDGE_PX",
        description="Max longest edge for directly published uploaded exercise images",
    )
    EXERCISE_IMAGE_PUBLISHED_FORMAT: str = Field(
        "webp",
        validation_alias="EXERCISE_IMAGE_PUBLISHED_FORMAT",
        description="Output format for directly published uploaded exercise images",
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
    OTEL_SERVICE_VERSION: str = Field("", validation_alias="OTEL_SERVICE_VERSION")
    OTEL_EXPORTER_OTLP_ENDPOINT: str = Field(
        "", validation_alias="OTEL_EXPORTER_OTLP_ENDPOINT"
    )
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: str = Field(
        "", validation_alias="OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"
    )
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: str = Field(
        "", validation_alias="OTEL_EXPORTER_OTLP_METRICS_ENDPOINT"
    )
    OTEL_EXPORTER_OTLP_HEADERS: str = Field(
        "", validation_alias="OTEL_EXPORTER_OTLP_HEADERS"
    )
    OTEL_TRACES_SAMPLER_ARG: float = Field(
        0.1, validation_alias="OTEL_TRACES_SAMPLER_ARG"
    )
    OTEL_METRIC_EXPORT_INTERVAL_MILLIS: int = Field(
        60000, validation_alias="OTEL_METRIC_EXPORT_INTERVAL_MILLIS"
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

    @field_validator(
        "CHAT_ATTACHMENT_ALLOWED_MIME_TYPES",
        "EXERCISE_IMAGE_UPLOAD_ALLOWED_MIME_TYPES",
        "WORKOUT_PHOTO_ALLOWED_MIME_TYPES",
        mode="before",
    )
    @classmethod
    def parse_mime_type_lists(cls, v: Any) -> Any:
        if isinstance(v, str):
            normalized = v.strip()
            if not normalized:
                return ()
            if normalized.startswith("["):
                return v
            return tuple(
                part.strip().lower() for part in normalized.split(",") if part.strip()
            )
        if isinstance(v, (list, tuple, set)):
            return tuple(str(part).strip().lower() for part in v if str(part).strip())
        return v

    @field_validator("WORKOUT_PHOTO_OPTIMIZED_FORMAT", mode="before")
    @classmethod
    def validate_workout_photo_optimized_format(cls, v: Any) -> str:
        normalized = str(v).strip().lower()
        if normalized not in WORKOUT_PHOTO_OPTIMIZED_OUTPUT_FORMATS:
            allowed = ", ".join(sorted(WORKOUT_PHOTO_OPTIMIZED_OUTPUT_FORMATS))
            raise ValueError(
                f"WORKOUT_PHOTO_OPTIMIZED_FORMAT must be one of: {allowed}"
            )
        if normalized == "jpg":
            return "jpeg"
        return normalized


# Global settings instance
settings = Settings()
