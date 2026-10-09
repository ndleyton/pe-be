"""Reconcile unreferenced published files, R2 objects, and pending cache purges."""

from __future__ import annotations

import argparse
import asyncio
import logging

from src.core.config import settings
from src.exercises.published_media import reconcile_publications
from src.jobs.shared import JobRunResult, configure_job_runtime, run_managed_job

logger = logging.getLogger(__name__)
JOB_NAME = "reconcile_public_media"


async def run(*, dry_run: bool = False) -> JobRunResult:
    if not dry_run and not settings.JOB_PUBLIC_MEDIA_RECONCILIATION_ENABLED:
        return JobRunResult(job_name=JOB_NAME, status="disabled", metrics={})

    async def job(session):
        metrics = await reconcile_publications(
            session,
            dry_run=dry_run,
            grace_hours=settings.PUBLIC_MEDIA_ORPHAN_GRACE_HOURS,
        )
        if metrics["failed"]:
            raise RuntimeError(
                f"{metrics['failed']} public media takedowns remain pending"
            )
        return metrics

    return await run_managed_job(job_name=JOB_NAME, job_callable=job, job_logger=logger)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    configure_job_runtime()
    result = asyncio.run(run(dry_run=args.dry_run))
    print(
        f"Public media reconciliation: status={result.status} metrics={result.metrics}"
    )


if __name__ == "__main__":
    main()
