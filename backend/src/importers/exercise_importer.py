import asyncpg
import json
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass
import sys
import os

# Add the backend directory to the path so we can import from src
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

logger = logging.getLogger(__name__)

try:
    from src.core.config import settings
except ImportError:
    # Fallback: try to import from environment variables directly

    @dataclass
    class FallbackSettings:
        IMPORT_DATABASE_HOST: str = os.getenv("IMPORT_DATABASE_HOST", "localhost")
        IMPORT_DATABASE_PORT: int = int(os.getenv("IMPORT_DATABASE_PORT", "5432"))
        IMPORT_DATABASE_NAME: str = os.getenv(
            "IMPORT_DATABASE_NAME", "gym_tracker_development"
        )
        IMPORT_DATABASE_USER: str = os.getenv("IMPORT_DATABASE_USER", "postgres")
        IMPORT_DATABASE_PASSWORD: str = os.getenv("IMPORT_DATABASE_PASSWORD", "")

    settings = FallbackSettings()
    logger.warning("Using fallback settings from environment variables")

from src.exercises.muscle_group_mapping import (  # noqa: E402
    DEFAULT_MUSCLE_GROUP,
    KNOWN_MUSCLE_GROUPS,
    get_muscle_group_for_muscle,
)


async def get_import_db_connection():
    """Get database connection to import source using environment variables from settings"""
    try:
        logger.info(
            "Connecting to import source database user=%s host=%s port=%s database=%s",
            settings.IMPORT_DATABASE_USER,
            settings.IMPORT_DATABASE_HOST,
            settings.IMPORT_DATABASE_PORT,
            settings.IMPORT_DATABASE_NAME,
        )
        logger.info("Attempting source database connection timeout_seconds=30")
        return await asyncpg.connect(
            user=settings.IMPORT_DATABASE_USER,
            password=settings.IMPORT_DATABASE_PASSWORD,
            database=settings.IMPORT_DATABASE_NAME,
            host=settings.IMPORT_DATABASE_HOST,
            port=settings.IMPORT_DATABASE_PORT,
            timeout=30,  # 30 second timeout
            command_timeout=60,  # 60 second command timeout
        )
    except Exception:
        logger.exception(
            "Failed to connect to import source database host=%s port=%s database=%s user=%s",
            settings.IMPORT_DATABASE_HOST,
            settings.IMPORT_DATABASE_PORT,
            settings.IMPORT_DATABASE_NAME,
            settings.IMPORT_DATABASE_USER,
        )
        raise


async def get_target_db_connection():
    """Get database connection to target database using main DATABASE_URL"""
    try:
        from urllib.parse import urlparse

        url = urlparse(settings.DATABASE_URL)

        # Use default PostgreSQL port if not specified
        port = url.port or 5432

        logger.info(
            "Connecting to target database user=%s host=%s port=%s database=%s",
            url.username,
            url.hostname,
            port,
            url.path.lstrip("/"),
        )
        logger.info("Attempting target database connection timeout_seconds=30")
        return await asyncpg.connect(
            user=url.username,
            password=url.password,
            database=url.path.lstrip("/"),
            host=url.hostname,
            port=port,
            timeout=30,  # 30 second timeout
            command_timeout=60,  # 60 second command timeout
        )
    except Exception:
        logger.exception("Failed to connect to target database")
        raise


class ValidationError(ValueError):
    """Custom exception for validation errors"""

    field: str
    value: Any
    message: str

    def __str__(self):
        return f"Validation error for {self.field}='{self.value}': {self.message}"


