# PersonalBestie

PersonalBestie is a full-stack fitness tracker designed to help users log workouts, routines, and exercises, featuring a **local-first guest mode** and an **AI-powered coaching layer** built with server-side function calling.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi)](backend)
[![React 19](https://img.shields.io/badge/Frontend-React_19-61DAFB?style=flat&logo=react)](pe-be-tracker-frontend)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python)](backend)
[![pnpm](https://img.shields.io/badge/Package_Manager-pnpm-F69220?style=flat&logo=pnpm)](pe-be-tracker-frontend)
[![Gemini](https://img.shields.io/badge/AI-Google_Gemini-4285F4?style=flat&logo=google)](backend/src/workouts/recap.py)

---

## Key Features

*   **Local-First Guest Mode**: Instantly log workouts without an account. All data is persisted locally in the browser's IndexedDB and seamlessly synced to the database once you sign in.
*   **AI Coaching and Recaps**: Undergoes automated post-workout analysis using Google Gemini to summarize performance, detect personal records (PRs), and provide evidence-based workout insights.
*   **Server-Side Function Calling**: AI capabilities are validated and executed securely server-side using typed schemas and FastAPI-backed endpoints rather than ungrounded prompt generation.
*   **Responsive UI**: Modern interface optimized for both desktop and mobile screens, built with Tailwind CSS v4 and React 19.

---

## Project Structure

| Path | Purpose |
| --- | --- |
| [`backend/`](backend) | FastAPI application, SQLAlchemy models, Alembic migrations, and backend tests. |
| [`pe-be-tracker-frontend/`](pe-be-tracker-frontend) | React 19 + Vite frontend application. |
| [`docker-compose.yml`](docker-compose.yml) | Local multi-container development configuration. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Open-source contributor guidelines and conventions. |
| [`AGENTS.md`](AGENTS.md) | Reference file for AI agents and developer rule setups. |

---

## Stack Overview

### Backend
*   **Language & Runtime**: Python 3.10–3.12 managed by [**`uv`**](https://docs.astral.sh/uv/)
*   **Web Framework**: FastAPI
*   **ORM / Migrations**: SQLAlchemy + Alembic
*   **Database**: PostgreSQL
*   **AI Integration**: `google-genai` (Google Gemini)
*   **Observability**: Langfuse (tracing and prompt management)

### Frontend
*   **Library**: React 19 (TypeScript)
*   **Build Tool**: Vite
*   **Router**: React Router v7
*   **State Management**: Zustand
*   **Data Fetching**: TanStack Query
*   **Styling**: Tailwind CSS v4
*   **Testing**: Vitest & Playwright

---

## AI Layer & Architecture

What makes this project technically interesting is that the AI layer is not just free-form chat. It is structured around server-side function calling, typed inputs, real data grounding, and consistent image generation:

*   **Server-Side Function Calling**: Instead of relying on prompt-only instructions, the chat assistant uses Google Gemini with application-owned tools. The backend defines and exposes these tools to Gemini.
*   **Input Validation**: Tool inputs are validated using typed schemas before execution, ensuring reliability and security.
*   **Data Grounding**: The assistant answers questions by running tools that query the database for real, user-specific workout metrics (PRs, volume deltas, history) and notes.
*   **Post-Workout AI Recaps**: Automated, evidence-based coaching summaries are triggered asynchronously upon workout completion. Generated via [`backend/src/workouts/recap.py`](backend/src/workouts/recap.py) (`WorkoutRecapService`), it gathers workout statistics and qualitative notes to compose personalized coaching feedback.
*   **Consistent Image Generation Pipeline**: An advanced multi-phase image generation system in [`backend/src/genai/google_images.py`](backend/src/genai/google_images.py) produces consistent, multi-frame exercise guide illustrations. It uses the first generated frame (or an uploaded reference) as a visual anchor image, feeding it back into the model to generate the subsequent exercise phases (e.g., start/eccentric vs concentric positions) while maintaining anatomical consistency, clothing, art style, and framing.
*   **Observability**: Prompt versions, traces, and LLM latency are tracked in real-time using Langfuse. Details can be found in [`backend/LANGFUSE_INTEGRATION.md`](backend/LANGFUSE_INTEGRATION.md).

---

## Quick Start (Local Development)

The backend and frontend are typically run separately for a better hot-reloading experience.

### Prerequisites
*   Python 3.10 to 3.12 with [**`uv`**](https://docs.astral.sh/uv/)
*   Node.js 20+ with Corepack-enabled pnpm
*   PostgreSQL running (you can start a PostgreSQL container using `docker compose up db -d` from the root)

### 1. Launch the Backend
Navigate to [`backend/`](backend):
```bash
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```
*   **API Base**: `http://localhost:8000/api/v1`
*   **Health Check**: `http://localhost:8000/health`

### 2. Launch the Frontend
Navigate to [`pe-be-tracker-frontend/`](pe-be-tracker-frontend):
```bash
corepack enable
pnpm install
cp env.example .env.development
pnpm run dev
```
*   **Local URL**: `http://localhost:5173`

---

## Docker Compose Alternative

To run the entire full-stack application inside containers:
```bash
docker compose up --build
```
*   **Frontend**: `http://localhost:3000`
*   **Backend**: `http://localhost:8000`
*   **Postgres**: `localhost:5432`

To stop containers and tear down resources including database volumes:
```bash
docker compose down -v
```

---

## Common Development Commands

### Backend Commands
From [`backend/`](backend):
```bash
uv run pytest                            # Run full test suite with coverage
uv run pytest --no-cov tests/test_file.py # Run a single test file without coverage checks
uv run ruff check .                      # Lint codebase
uv run ruff check . --fix                # Auto-fix lint errors
uv run alembic current                   # Inspect current migration status
uv run alembic upgrade head              # Apply all migrations
```

### Frontend Commands
From [`pe-be-tracker-frontend/`](pe-be-tracker-frontend):
```bash
pnpm run dev                             # Start development server
pnpm run lint                            # Run ESLint validation
pnpm run typecheck                       # Check TypeScript compilability
pnpm test                                # Run unit tests via Vitest
pnpm run test:coverage                  # Run unit tests and generate coverage report
pnpm run test:e2e                        # Run Playwright E2E tests
```

---

## Architecture & Conventions

### Time and Timezones
*   All datetime metrics are transported and stored in **UTC**.
*   Conversions to UTC happen prior to database insertions/updates.
*   User-facing components in React format timestamps into the client's local timezone.

### Contributing
For details on database optimization (such as `joinedload` vs `selectinload`), branching strategies (`develop` as default targets), and defensive Alembic migration patterns, please read our dedicated [**`CONTRIBUTING.md`**](CONTRIBUTING.md) guide.

---

## License

PersonalBestie is open-source software licensed under the [MIT License](LICENSE).
