#!/usr/bin/env python3
"""
Simple runner script for the exercise importer.
This script ensures proper Python path setup and environment loading.
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
    from src.importers.exercise_importer import main

    logger.info("Starting exercise importer")
    asyncio.run(main())
