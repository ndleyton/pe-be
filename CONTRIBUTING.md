# Contributing to PersonalBestie

Thank you for your interest in contributing to PersonalBestie! We welcome contributions from everyone.

This guide outlines our development process, coding standards, and how to get your changes merged.

---

## Code of Conduct

We follow the standard [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating in this project, you agree to abide by its terms.

---

## How Can I Contribute?

### 1. Report a Bug or Suggest a Feature
Before writing any code, search the issue tracker to see if your bug or feature request is already documented.
- To report a bug, open an issue using the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md).
- To suggest a feature, open an issue using the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md).

### 2. Submit a Pull Request
We use a trunk-based development workflow, with `main` as the single source-of-truth branch for active development and production releases:
- **`main` branch**: Feature, documentation, bugfix, release, and critical hotfix PRs should target `main`.
- **Short-lived branches**: Create focused feature, documentation, bugfix, or hotfix branches from `main`, then rebase onto `origin/main` before merging.

**Pull Request Process:**
1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feature/my-cool-feature
   # or
   git checkout -b bugfix/fix-some-bug
   ```
2. Write clean, documented code and include appropriate unit or integration tests.
3. Verify your changes locally (see the commands below).
4. Commit your changes. We recommend descriptive, semantic commit messages.
5. Push your branch to your fork and open a Pull Request targeting `main`.
6. Ensure all CI/CD checks (linting, type checking, unit tests) pass.
7. Before merging, please fetch updates and rebase onto `origin/main` to ensure a clean history:
   ```bash
   git fetch origin
   git switch feature/my-cool-feature
   git rebase origin/main
   ```

---

## Local Development Setup

Refer to the project [`README.md`](README.md) for full setup instructions. Here is a quick reference:

### Prerequisites
- **Python 3.10 to 3.12**
- **Node.js 20+**
- [**`uv`**](https://docs.astral.sh/uv/) (Fast Python package manager)
- **pnpm** (Corepack-enabled)
- **PostgreSQL** (running locally or in a container)

### Backend Commands (from [`backend/`](backend/))
- **Install dependencies**: `uv sync`
- **Run migrations**: `uv run alembic upgrade head`
- **Create a migration**: `uv run alembic revision --autogenerate -m "description"`
- **Start dev server**: `uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000`
- **Run full test suite**: `uv run pytest`
- **Run focused test file**: `uv run pytest --no-cov tests/test_file.py`
- **Run linter**: `uv run ruff check .`
- **Auto-fix linting issues**: `uv run ruff check . --fix`

### Frontend Commands (from [`pe-be-tracker-frontend/`](pe-be-tracker-frontend/))
- **Install dependencies**: `corepack enable && pnpm install`
- **Start dev server**: `pnpm run dev`
- **Run unit tests**: `pnpm test`
- **Run unit test coverage**: `pnpm run test:coverage`
- **Run typecheck**: `pnpm run typecheck`
- **Run linter**: `pnpm run lint`
- **Run E2E Playwright tests**: `pnpm run test:e2e`

---

## Coding Standards & Conventions

To keep the codebase maintainable, please adhere to these conventions:

### General & Time Handling
- **UTC-First Model**: Store and transport all timestamps in UTC. Convert user input to UTC before sending to the API. Only format and display timestamps in the user's local timezone in the React UI.
- **Product Terminology**: Use **Routines** in the product surface and UI. Avoid the legacy backend database terminology "recipes" in user-facing copy.

### FastAPI / SQLAlchemy Backend
- **Endpoint Slashes**: Always preserve trailing slashes on collection endpoints (e.g., `/api/v1/workouts/` instead of `/api/v1/workouts`) to prevent FastAPI from issuing a `307` redirect on `POST` requests.
- **Joinedload vs Selectinload**:
  - For detail endpoints returning a single entity plus a small fixed relationship graph, prefer `joinedload` over nested `selectinload` to avoid N+1-style queries.
  - For collection endpoints, choose between `selectinload` and `joinedload` deliberately based on the expected fanout.
- **Defensive Migrations**: When altering or dropping existing database objects, write defensive Alembic migrations to avoid issues in drifted environments. Use SQLAlchemy's inspector to guard column/table operations:
  ```python
  connection = op.get_bind()
  inspector = sa.inspect(connection)
  columns = [col["name"] for col in inspector.get_columns("table_name")]

  if "column_name" not in columns:
      op.add_column("table_name", sa.Column("column_name", sa.String(255)))
  ```
- **Test Safety**: Backend tests check the `DATABASE_URL` and require a dedicated test database whose name contains `test` (e.g., `postgres://.../pe_be_test`). This prevents accidental overwriting of development or production databases.
- **Async Test Safety**: Do not call `asyncio.run(...)` inside tests, as this will close the pytest-asyncio event loop. Instead, test the async functions directly and mock/monkeypatch if testing command line wrappers.

### React / Zustand Frontend
- **Routing & Rendering**: Keep route pages thin. Move logic into custom hooks under `src/features/<feature>/hooks` and API calls into the `api` module.
- **State Management**:
  - Authenticated flows are fetched from the server.
  - Guest/unauthenticated flows use a persistent Zustand store ([useGuestStore.ts](pe-be-tracker-frontend/src/stores/useGuestStore.ts)) backed by IndexedDB storage ([indexedDBStorage.ts](pe-be-tracker-frontend/src/stores/indexedDBStorage.ts)) with a localStorage fallback.
  - Transitions/sync from guest data to authenticated accounts happen inside [syncGuestData.ts](pe-be-tracker-frontend/src/utils/syncGuestData.ts).
- **API Constants**: Avoid hardcoding API URLs. Use the predefined endpoint constants in [endpoints.ts](pe-be-tracker-frontend/src/shared/api/endpoints.ts).
- **Unit & Hook Testing**: If you extract complex logic into custom hooks, add dedicated hook tests instead of relying only on component/page tests. Use shared test fixtures in `pe-be-tracker-frontend/src/test/fixtures/` for dummy data.

---

## AI Coaching Layer

PersonalBestie features an AI Coaching layer powered by Google Gemini and evaluated using Langfuse.
- **Automated Post-Workout Recap**: Generated asynchronously via [recap.py](backend/src/workouts/recap.py) (`WorkoutRecapService`). It gathers deterministic metrics (volume, PRs, sets) and qualitative notes to provide coaching feedback.
- If modifying AI prompts or tools, ensure they are thoroughly documented and check for trace compatibility with Langfuse configuration.

## CI/CD Pipelines

Our workflows validate code changes before merging:
- **`pr-validation.yml`**: Triggers on all PRs to analyze changes and validate PR metadata.
- **`backend.yml`**: Runs backend linters, security audits, and tests on backend changes.
- **`frontend.yml`**: Runs frontend linters, type checks, and unit tests on frontend changes.
- **`e2e.yml`**: Boots the full-stack system and runs Playwright E2E tests.

For detailed pipeline info, see [ci-cd.md](.github/ci-cd.md).
