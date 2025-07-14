#!/usr/bin/env python3
"""
Test runner for the exercise importer with auto-proceed.
This script tests the importer without interactive prompts.
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
    from src.importers.exercise_importer import extract_and_transform_exercises, import_exercises_to_database
    
    async def test_main():
        try:
            print("🚀 Starting exercise importer (test mode)...")
            print("🔄 Extracting and transforming exercise data...")
            data = await extract_and_transform_exercises()
            
            print(f"📊 Extracted {len(data['exercise_types'])} exercise types, {len(data['muscles'])} muscles")
            
            # Auto-proceed in test mode
            print("\n🚀 Auto-proceeding with database import in test mode...")
            await import_exercises_to_database(data)
            print("✅ Test completed successfully!")
            
        except Exception as e:
            print(f"\n💥 Test failed with error: {e}")
            raise
    
    asyncio.run(test_main())