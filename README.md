# PersonalBestie

PersonalBestie is a full-stack fitness tracker with a FastAPI backend, a React frontend, and an AI-powered coaching layer built around server-side function calling. The product centers on workouts, exercises, exercise sets, and routines, with local-first guest usage in the frontend and authenticated sync once a user signs in.

What makes the project technically interesting is that the AI layer is not just free-form chat. The backend exposes application-owned tools to Gemini, validates tool inputs with typed schemas, executes those tools server-side, and uses the results to answer questions grounded in real workout data.

## What Lives Here

| Path | Purpose |
| --- | --- |
| `backend/` | FastAPI API, SQLAlchemy models, Alembic migrations, tests |
| `pe-be-tracker-frontend/` | React 19 + Vite frontend |
| `docker-compose.yml` | Optional full-stack local environment |
| `AGENTS.md` | Repository-specific development instructions |

## Stack

### Backend

- Python
- FastAPI
- SQLAlchemy + Alembic
- PostgreSQL
- `uv` for dependency management and command execution
- Google Gemini integration via `google-genai`
- Server-side function calling over application-owned tools
- Langfuse observability

### Frontend

- React 19
- TypeScript
- Vite
- React Router v7
- TanStack Query
- Tailwind CSS v4
- Zustand
- Vitest and Playwright

## Local Development

The recommended workflow is to run the backend and frontend separately from their own directories.

### Prerequisites

- Python 3.10 to 3.12
- [`uv`](https://docs.astral.sh/uv/)
- Node.js and npm
- PostgreSQL

### 1. Start the Backend

From [`backend/`](backend/):

```bash
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Make sure Postgres is running first. If you want to use Docker just for the database, `docker compose up db -d` from the repo root is enough.

Important backend env vars:

- `DATABASE_URL`
- `SECRET_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FRONTEND_URL`

Default local API base:

```text
http://localhost:8000/api/v1
```

Health check:

```text
http://localhost:8000/health
```

### 2. Start the Frontend

From [`pe-be-tracker-frontend/`](pe-be-tracker-frontend/):

```bash
npm install
cp env.example .env.development
npm run dev
```

Minimum frontend env vars:

- `VITE_API_BASE_URL=http://localhost:8000/api/v1`

Also required outside test mode:

- `VITE_PUBLIC_POSTHOG_KEY`
- `VITE_PUBLIC_POSTHOG_HOST`

Default local frontend URL:

```text
http://localhost:5173
```

## Docker Compose

If you want a containerized setup instead, run this from the repo root:

```bash
docker compose up --build
```

Default compose ports:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Postgres: `localhost:5432`

Stop and remove containers plus the Postgres volume:

```bash
docker compose down -v
```

## Common Commands

Run commands from the relevant subdirectory unless noted otherwise.

### Backend

```bash
uv run pytest
uv run pytest --no-cov tests/test_file.py
uv run ruff check .
uv run ruff check . --fix
uv run alembic current
uv run alembic upgrade head
```

Notes:

- Full backend test runs enforce coverage via `backend/pytest.ini`.
- Focused test runs should usually use `--no-cov`.
- Tests load `ENV_FILE` if set, otherwise `backend/.env.test`.
- Test safety checks require a dedicated test database whose name contains `test`.

### Frontend

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
```

## Architecture Notes

### AI Layer

- The chat assistant uses Gemini with backend-owned tool definitions rather than relying on prompt-only behavior.
- **Post-Workout AI Recaps**: Automated coaching summaries generated upon workout completion, grounded in deterministic metrics (PRs, volume deltas) and qualitative notes.
- Tool inputs are defined as typed schemas and validated before execution.
- Tool execution stays server-side, which keeps access to user workout data and domain actions inside the application boundary.
- Langfuse is used for prompt and trace visibility around AI interactions.

### Backend

- API routes mount under `/api/v1` by default.
- Feature slices live under [`backend/src/`](backend/src/), including `users`, `workouts`, `exercises`, `exercise_sets`, `routines`, `chat`, `admin`, and `health`.
- User-facing "routines" are the product term. Avoid reintroducing "recipes" in UI or API copy unless you are intentionally referring to older backend model names.

Useful routes:

- `/api/v1/routines/`
- `/api/v1/workouts/mine`
- `/api/v1/workouts/workout-types/`
- `/api/v1/exercises/exercise-types/`
- `/api/v1/exercise-sets/exercise/{exercise_id}`
- `/api/v1/auth/session`

### Frontend

- Guest mode is local-first and persisted through a Zustand store, not React context.
- IndexedDB is the primary storage for guest state, with localStorage fallback.
- Guest-to-authenticated sync logic lives in [`pe-be-tracker-frontend/src/utils/syncGuestData.ts`](pe-be-tracker-frontend/src/utils/syncGuestData.ts).
- Shared endpoint constants live in [`pe-be-tracker-frontend/src/shared/api/endpoints.ts`](pe-be-tracker-frontend/src/shared/api/endpoints.ts).

## Conventions That Matter

- Preserve trailing slashes on collection endpoints used by the frontend client to avoid FastAPI `307` redirects on `POST`.
- Prefer endpoint constants over hardcoded frontend API paths.
- For backend detail endpoints with a small fixed relationship graph, prefer `joinedload` deliberately instead of defaulting to nested `selectinload`.
- Keep Alembic migrations defensive when changing existing schema objects.

## Time and Timezone Handling

The app follows a UTC-first model:

- Store and transport timestamps in UTC.
- Convert user input to UTC before sending it to the backend.
- Render timestamps in the user's local timezone in the UI.

If you touch date handling, preserve the existing helpers and avoid ad hoc formatting or local-time storage.

## Related Docs

- Repo instructions: [`AGENTS.md`](AGENTS.md)
- Backend setup details: [`backend/README.md`](backend/README.md)
- Frontend setup details: [`pe-be-tracker-frontend/README.md`](pe-be-tracker-frontend/README.md)
- Langfuse notes: [`backend/LANGFUSE_INTEGRATION.md`](backend/LANGFUSE_INTEGRATION.md)
