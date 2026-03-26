from __future__ import annotations

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.jobs.shared import JobRunResult, configure_job_runtime, run_managed_job
from src.workouts.service import WorkoutService


logger = logging.getLogger(__name__)
JOB_NAME = "close_stale_open_workouts"


async def _close_stale_open_workouts_job(session: AsyncSession) -> dict[str, int]:
    closed_count = await WorkoutService.close_stale_open_workouts(
        session,
        max_age_hours=settings.JOB_CLOSE_STALE_OPEN_WORKOUTS_MAX_AGE_HOURS,
    )
    return {
        "closed_count": closed_count,
        "max_age_hours": settings.JOB_CLOSE_STALE_OPEN_WORKOUTS_MAX_AGE_HOURS,
    }


async def run() -> JobRunResult:
    if not settings.JOB_CLOSE_STALE_OPEN_WORKOUTS_ENABLED:
        logger.info("Job disabled job_name=%s status=disabled", JOB_NAME)
        return JobRunResult(job_name=JOB_NAME, status="disabled", metrics={})

    return await run_managed_job(
        job_name=JOB_NAME,
        job_callable=_close_stale_open_workouts_job,
        job_logger=logger,
    )


def main() -> None:
    configure_job_runtime()
    result = asyncio.run(run())
    if result.status == "disabled":
        print("Close stale open workouts job is disabled.")
        return

    if result.status == "skipped":
        print("Skipped stale open workout auto-close; another run is active.")
        return

    closed_count = int(result.metrics.get("closed_count", 0))
    max_age_hours = int(
        result.metrics.get(
            "max_age_hours", settings.JOB_CLOSE_STALE_OPEN_WORKOUTS_MAX_AGE_HOURS
        )
    )
    print(
        f"Closed {closed_count} stale open workouts older than {max_age_hours} hours."
    )


if __name__ == "__main__":
    main()
