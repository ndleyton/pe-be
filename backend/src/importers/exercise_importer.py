
import asyncpg
import json

async def get_db_connection():
    # Replace with your actual database connection details
    return await asyncpg.connect(
        user="your_user",
        password="your_password",
        database="gym_tracker_development",
        host="your_host"
    )

async def extract_and_transform_exercises():
    conn = await get_db_connection()
    try:
        ext_exercises = await conn.fetch("SELECT * FROM ext.exercises")

        exercise_types = []
        intensity_units = set()
        muscle_groups = set()
        muscles = set()
        exercise_muscles = []

        # Use a default muscle group for imported muscles
        default_muscle_group = "Imported"
        muscle_groups.add(default_muscle_group)

        for row in ext_exercises:
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
            
            exercise_type = {
                "external_id": row["id"],
                "name": row["name"],
                "description": description,
                "images_url": json.dumps(row.get("images", [])),
                "created_at": row["created_at"],
            }
            exercise_types.append(exercise_type)

            # 2. IntensityUnit Data
            # Assign a default intensity unit
            default_unit = "Kilograms"
            intensity_units.add(default_unit)

            # 3. MuscleGroup and Muscle Data
            primary_muscles = row.get("primary_muscles", []) or []
            secondary_muscles = row.get("secondary_muscles", []) or []
            all_muscles = set(primary_muscles + secondary_muscles)

            for muscle_name in all_muscles:
                muscles.add(muscle_name)
                # We'll associate all muscles with the default group for now
                # In a real scenario, you might have a mapping
                
            # 4. exercise_types_muscles Relationship Data
            for muscle_name in all_muscles:
                exercise_muscles.append({
                    "exercise_external_id": row["id"],
                    "muscle_name": muscle_name
                })

        return {
            "exercise_types": exercise_types,
            "intensity_units": list(intensity_units),
            "muscle_groups": list(muscle_groups),
            "muscles": list(muscles),
            "exercise_muscles": exercise_muscles,
        }

    finally:
        await conn.close()

if __name__ == "__main__":
    import asyncio

    async def main():
        data = await extract_and_transform_exercises()
        # Pretty print the output
        print(json.dumps(data, indent=2))

    asyncio.run(main())
