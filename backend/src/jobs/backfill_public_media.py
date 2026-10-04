"""Copy referenced published exercise images from local disk to the public R2 bucket.

Run once before setting MEDIA_PUBLIC_BASE_URL:

    python -m src.jobs.backfill_public_media --dry-run
    python -m src.jobs.backfill_public_media
"""

from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.object_storage import r2_enabled
from src.exercises.image_assets import (
    PUBLISHED_PREFIX,
    mirror_published_images,
    parse_image_url_list,
    storage_path_for_relative_url,
)
from src.exercises.models import ExerciseType
from src.jobs.shared import JobRunResult, configure_job_runtime, run_managed_job

logger = logging.getLogger(__name__)
JOB_NAME = "backfill_public_media"


async def referenced_published_paths(session: AsyncSession) -> list[str]:
    """Published paths referenced by committed exercise types and present on disk."""
    rows = await session.execute(
        select(ExerciseType.images_url).where(ExerciseType.images_url.is_not(None))
    )
    paths: set[str] = set()
    for (images_url,) in rows:
        for image_path in parse_image_url_list(images_url):
            if not image_path.startswith(PUBLISHED_PREFIX):
                continue
            try:
                if storage_path_for_relative_url(image_path).is_file():
                    paths.add(image_path)
            except ValueError:
                continue
    return sorted(paths)


async def _backfill_job(session: AsyncSession, *, dry_run: bool) -> dict[str, int]:
    relative_paths = await referenced_published_paths(session)
    if dry_run:
        return {"found": len(relative_paths), "uploaded": 0}

    uploaded = await asyncio.to_thread(mirror_published_images, relative_paths)
    return {"found": len(relative_paths), "uploaded": uploaded}


async def run(*, dry_run: bool = False) -> JobRunResult:
    if not dry_run and not r2_enabled():
        logger.info("Job disabled job_name=%s status=disabled", JOB_NAME)
        return JobRunResult(job_name=JOB_NAME, status="disabled", metrics={})

    async def job_callable(session: AsyncSession) -> dict[str, int]:
        return await _backfill_job(session, dry_run=dry_run)

    return await run_managed_job(
        job_name=JOB_NAME,
        job_callable=job_callable,
        job_logger=logger,
    )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    configure_job_runtime()
    result = asyncio.run(run(dry_run=args.dry_run))
    if result.status == "disabled":
        print("MEDIA_STORAGE_BACKEND is not 'r2'; nothing uploaded.")
        return
    if result.status == "skipped":
        print("Skipped public media backfill; another run is active.")
        return

    print(
        f"Public media backfill{' (dry run)' if args.dry_run else ''}: "
        f"found={int(result.metrics.get('found', 0))} "
        f"uploaded={int(result.metrics.get('uploaded', 0))}"
    )


if __name__ == "__main__":
    main()
