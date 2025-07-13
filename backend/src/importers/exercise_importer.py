import asyncpg
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import sys
import os

# Add the backend directory to the path so we can import from src
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

try:
    from src.core.config import settings
except ImportError:
    # Fallback: try to import from environment variables directly
    import os
    from dataclasses import dataclass
    
    @dataclass
    class FallbackSettings:
        IMPORT_DATABASE_HOST: str = os.getenv("IMPORT_DATABASE_HOST", "localhost")
        IMPORT_DATABASE_PORT: int = int(os.getenv("IMPORT_DATABASE_PORT", "5432"))
        IMPORT_DATABASE_NAME: str = os.getenv("IMPORT_DATABASE_NAME", "gym_tracker_development")
        IMPORT_DATABASE_USER: str = os.getenv("IMPORT_DATABASE_USER", "postgres")
        IMPORT_DATABASE_PASSWORD: str = os.getenv("IMPORT_DATABASE_PASSWORD", "")
    
    settings = FallbackSettings()
    print("⚠️  Using fallback settings from environment variables")

async def get_db_connection():
    """Get database connection using environment variables from settings"""
    try:
        print(f"🔗 Connecting to import database: {settings.IMPORT_DATABASE_USER}@{settings.IMPORT_DATABASE_HOST}:{settings.IMPORT_DATABASE_PORT}/{settings.IMPORT_DATABASE_NAME}")
        return await asyncpg.connect(
            user=settings.IMPORT_DATABASE_USER,
            password=settings.IMPORT_DATABASE_PASSWORD,
            database=settings.IMPORT_DATABASE_NAME,
            host=settings.IMPORT_DATABASE_HOST,
            port=settings.IMPORT_DATABASE_PORT
        )
    except Exception as e:
        print(f"❌ Failed to connect to import database: {e}")
        print(f"📝 Make sure the following environment variables are set:")
        print(f"   IMPORT_DATABASE_HOST={settings.IMPORT_DATABASE_HOST}")
        print(f"   IMPORT_DATABASE_PORT={settings.IMPORT_DATABASE_PORT}")
        print(f"   IMPORT_DATABASE_NAME={settings.IMPORT_DATABASE_NAME}")
        print(f"   IMPORT_DATABASE_USER={settings.IMPORT_DATABASE_USER}")
        print(f"   IMPORT_DATABASE_PASSWORD=*** (hidden)")
        raise

@dataclass
class ValidationError(Exception):
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
            raise ValidationError(field, exercise_data.get(field), f"Required field '{field}' is missing or None")
    
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
            raise ValidationError("description", description, "Description too long (max 10000 characters)")
    
    # Validate images_url is valid JSON if present and contains only URL strings
    if "images_url" in exercise_data and exercise_data["images_url"] is not None:
        images_url = exercise_data["images_url"]
        if isinstance(images_url, str):
            try:
                parsed = json.loads(images_url)
                if not isinstance(parsed, list):
                    raise ValidationError("images_url", images_url, "Must be a JSON array")

                # Ensure every element is a string (no URL scheme validation)
                for element in parsed:
                    if not isinstance(element, str):
                        raise ValidationError("images_url", images_url, "Array elements must be strings")
            except json.JSONDecodeError as e:
                raise ValidationError("images_url", images_url, f"Invalid JSON: {e}")


def validate_muscle_data(muscle_name: str) -> None:
    """Validate muscle data"""
    if not isinstance(muscle_name, str) or not muscle_name.strip():
        raise ValidationError("muscle_name", muscle_name, "Must be a non-empty string")
    if len(muscle_name) > 100:  # Reasonable limit
        raise ValidationError("muscle_name", muscle_name, "Muscle name too long (max 100 characters)")


def validate_intensity_unit_data(unit_name: str) -> None:
    """Validate intensity unit data"""
    if not isinstance(unit_name, str) or not unit_name.strip():
        raise ValidationError("unit_name", unit_name, "Must be a non-empty string")
    if len(unit_name) > 50:  # Reasonable limit
        raise ValidationError("unit_name", unit_name, "Unit name too long (max 50 characters)")


