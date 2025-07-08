#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Run database migrations
echo "Running database migrations..."
poetry run alembic upgrade head
echo "Migrations complete."

# Start the application
echo "Starting Uvicorn server..."
poetry run uvicorn src.main:app --host 0.0.0.0 --port 8000
