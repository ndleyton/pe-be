# PE-BE Tracker

PE-BE Tracker is a full-stack application designed to help users track their workouts with a (coming soon) AI agent Personal Trainer. It provides a robust backend API for data management and a responsive frontend for an intuitive user experience.

## Tech Stack

### Backend
-   **Language:** Python
-   **Framework:** FastAPI
-   **Database:** PostgreSQL (managed via Docker)
-   **ORM/Migrations:** SQLAlchemy with Alembic
-   **Dependency Management:** Poetry
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

## How to Run

To get the PE-BE Tracker application up and running on your local machine, follow these steps:

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