async def extract_and_transform_exercises():
    conn = await get_db_connection()
    transaction = None
    try:
        
        ext_exercises = await conn.fetch("SELECT * FROM ext.exercises")

        exercise_types = []
        intensity_units = set()
        muscle_groups = set()
        muscles = set()
        exercise_muscles = []

        # Default names for grouping and units
        default_muscle_group = "Imported"
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
                    row.get("equipment"),
                    ", ".join(row.get("instructions", []) or []),
                    row.get("category")
                ]
                description = "\n".join(filter(None, description_parts))
                
                # Convert legacy numeric id to string immediately so we keep the same
                # representation everywhere (DB column is now TEXT).
                exercise_type = {
                    "external_id": str(row["id"]) if row["id"] is not None else None,
                    "name": row["name"],
                    "description": description,
                    "images_url": json.dumps(row.get("images", [])),
                    "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
                }
                
                # Validate exercise data
                validate_exercise_data(exercise_type)
                exercise_types.append(exercise_type)
            except ValidationError as e:
                print(f"Skipping invalid exercise (row {row.get('id', 'unknown')}): {e}")
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
                    print(f"Warning: Invalid intensity unit: {e}")

            # 3. MuscleGroup and Muscle Data
            primary_muscles = row.get("primary_muscles", []) or []
            secondary_muscles = row.get("secondary_muscles", []) or []
            all_muscles = set(primary_muscles + secondary_muscles)

            for muscle_name in all_muscles:
                try:
                    validate_muscle_data(muscle_name)
                    muscles.add(muscle_name)
                    # We'll associate all muscles with the default group for now
                    # In a real scenario, you might have a mapping
                except ValidationError as e:
                    print(f"Skipping invalid muscle '{muscle_name}': {e}")
                    continue
                
            # 4. exercise_muscles Relationship Data with primary/secondary flag
            for muscle_name in primary_muscles:
                try:
                    validate_muscle_data(muscle_name)
                    exercise_muscles.append({
                        "exercise_external_id": str(row["id"]),
                        "muscle_name": muscle_name,
                        "is_primary": True
                    })
                except ValidationError as e:
                    print(f"Skipping invalid primary exercise-muscle relationship for '{muscle_name}': {e}")
                    continue

            for muscle_name in secondary_muscles:
                try:
                    validate_muscle_data(muscle_name)
                    exercise_muscles.append({
                        "exercise_external_id": str(row["id"]),
                        "muscle_name": muscle_name,
                        "is_primary": False
                    })
                except ValidationError as e:
                    print(f"Skipping invalid secondary exercise-muscle relationship for '{muscle_name}': {e}")
                    continue

        # No database changes were made; nothing to commit.
        
        return {
            "exercise_types": exercise_types,
            "intensity_units": list(intensity_units),
            "muscle_groups": list(muscle_groups),
            "muscles": list(muscles),
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
    conn = await get_db_connection()
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
            await conn.execute("""
                INSERT INTO intensity_units (name, abbreviation, created_at, updated_at) 
                VALUES ($1, $2, $3, $3) 
                ON CONFLICT (name) DO NOTHING
            """, unit_name, unit_name.lower()[:10], now_ts)  # Simple abbreviation logic
        
        # Insert muscle groups
        for group_name in data["muscle_groups"]:
            await conn.execute("""
                INSERT INTO muscle_groups (name, created_at, updated_at) 
                VALUES ($1, $2, $2) 
                ON CONFLICT (name) DO NOTHING
            """, group_name, now_ts)

        # Prepare deterministic default names to avoid relying on set → list order
        default_group_name = data.get("default_muscle_group", "Imported")
        default_unit_name = data.get("default_intensity_unit")

        # Insert muscles
        for muscle_name in data["muscles"]:
            # Get muscle group ID (using the default group)
            group_id = await conn.fetchval(
                "SELECT id FROM muscle_groups WHERE name = $1", 
                default_group_name
            )
            
            await conn.execute("""
                INSERT INTO muscles (name, muscle_group_id, created_at, updated_at) 
                VALUES ($1, $2, $3, $3) 
                ON CONFLICT (name) DO NOTHING
            """, muscle_name, group_id, now_ts)
        
        # Insert exercise types
        for exercise_type in data["exercise_types"]:
            # Get default intensity unit ID
            if default_unit_name:
                unit_id = await conn.fetchval(
                    "SELECT id FROM intensity_units WHERE name = $1", 
                    default_unit_name
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
            
            await conn.execute("""
                INSERT INTO exercise_types 
                (external_id, name, description, images_url, default_intensity_unit, created_at, updated_at) 
                VALUES ($1, $2, $3, $4, $5, $6, $6)
                ON CONFLICT (external_id) DO NOTHING
            """, 
                exercise_type["external_id"],
                exercise_type["name"],
                exercise_type["description"],
                exercise_type["images_url"],
                unit_id,
                created_at_value
            )
        
        # Insert exercise-muscle relationships
        for exercise_muscle in data["exercise_muscles"]:
            # Get exercise type ID
            exercise_type_id = await conn.fetchval(
                "SELECT id FROM exercise_types WHERE external_id = $1",
                str(exercise_muscle["exercise_external_id"])
            )
            
            # Get muscle ID
            muscle_id = await conn.fetchval(
                "SELECT id FROM muscles WHERE name = $1",
                exercise_muscle["muscle_name"]
            )
            
            if exercise_type_id and muscle_id:
                # Maintain association table for ORM relationships
                await conn.execute("""
                    INSERT INTO exercise_types_muscles (exercise_type_id, muscle_id)
                    VALUES ($1, $2)
                    ON CONFLICT (exercise_type_id, muscle_id) DO NOTHING
                """, exercise_type_id, muscle_id)

                # Insert into detailed exercise_muscles table with primary flag
                await conn.execute("""
                    INSERT INTO exercise_muscles (exercise_type_id, muscle_id, is_primary, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $4)
                    ON CONFLICT (exercise_type_id, muscle_id) DO UPDATE SET
                        is_primary = EXCLUDED.is_primary,
                        updated_at = EXCLUDED.updated_at,
                        created_at = exercise_muscles.created_at
                """, exercise_type_id, muscle_id, exercise_muscle["is_primary"], now_ts)
        
        # Commit transaction
        await transaction.commit()
        print("✅ All data imported successfully!")
        
    except Exception as e:
        # Rollback transaction on any error
        if transaction:
            try:
                await transaction.rollback()
                print(f"❌ Transaction rolled back due to error: {e}")
            except Exception as rollback_error:
                print(f"⚠️ Error during rollback: {rollback_error}")
        raise e
    finally:
        await conn.close()


async def main():
    try:
        print("🔄 Extracting and transforming exercise data...")
        data = await extract_and_transform_exercises()
        
        print(f"📊 Extracted {len(data['exercise_types'])} exercise types, {len(data['muscles'])} muscles")
        
        # Pretty print the output for verification
        print("\n📋 Data preview:")
        print(json.dumps({
            "exercise_types_count": len(data['exercise_types']),
            "muscles_count": len(data['muscles']),
            "intensity_units": data['intensity_units'],
            "muscle_groups": data['muscle_groups'],
            "sample_exercise": data['exercise_types'][0] if data['exercise_types'] else None
        }, indent=2))
        
        # Ask for confirmation before importing
        response = input("\n🤔 Do you want to import this data to the database? (y/N): ")
        if response.lower() in ['y', 'yes']:
            print("\n🚀 Starting database import...")
            await import_exercises_to_database(data)
        else:
            print("\n⏹️ Import cancelled.")
            
    except Exception as e:
        print(f"\n💥 Error: {e}")
        raise


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
