#!/usr/bin/env python3
"""
Simple runner script for the exercise importer.
This script ensures proper Python path setup and environment loading.
"""

import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    env_file = backend_dir / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        print(f"📂 Loaded environment from {env_file}")
    else:
        print(f"⚠️  No .env file found at {env_file}")
except ImportError:
    print("⚠️  python-dotenv not installed, using system environment variables only")

# Now run the importer
if __name__ == "__main__":
    import asyncio
    from src.importers.exercise_importer import main

    print("🚀 Starting exercise importer...")
    asyncio.run(main())
