# PersonalBestie

PersonalBestie is a full-stack application designed to help users track their workouts with a (coming soon) AI agent Personal Trainer. It provides a robust backend API for data management and a responsive frontend for an intuitive user experience.

## Tech Stack

### Backend
-   **Language:** Python
-   **Framework:** FastAPI
-   **Database:** PostgreSQL (managed via Docker)
-   **ORM/Migrations:** SQLAlchemy with Alembic
-   **Dependency Management:** uv
-   **Containerization:** Docker

### Frontend
-   **Language:** TypeScript / JavaScript
-   **Framework:** React
-   **Build Tool:** Vite
-   **Styling:** Tailwind CSS
-   **Testing:** Vitest (Unit/Component), Playwright (E2E)
-   **Containerization:** Docker

### Overall
-   **Orchestration:** Docker Compose

## CI Caching

- GitHub Actions cache the backend virtualenv (`backend/.venv`) and uv download cache (`~/.cache/uv`).
- Cache key includes OS, Python version, and `backend/uv.lock`, so cache refreshes on lockfile updates or Python version changes.
- Installs use `uv sync` (build jobs use `--frozen`) to stay consistent with the committed lockfile.

## How to Run

To get the PersonalBestie application up and running on your local machine, follow these steps:

### Prerequisites

Ensure you have the following installed:
-   [Docker](https://docs.docker.com/get-docker/)
-   [Docker Compose](https://docs.docker.com/compose/install/)

### Steps

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd pe-be
    ```

2.  **Start the application using Docker Compose:**
    This command will build the Docker images for both the backend and frontend, set up the PostgreSQL database, and start all services.
    ```bash
    docker compose up --build
    ```

3.  **Access the application:**
    Once all services are running, the frontend application should be accessible in your web browser at `http://localhost:5173` (or the port configured in `docker-compose.yml` and `vite.config.js`).

    The backend API will be available at `http://localhost:8000`.

### Stopping the application

To stop the running services and remove the containers, networks, and volumes created by `docker compose up`:

```bash
docker compose down -v
```

This will ensure a clean shutdown and remove the database volume, allowing you to start fresh if needed.

## Timezone & Date Handling

PersonalBestie follows a **UTC-first** strategy:

1. **Storage & Transport (Always UTC)**
   * All `DateTime` columns in Postgres are declared with `timezone=True` so they map to the `timestamptz` type.
   * The backend converts every inbound timestamp to UTC via Pydantic validators (`ensure_utc`) and generates server-side timestamps with `datetime.now(timezone.utc)`.
   * FastAPI serialises these aware `datetime` objects as ISO-8601 strings that end with `Z` (e.g. `2024-06-17T13:45:00Z`).
   * The React frontend sends timestamps in the same format, using the helper `toUTCISOString()` to convert user input to UTC before an API call.

2. **Presentation (User Local by Default)**
   * Timestamps received from the API are kept in UTC but **rendered** in the user’s local time zone via `formatDisplayDate()` and `formatRelativeTime()`.
   * If you need to show the actual zone, pass `includeTimezone: true` to `formatDisplayDate` and it will append the short zone label (e.g. `PDT`).

3. **HTML `<input type="datetime-local">` Quirk**
   * This control emits a string **without** a time-zone designator. `toUTCISOString()` detects this case and appends the user’s offset so the value is stored correctly.

### Quick Rules for Contributors

* **When sending data to the backend:** always run human input through `toUTCISOString()` or send `null`.
* **When displaying a timestamp:** use `formatDisplayDate()` or `formatRelativeTime()`—do **not** call `new Date().toLocaleString()` directly unless you have a special case.
* **Never store local time** in the database; every timestamp must be timezone-aware UTC.

By centralising conversions in these helpers we avoid silent bugs, ensure consistent UX, and make future locale/timezone requirements easier to implement.