def validate_exercise_data(exercise_data: Dict[str, Any]) -> None:
    """Validate exercise data before database insertion"""
    required_fields = ["external_id", "name"]

    # Check required fields
    for field in required_fields:
        if field not in exercise_data or exercise_data[field] is None:
            raise ValidationError(
                field,
                exercise_data.get(field),
                f"Required field '{field}' is missing or None",
            )

    # Validate external_id (can be string or integer, will be stored as string)
    external_id = exercise_data["external_id"]
    if external_id is not None:
        # Convert to string for consistent storage
        exercise_data["external_id"] = str(external_id)
        if not exercise_data["external_id"].strip():
            raise ValidationError("external_id", external_id, "Cannot be empty string")

    # Validate name is a non-empty string
    name = exercise_data["name"]
    if not isinstance(name, str) or not name.strip():
        raise ValidationError("name", name, "Must be a non-empty string")
    if len(name) > 255:
        raise ValidationError("name", name, "Name too long (max 255 characters)")

    # Validate description if present
    if "description" in exercise_data and exercise_data["description"] is not None:
        description = exercise_data["description"]
        if not isinstance(description, str):
            raise ValidationError("description", description, "Must be a string")
        if len(description) > 10000:  # Reasonable limit
            raise ValidationError(
                "description",
                description,
                "Description too long (max 10000 characters)",
            )

    # Validate images_url is valid JSON if present and contains only URL strings
    if "images_url" in exercise_data and exercise_data["images_url"] is not None:
        images_url = exercise_data["images_url"]
        if isinstance(images_url, str):
            try:
                parsed = json.loads(images_url)
                if not isinstance(parsed, list):
                    raise ValidationError(
                        "images_url", images_url, "Must be a JSON array"
                    )

                # Ensure every element is a string (no URL scheme validation)
                for element in parsed:
                    if not isinstance(element, str):
                        raise ValidationError(
                            "images_url", images_url, "Array elements must be strings"
                        )
            except json.JSONDecodeError as e:
                raise ValidationError("images_url", images_url, f"Invalid JSON: {e}")


def validate_muscle_data(muscle_name: str) -> None:
    """Validate muscle data"""
    if not isinstance(muscle_name, str) or not muscle_name.strip():
        raise ValidationError("muscle_name", muscle_name, "Must be a non-empty string")
    if len(muscle_name) > 100:  # Reasonable limit
        raise ValidationError(
            "muscle_name", muscle_name, "Muscle name too long (max 100 characters)"
        )


def validate_intensity_unit_data(unit_name: str) -> None:
    """Validate intensity unit data"""
    if not isinstance(unit_name, str) or not unit_name.strip():
        raise ValidationError("unit_name", unit_name, "Must be a non-empty string")
    if len(unit_name) > 50:  # Reasonable limit
        raise ValidationError(
            "unit_name", unit_name, "Unit name too long (max 50 characters)"
        )


async def extract_and_transform_exercises():
    conn = await get_import_db_connection()
    try:
        ext_exercises = await conn.fetch("SELECT * FROM ext.exercises")

        exercise_types = []
        intensity_units = set()
        muscle_groups = set()
        muscles = set()
        exercise_muscles = []

        # Add all known muscle groups
        for group in KNOWN_MUSCLE_GROUPS:
            if group == DEFAULT_MUSCLE_GROUP:
                continue
            muscle_groups.add(group)

        # Add fallback muscle group for unknown muscles
        default_muscle_group = DEFAULT_MUSCLE_GROUP
        muscle_groups.add(default_muscle_group)

        # Optional default intensity unit can be None (user-defined later)
        default_unit: Optional[str] = None

        for row in ext_exercises:
            try:
                # 1. ExerciseType Data
                description_parts = [
                    row.get("force"),
                    row.get("level"),
                    row.get("mechanic"),
                ]
                description = "\n".join(filter(None, description_parts))

                # Convert legacy numeric id to string immediately so we keep the same
                # representation everywhere (DB column is now TEXT).
                exercise_type = {
                    "external_id": str(row["id"]) if row["id"] is not None else None,
                    "name": row["name"],
                    "description": description,
                    "images_url": json.dumps(row.get("images", [])),
                    "instructions": "\n".join(row.get("instructions", []) or [])
                    if row.get("instructions")
                    else None,
                    "equipment": row.get("equipment"),
                    "category": row.get("category"),
                    "created_at": row["created_at"].isoformat()
                    if row.get("created_at")
                    else None,
                }

                # Validate exercise data
                validate_exercise_data(exercise_type)
                exercise_types.append(exercise_type)
            except ValidationError as e:
                logger.warning(
                    "Skipping invalid exercise row_id=%s error=%s",
                    row.get("id", "unknown"),
                    e,
                )
                continue

            # 2. IntensityUnit Data (optional)
            if default_unit is None:
                # Only set once, otherwise preserve previously determined value
                tentative_unit = "Kilograms"
                try:
                    validate_intensity_unit_data(tentative_unit)
                    default_unit = tentative_unit
                    intensity_units.add(tentative_unit)
                except ValidationError as e:
                    logger.warning("Skipping invalid intensity unit error=%s", e)

            # 3. MuscleGroup and Muscle Data
            primary_muscles = row.get("primary_muscles", []) or []
            secondary_muscles = row.get("secondary_muscles", []) or []
            all_muscles = set(primary_muscles + secondary_muscles)

            for muscle_name in all_muscles:
                try:
                    validate_muscle_data(muscle_name)
                    # Create muscle data with proper group assignment
                    muscle_group = get_muscle_group_for_muscle(muscle_name)
                    muscles.add(
                        (muscle_name, muscle_group)
                    )  # Store as tuple to preserve grouping
                except ValidationError as e:
                    logger.warning(
                        "Skipping invalid muscle name=%r error=%s", muscle_name, e
                    )
                    continue

            # 4. exercise_muscles Relationship Data with primary/secondary flag
            for muscle_name in primary_muscles:
                try:
                    validate_muscle_data(muscle_name)
                    exercise_muscles.append(
                        {
                            "exercise_external_id": str(row["id"]),
                            "muscle_name": muscle_name,
                            "is_primary": True,
                        }
                    )
                except ValidationError as e:
                    logger.warning(
                        "Skipping invalid primary exercise-muscle relationship muscle=%r error=%s",
                        muscle_name,
                        e,
                    )
                    continue

            for muscle_name in secondary_muscles:
                try:
                    validate_muscle_data(muscle_name)
                    exercise_muscles.append(
                        {
                            "exercise_external_id": str(row["id"]),
                            "muscle_name": muscle_name,
                            "is_primary": False,
                        }
                    )
                except ValidationError as e:
                    logger.warning(
                        "Skipping invalid secondary exercise-muscle relationship muscle=%r error=%s",
                        muscle_name,
                        e,
                    )
                    continue

        # No database changes were made; nothing to commit.

        # Convert muscles from set of tuples to list of dicts
        muscles_list = [{"name": name, "group": group} for name, group in muscles]

        return {
            "exercise_types": exercise_types,
            "intensity_units": list(intensity_units),
            "muscle_groups": list(muscle_groups),
            "muscles": muscles_list,
            "exercise_muscles": exercise_muscles,
            # Deterministic defaults for later import phase
            "default_muscle_group": default_muscle_group,
            "default_intensity_unit": default_unit,
        }

    except Exception as e:
        raise e
    finally:
        await conn.close()


