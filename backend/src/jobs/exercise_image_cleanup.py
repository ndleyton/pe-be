from __future__ import annotations

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.exercises.image_upload_service import cleanup_exercise_image_candidates
from src.jobs.shared import JobRunResult, configure_job_runtime, run_managed_job


logger = logging.getLogger(__name__)
JOB_NAME = "exercise_image_cleanup"


async def _cleanup_job(session: AsyncSession) -> dict[str, int]:
    return await cleanup_exercise_image_candidates(session)


async def run() -> JobRunResult:
    if not settings.JOB_EXERCISE_IMAGE_CLEANUP_ENABLED:
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
        print("Exercise image cleanup is disabled.")
        return

    if result.status == "skipped":
        print("Skipped exercise image cleanup; another run is active.")
        return

    deleted_rows = int(result.metrics.get("deleted_rows", 0))
    orphaned_files = int(result.metrics.get("orphaned_files", 0))
    reclaimed_bytes = int(result.metrics.get("reclaimed_bytes", 0))
    print(
        "Cleaned exercise images: "
        f"deleted_rows={deleted_rows} "
        f"orphaned_files={orphaned_files} "
        f"reclaimed_bytes={reclaimed_bytes}"
    )


if __name__ == "__main__":
    main()
