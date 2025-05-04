# Fitness Tracker Backend (FastAPI)

## Setup

1. Install Poetry if you don't have it:
   ```bash
   pip install poetry
   ```
2. Install dependencies:
   ```bash
   poetry install
   ```
3. Copy `.env.example` to `.env` and fill in your secrets:
   ```bash
   cp .env.example .env
   ```
4. Run the server:
   ```bash
   poetry run uvicorn app.main:app --reload
   ```

## Stack
- FastAPI
- SQLAlchemy
- Alembic
- fastapi-users (Google OAuth)

## Next Steps
- Implement database models
- Set up authentication
- Add API endpoints