async def import_exercises_to_database(data: Dict[str, Any]):
    """Import the extracted and validated data to the database"""
    conn = await get_target_db_connection()
    transaction = None

    try:
        # Start transaction
        transaction = conn.transaction()
        await transaction.start()

        from datetime import datetime, timezone

        now_ts = datetime.now(timezone.utc)

        # Helper to ensure sequences are aligned BEFORE any new inserts
        async def reset_sequence(table: str, seq_name: Optional[str] = None):
            if not seq_name:
                seq_name = f"{table}_id_seq"
            max_id = await conn.fetchval(f"SELECT COALESCE(MAX(id), 0) FROM {table}")
            await conn.execute("SELECT setval($1, $2, true)", seq_name, max_id)

        # Align sequences for tables that may have been seeded with explicit IDs
        await reset_sequence("intensity_units")
        await reset_sequence("muscle_groups")
        await reset_sequence("muscles")
        await reset_sequence("exercise_types")

        # Insert intensity units first with timestamps
        for unit_name in data["intensity_units"]:
            await conn.execute(
                """
                INSERT INTO intensity_units (name, abbreviation, created_at, updated_at)
                VALUES ($1, $2, $3, $3)
                ON CONFLICT (name) DO NOTHING
            """,
                unit_name,
                unit_name.lower()[:10],
                now_ts,
            )  # Simple abbreviation logic

        # Insert muscle groups
        for group_name in data["muscle_groups"]:
            await conn.execute(
                """
                INSERT INTO muscle_groups (name, created_at, updated_at)
                VALUES ($1, $2, $2)
                ON CONFLICT (name) DO NOTHING
            """,
                group_name,
                now_ts,
            )

        # Prepare deterministic default names to avoid relying on set → list order
        default_unit_name = data.get("default_intensity_unit")

        # Insert muscles with proper muscle group mapping
        for muscle_data in data["muscles"]:
            if isinstance(muscle_data, dict):
                muscle_name = muscle_data["name"]
                muscle_group_name = muscle_data["group"]
            else:
                # Fallback for backward compatibility
                muscle_name = muscle_data
                muscle_group_name = get_muscle_group_for_muscle(muscle_name)

            # Get muscle group ID
            group_id = await conn.fetchval(
                "SELECT id FROM muscle_groups WHERE name = $1", muscle_group_name
            )

            if group_id:
                await conn.execute(
                    """
                    INSERT INTO muscles (name, muscle_group_id, created_at, updated_at)
                    VALUES ($1, $2, $3, $3)
                    ON CONFLICT (name) DO NOTHING
                """,
                    muscle_name,
                    group_id,
                    now_ts,
                )
            else:
                logger.warning(
                    "Could not find muscle group for imported muscle muscle=%r muscle_group=%r",
                    muscle_name,
                    muscle_group_name,
                )

        # Insert exercise types
        for exercise_type in data["exercise_types"]:
            # Get default intensity unit ID
            if default_unit_name:
                unit_id = await conn.fetchval(
                    "SELECT id FROM intensity_units WHERE name = $1", default_unit_name
                )
            else:
                unit_id = None

            # Convert created_at back to datetime if it's a string
            created_at_value = exercise_type["created_at"]
            if isinstance(created_at_value, str):
                from datetime import datetime

                created_at_value = datetime.fromisoformat(created_at_value)
            if created_at_value is None:
                from datetime import datetime, timezone

                created_at_value = datetime.now(timezone.utc)

            await conn.execute(
                """
                INSERT INTO exercise_types
                (external_id, name, description, images_url, instructions, equipment, category, default_intensity_unit, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
                ON CONFLICT (external_id) DO NOTHING
            """,
                exercise_type["external_id"],
                exercise_type["name"],
                exercise_type["description"],
                exercise_type["images_url"],
                exercise_type["instructions"],
                exercise_type["equipment"],
                exercise_type["category"],
                unit_id,
                created_at_value,
            )

        # Insert exercise-muscle relationships
        for exercise_muscle in data["exercise_muscles"]:
            # Get exercise type ID
            exercise_type_id = await conn.fetchval(
                "SELECT id FROM exercise_types WHERE external_id = $1",
                str(exercise_muscle["exercise_external_id"]),
            )

            # Get muscle ID
            muscle_id = await conn.fetchval(
                "SELECT id FROM muscles WHERE name = $1", exercise_muscle["muscle_name"]
            )

            if exercise_type_id and muscle_id:
                # Insert into detailed exercise_muscles table with primary flag
                await conn.execute(
                    """
                    INSERT INTO exercise_muscles (exercise_type_id, muscle_id, is_primary, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $4)
                    ON CONFLICT (exercise_type_id, muscle_id) DO UPDATE SET
                        is_primary = EXCLUDED.is_primary,
                        updated_at = EXCLUDED.updated_at,
                        created_at = exercise_muscles.created_at
                """,
                    exercise_type_id,
                    muscle_id,
                    exercise_muscle["is_primary"],
                    now_ts,
                )

        # Commit transaction
        await transaction.commit()
        logger.info("All exercise import data committed successfully")

    except Exception as e:
        # Rollback transaction on any error
        if transaction:
            try:
                await transaction.rollback()
                logger.exception("Exercise import transaction rolled back due to error")
            except Exception:
                logger.exception("Error during exercise import rollback")
        raise e
    finally:
        await conn.close()


async def main():
    try:
        logger.info("Extracting and transforming exercise data")
        data = await extract_and_transform_exercises()

        logger.info(
            "Extracted import data exercise_types=%s muscles=%s",
            len(data["exercise_types"]),
            len(data["muscles"]),
        )

        # Pretty print the output for verification
        logger.info(
            "Import data preview:\n%s",
            json.dumps(
                {
                    "exercise_types_count": len(data["exercise_types"]),
                    "muscles_count": len(data["muscles"]),
                    "intensity_units": data["intensity_units"],
                    "muscle_groups": data["muscle_groups"],
                    "sample_exercise": data["exercise_types"][0]
                    if data["exercise_types"]
                    else None,
                },
                indent=2,
            ),
        )

        # Ask for confirmation before importing
        response = input(
            "\n🤔 Do you want to import this data to the database? (y/N): "
        )
        if response.lower() in ["y", "yes"]:
            logger.info("Starting database import")
            await import_exercises_to_database(data)
        else:
            logger.info("Import cancelled")

    except Exception:
        logger.exception("Exercise import failed")
        raise


if __name__ == "__main__":
    import asyncio
    from src.core.logging import configure_logging

    configure_logging()
    asyncio.run(main())
