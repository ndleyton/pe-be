from __future__ import annotations

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.jobs.shared import JobRunResult, configure_job_runtime, run_managed_job
from src.workouts.photo_service import cleanup_deleted_workout_photos


logger = logging.getLogger(__name__)
JOB_NAME = "workout_photo_cleanup"


async def _cleanup_job(session: AsyncSession) -> dict[str, int]:
    return await cleanup_deleted_workout_photos(session)


async def run() -> JobRunResult:
    if not settings.JOB_WORKOUT_PHOTO_CLEANUP_ENABLED:
        logger.info("Job disabled job_name=%s status=disabled", JOB_NAME)
        return JobRunResult(job_name=JOB_NAME, status="disabled", metrics={})

    return await run_managed_job(
        job_name=JOB_NAME,
        job_callable=_cleanup_job,
        job_logger=logger,
    )


def main() -> None:
    configure_job_runtime()
    result = asyncio.run(run())
    if result.status == "disabled":
        print("Workout photo cleanup is disabled.")
        return

    if result.status == "skipped":
        print("Skipped workout photo cleanup; another run is active.")
        return

    deleted_rows = int(result.metrics.get("deleted_rows", 0))
    orphaned_files = int(result.metrics.get("orphaned_files", 0))
    reclaimed_bytes = int(result.metrics.get("reclaimed_bytes", 0))
    print(
        "Cleaned workout photos: "
        f"deleted_rows={deleted_rows} "
        f"orphaned_files={orphaned_files} "
        f"reclaimed_bytes={reclaimed_bytes}"
    )


if __name__ == "__main__":
    main()
