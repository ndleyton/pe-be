import asyncio 
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool, create_engine
from sqlalchemy.engine import Connection  # Import Connection for type hint
from sqlalchemy.ext.asyncio import create_async_engine  # Use async engine

from alembic import context
from urllib.parse import urlsplit, urlunsplit

# --- Ensure correct path to import app ---
# Assuming alembic directory is at the same level as the 'app' directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# --- Import Base and all models from domain slices ---
# This is crucial for autogenerate
from src.core.database import Base

# Import all models to ensure they're registered with SQLAlchemy
from src.users.models import User, OAuthAccount
from src.workouts.models import Workout, WorkoutType
from src.exercises.models import Exercise, ExerciseType, ExerciseMuscle, IntensityUnit, MuscleGroup, Muscle
from src.exercise_sets.models import ExerciseSet
from src.recipes.models import Recipe, ExerciseTemplate, SetTemplate
from src.chat.models import Conversation, ConversationMessage

# --- Load .env file from the project root ---
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- Set target metadata ---
# This tells autogenerate what models to look at
target_metadata = Base.metadata

# --- Function to get Database URL ---
def get_url():
    """Retrieves the database URL from environment variables."""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable is not set or empty.")
    return db_url

def get_async_url():
    """Retrieves the async database URL for async operations."""
    db_url = get_url()
    # Convert postgresql:// to postgresql+asyncpg:// for async operations
    if db_url.startswith("postgresql://"):
        return db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        return db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    return db_url

# --- URL utilities and safety checks ---
def _redact_url_password(db_url: str) -> str:
    """Return the URL with password redacted for logging."""
    try:
        p = urlsplit(db_url)
        hostname = p.hostname or ""
        port_part = f":{p.port}" if p.port else ""
        if p.username:
            auth = f"{p.username}:{'***' if p.password else ''}@"
        else:
            auth = ""
        safe_netloc = f"{auth}{hostname}{port_part}"
        return urlunsplit((p.scheme, safe_netloc, p.path, p.query, p.fragment))
    except Exception:
        # Fallback to original if parsing fails
        return db_url

def _extract_host(db_url: str) -> str:
    try:
        return urlsplit(db_url).hostname or ""
    except Exception:
        return ""

def _log_and_validate_db_url(db_url: str) -> None:
    """Log the effective DB URL (redacted) and fail fast if host looks malformed in prod/staging."""
    env = os.getenv("ENVIRONMENT", "development").lower()
    redacted = _redact_url_password(db_url)
    host = _extract_host(db_url)

    print(f"Alembic using DATABASE_URL (redacted): {redacted}")
    print(f"Alembic DB host resolved: {host or '[empty]'}")

    # Allow short hostnames in local/dev and typical docker-compose service names
    allowed_no_dot_hosts = {"localhost", "db"}

    # In production/staging, require a fully-qualified domain name
    if env in {"production", "staging"}:
        if not host:
            raise RuntimeError(
                "DATABASE_URL host is empty. Please set a valid DATABASE_URL (e.g., from your DB provider)."
            )
        if "." not in host and host not in allowed_no_dot_hosts:
            raise RuntimeError(
                "DATABASE_URL host appears malformed (no dot). Expected a fully-qualified domain name "
                "like '...render.com' or your provider's FQDN. Current host: '" + host + "'"
            )

# --- Offline Mode ---
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    # You can use get_url() here too if you want consistency,
    # but reading from alembic.ini is the default offline behavior.
    url = config.get_main_option("sqlalchemy.url") or get_url() # Fallback to env var
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

# --- Online Mode ---
def do_run_migrations(connection: Connection) -> None:
    """Helper function to run migrations within a transaction."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode using a synchronous engine."""
    # Use the regular URL for sync operations
    db_url = get_url()
    
    # If the URL is using the asyncpg driver, convert it to the synchronous
    # equivalent so that create_engine() receives a compatible dialect.
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    elif db_url.startswith("postgres+asyncpg://"):
        db_url = db_url.replace("postgres+asyncpg://", "postgres://", 1)
    
    # Log and validate before connecting
    _log_and_validate_db_url(db_url)
    
    connectable = create_engine(
        db_url,
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        do_run_migrations(connection)
    
    connectable.dispose()

async def run_migrations_online_async() -> None:
    """Run migrations in 'online' mode using an async engine."""
    async_db_url = get_async_url()
    # Log and validate before connecting
    _log_and_validate_db_url(async_db_url)

    connectable = create_async_engine(
        async_db_url,
        poolclass=pool.NullPool,
        future=True, # Recommended for SQLAlchemy 2.0 style
    )

    async with connectable.connect() as connection:
        # Run the actual migration logic within run_sync
        await connection.run_sync(do_run_migrations)

    # Dispose the engine explicitly
    await connectable.dispose()

# --- Main Execution Logic ---
if context.is_offline_mode():
    print("Running migrations offline...")
    run_migrations_offline()
else:
    print("Running migrations online...")
    # Use sync migrations by default for better CI compatibility
    # Determine whether to run migrations asynchronously:
    #   1. If the caller explicitly sets ALEMBIC_ASYNC=true
    #   2. If the DATABASE_URL already uses an async-only driver (e.g. postgresql+asyncpg)
    _async_env_flag = os.getenv("ALEMBIC_ASYNC", "false").lower() == "true"
    _db_url_raw = get_url()
    _async_driver = "+asyncpg" in _db_url_raw
    use_async = _async_env_flag or _async_driver
    
    if use_async:
        print("Using async migrations...")
        asyncio.run(run_migrations_online_async())
    else:
        print("Using sync migrations...")
        run_migrations_online()

print("Migration script finished.")
