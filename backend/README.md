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
   poetry run python main.py
   ```

## Environment Variables

### Security Configuration
- `COOKIE_SECURE`: Set to `true` for production to enable secure cookies over HTTPS (default: `false` for development)

### Required Variables
- `SECRET_KEY`: Secret key for JWT authentication
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `DATABASE_URL`: PostgreSQL database connection string

### Optional Variables
- `API_PREFIX`: API route prefix (default: `/api/v1`)
- `FRONTEND_URL`: Frontend URL for CORS (default: `http://localhost:5173`)
- `ENVIRONMENT`: Environment indicator (default: `development`)

## Production Deployment

For production, ensure you set the following environment variables:
```bash
COOKIE_SECURE=true
SECRET_KEY=your-strong-secret-key
DATABASE_URL=your-production-db-url
```

## Stack
- FastAPI
- SQLAlchemy
- Alembic
- fastapi-users (Google OAuth)
- Domain-driven architecture with feature slices
