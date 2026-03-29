# PersonalBestie Backend (FastAPI)

## Setup

1. Install uv (fast Python package manager):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   # restart your shell so `uv` is on PATH, or symlink ~/.local/bin/uv
   ```
2. Install dependencies:
   ```bash
   uv sync
   ```
3. Copy `.env.example` to `.env` and fill in your secrets:
   ```bash
   cp .env.example .env
   ```
4. Run the server (dev):
   ```bash
   uv run python main.py
   ```
   For auto-reload during development:
   ```bash
   uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
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

## Operator Commands

Promote an existing Google-authenticated account to superuser:

```bash
cd backend
uv run python -m src.users.promote_superuser --email you@example.com
```

This command only promotes an already-created user row.

## Stack
- FastAPI
- SQLAlchemy
- Alembic
- fastapi-users (Google OAuth)
- Domain-driven architecture with feature slices
