#!/usr/bin/env python3
"""
Test runner for the exercise importer with auto-proceed.
This script tests the importer without interactive prompts.
"""

import logging
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from src.core.logging import configure_logging

configure_logging()
logger = logging.getLogger(__name__)

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    env_file = backend_dir / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        logger.info("Loaded environment from %s", env_file)
    else:
        logger.warning("No .env file found at %s", env_file)
except ImportError:
    logger.warning("python-dotenv not installed; using system environment variables")

# Now run the importer
if __name__ == "__main__":
    import asyncio
    from src.importers.exercise_importer import (
        extract_and_transform_exercises,
        import_exercises_to_database,
    )

    async def test_main():
        try:
            logger.info("Starting exercise importer in test mode")
            logger.info("Extracting and transforming exercise data")
            data = await extract_and_transform_exercises()

            logger.info(
                "Extracted import test data exercise_types=%s muscles=%s",
                len(data["exercise_types"]),
                len(data["muscles"]),
            )

            # Auto-proceed in test mode
            logger.info("Auto-proceeding with database import in test mode")
            await import_exercises_to_database(data)
            logger.info("Import test completed successfully")

        except Exception:
            logger.exception("Import test failed")
            raise

    asyncio.run(test_main())
