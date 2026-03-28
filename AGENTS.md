# Development Guidelines

These instructions are for this repository.

- The Python backend lives in `backend/`.
- The React frontend lives in `pe-be-tracker-frontend/`.
- Run commands from the relevant subdirectory unless noted otherwise.

## Backend Commands

### Tests

- Full test suite: `cd backend && uv run pytest`
- Single test file during iteration: `cd backend && uv run pytest --no-cov tests/test_file.py`

Notes:
- `backend/pytest.ini` enforces coverage for the full suite with `--cov=src` and `--cov-fail-under=80`.
- Focused runs against a single file should usually use `--no-cov`, otherwise the global 80% coverage gate will still apply.
- Tests load `ENV_FILE` if set, otherwise `backend/.env.test`.
- Test safety checks require `DATABASE_URL` to point to a dedicated test database whose name contains `test`.

### Linting

- Run linting: `cd backend && uv run ruff check .`
- Auto-fix linting issues: `cd backend && uv run ruff check . --fix`

### Type Checking

- There is no repo-standard mypy setup wired into `backend/pyproject.toml` yet.
- Do not treat `uvx mypy src` as a required pre-PR gate unless the typing setup is intentionally being worked on.

### Database / Alembic

- Run migrations: `cd backend && uv run alembic upgrade head`
- Create new migration: `cd backend && uv run alembic revision --autogenerate -m "description"`
- Downgrade one revision: `cd backend && uv run alembic downgrade -1`
- Check migration status: `cd backend && uv run alembic current`

Notes:
- Alembic commands require `DATABASE_URL` to be set, or a populated `backend/.env`.
- Alembic loads models from `backend/src` via `backend/alembic/env.py`.

## Frontend Commands

- Install dependencies: `cd pe-be-tracker-frontend && npm install`
- Start dev server: `cd pe-be-tracker-frontend && npm run dev`
- Run linting: `cd pe-be-tracker-frontend && npm run lint`
- Run type checking: `cd pe-be-tracker-frontend && npm run typecheck`
- Run unit tests: `cd pe-be-tracker-frontend && npm test`
- Run coverage: `cd pe-be-tracker-frontend && npm run test:coverage`
- Run Playwright E2E: `cd pe-be-tracker-frontend && npm run test:e2e`

Notes:
- Frontend scripts assume `node_modules` is installed first.
- `VITE_API_BASE_URL` is required.
- Outside test mode, PostHog env vars are also required: `VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST`.

## Architecture Notes

### Deployment

- Production frontend traffic is served from Render at `app.personalbestie.com`.
- Production backend and PostgreSQL now run on a Hetzner VPS, not on Render.
- The public browser-facing API remains `https://app.personalbestie.com/api/...` via a frontend-side rewrite/proxy to the VPS origin.
- The current backend origin hostname is `origin-api.personalbestie.com`.
- When changing backend config, auth redirects, cookie behavior, or API routing, preserve the `app.personalbestie.com/api/...` public contract unless the task explicitly changes the deployment model.

### Backend

- The backend uses feature slices under `backend/src`, including `users`, `workouts`, `exercises`, `exercise_sets`, `recipes`, `chat`, `admin`, and `health`.
- The API mounts under `/api/v1` by default.
- User-facing "routines" are still implemented with `Recipe`, `ExerciseTemplate`, and `SetTemplate` models and the `recipes` table.
- AI-related backend code currently uses `langchain-google-genai` and `langfuse`; do not assume `openai` is the only active integration.

### Frontend

- The frontend uses React 19, TypeScript, Vite, React Router v7, TanStack Query, Tailwind CSS v4, and Zustand.
- Guest/local-first state is managed by a persisted Zustand store in `pe-be-tracker-frontend/src/stores/useGuestStore.ts`, not a React context.
- That guest-store persistence uses IndexedDB first, with localStorage fallback, via `pe-be-tracker-frontend/src/stores/indexedDBStorage.ts`.
- Guest-to-authenticated sync logic lives in `pe-be-tracker-frontend/src/utils/syncGuestData.ts`.
- App-wide providers are configured in `pe-be-tracker-frontend/src/app/providers/AppProviders.tsx`.
- Prefer thin route/page components. Move feature-specific behavior into feature hooks under `src/features/<feature>/hooks`, keep API calls in `api`, pure mapping/state helpers in `lib`, and rendering-heavy sections in smaller components.
- When a component mixes rendering with guest/auth branching, optimistic writes, debounced persistence, or nested editor state, treat that as a refactor signal. Split transport/workflow concerns from JSX instead of growing the component further.
- For guest vs authenticated flows, prefer a single hook or adapter boundary that hides the branching from the presentational component.
- If a hook or helper depends on nested server shapes, prefer shared fixtures in `pe-be-tracker-frontend/src/test/fixtures/` over large inline objects. Use server-style fixtures for authenticated flows and guest fixtures for local-first flows.
- For debounced hook tests, be careful combining fake timers with `waitFor`; prefer advancing timers inside `act(...)` and asserting directly on the resulting state or mock calls.

