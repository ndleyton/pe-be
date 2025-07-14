"""
Admin endpoints for maintenance tasks
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/import-exercises")
async def import_exercises() -> Dict[str, Any]:
    """
    Import exercises from ext.exercises table to main application tables.
    This is a one-time operation for production setup.
    """
    try:
        from src.importers.exercise_importer import extract_and_transform_exercises, import_exercises_to_database
        
        # Extract and transform data
        data = await extract_and_transform_exercises()
        
        # Import to main tables
        await import_exercises_to_database(data)
        
        return {
            "status": "success",
            "message": "Exercise import completed successfully",
            "imported": {
                "exercise_types": len(data["exercise_types"]),
                "muscles": len(data["muscles"]),
                "muscle_groups": len(data["muscle_groups"]),
                "intensity_units": len(data["intensity_units"]),
                "exercise_muscles": len(data["exercise_muscles"])
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Import failed: {str(e)}"
        )

@router.get("/import-exercises/status")
async def import_status() -> Dict[str, Any]:
    """Check if exercises have been imported"""
    try:
        from src.core.database import get_async_session
        from sqlalchemy import text
        
        async with get_async_session() as session:
            # Check how many exercises with external_id exist
            result = await session.execute(
                text("SELECT COUNT(*) FROM exercise_types WHERE external_id IS NOT NULL")
            )
            imported_count = result.scalar()
            
            # Check total in ext.exercises
            try:
                ext_result = await session.execute(
                    text("SELECT COUNT(*) FROM ext.exercises")
                )
                total_available = ext_result.scalar()
            except:
                total_available = "Unknown (ext.exercises not found)"
            
            return {
                "imported_exercises": imported_count,
                "available_exercises": total_available,
                "import_needed": imported_count == 0,
                "status": "imported" if imported_count > 0 else "pending"
            }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Status check failed: {str(e)}"
        )