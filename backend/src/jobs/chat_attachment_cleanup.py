from __future__ import annotations

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from src.chat.service import ChatService
from src.core.config import settings
from src.jobs.shared import JobRunResult, configure_job_runtime, run_managed_job


logger = logging.getLogger(__name__)
JOB_NAME = "chat_attachment_cleanup"


async def _cleanup_job(session: AsyncSession) -> dict[str, int]:
    deleted = await ChatService.cleanup_orphaned_attachments(session)
    return {"deleted_count": deleted}


async def run() -> JobRunResult:
    if not settings.JOB_CHAT_ATTACHMENT_CLEANUP_ENABLED:
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
        print("Chat attachment cleanup is disabled.")
        return

    if result.status == "skipped":
        print("Skipped stale orphaned chat attachment cleanup; another run is active.")
        return

    deleted_count = int(result.metrics.get("deleted_count", 0))
    print(f"Deleted {deleted_count} stale orphaned chat attachments.")


if __name__ == "__main__":
    main()