## API Conventions

- Prefer frontend endpoint constants in `pe-be-tracker-frontend/src/shared/api/endpoints.ts` instead of hardcoding paths.
- Preserve trailing slashes on collection endpoints used by the frontend client to avoid FastAPI `307` redirects on `POST`.
- Do not expose new user-facing API/UI copy as "recipes" unless you are intentionally referring to the backend model/table names. Use "routines" in the product surface.

## Backend Performance

- For detail endpoints that return a single entity plus a small fixed relationship graph, prefer `joinedload` over nested `selectinload` to avoid N+1-style multi-query fetches.
- For collection endpoints, choose `selectinload` vs `joinedload` deliberately based on expected row fanout; do not default blindly to one strategy.
- When investigating latency, instrument handler-local phases explicitly, especially DB fetch, schema serialization, and any ORM-to-response mapping that would otherwise be hidden inside framework overhead.
- Backend database pooling is configurable through `DATABASE_POOL_PRE_PING`, `DATABASE_POOL_USE_LIFO`, `DATABASE_POOL_SIZE`, `DATABASE_MAX_OVERFLOW`, `DATABASE_POOL_TIMEOUT`, and `DATABASE_POOL_RECYCLE`; check those settings before assuming per-request connection setup is an application bug.

Useful current route examples:
- Routines API: `/api/v1/routines/`
- Workouts list API: `/api/v1/workouts/mine`
- Workout types API: `/api/v1/workouts/workout-types/`
- Exercise types API: `/api/v1/exercises/exercise-types/`
- Exercise sets for an exercise: `/api/v1/exercise-sets/exercise/{exercise_id}`
- Auth session probe: `/api/v1/auth/session`

## Migration Guidance

Prefer defensive migrations for schema changes that may hit drifted environments, especially when altering or dropping existing objects.

### Preferred Patterns

1. Guard column adds and drops with schema inspection.
   ```python
   connection = op.get_bind()
   inspector = sa.inspect(connection)
   columns = [col["name"] for col in inspector.get_columns("table_name")]

   if "column_name" not in columns:
       op.add_column("table_name", sa.Column("column_name", sa.String(255)))

   if "column_name" in columns:
       op.drop_column("table_name", "column_name")
   ```

2. Guard table drops and creates with inspector checks.
   ```python
   connection = op.get_bind()
   inspector = sa.inspect(connection)

   if "table_name" in inspector.get_table_names():
       op.drop_table("table_name")
   ```

3. For Postgres-specific index operations, `IF EXISTS` / `IF NOT EXISTS` via `op.execute(...)` is acceptable.
   ```python
   op.execute("CREATE INDEX IF NOT EXISTS idx_name ON table_name (column_name)")
   op.execute("DROP INDEX IF EXISTS idx_name")
   ```

### Avoid

- Blind destructive operations against existing tables or columns when a simple existence check would make the migration safer.
- Raw SQL for everything by default when Alembic operations plus a guard are clearer.

### Validation

- Test migrations against a realistic copy of data when the change is non-trivial.
- Verify both upgrade and downgrade paths when a downgrade is expected to remain usable.

## Workflow

1. Run `ruff` and the relevant backend tests before handoff.
2. Use focused tests during iteration, then run broader coverage before finalizing backend changes.
3. For frontend work, run the relevant npm checks from `pe-be-tracker-frontend/`.
4. When extracting significant frontend logic into custom hooks, add dedicated hook tests for the new behavior instead of relying only on page/component tests.
5. If a refactor introduces new reusable frontend test data shapes, add them to `pe-be-tracker-frontend/src/test/fixtures/` and reuse them instead of copying nested objects between tests.
6. Before merging a feature branch, rebase it onto the current `origin/main` instead of merging `main` into the branch:
   ```bash
   git fetch origin
   git switch my-branch
   git rebase origin/main
   ```
7. Keep database migrations defensive and easy to reason about.
8. Keep changes focused; avoid mixing unrelated work in one PR.
