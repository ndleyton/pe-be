"""Copy published exercise images from local disk to the public R2 bucket.

Run once before setting MEDIA_PUBLIC_BASE_URL:

    python -m src.jobs.backfill_public_media --dry-run
    python -m src.jobs.backfill_public_media
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from dataclasses import dataclass

from src.exercises.image_assets import (
    PUBLISHED_PREFIX,
    exercise_image_storage_dir,
    mirror_published_images,
)
from src.core.object_storage import r2_enabled

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class BackfillResult:
    status: str
    found: int
    uploaded: int


def _published_relative_paths() -> list[str]:
    storage_root = exercise_image_storage_dir()
    published_root = storage_root / PUBLISHED_PREFIX
    if not published_root.is_dir():
        return []
    return sorted(
        str(path.relative_to(storage_root))
        for path in published_root.rglob("*")
        if path.is_file()
    )


def _backfill(dry_run: bool) -> BackfillResult:
    relative_paths = _published_relative_paths()
    if dry_run:
        return BackfillResult(status="dry_run", found=len(relative_paths), uploaded=0)
    if not r2_enabled():
        return BackfillResult(status="disabled", found=len(relative_paths), uploaded=0)

    uploaded = mirror_published_images(relative_paths)
    logger.info("Backfilled public media found=%s uploaded=%s", len(relative_paths), uploaded)
    return BackfillResult(status="ok", found=len(relative_paths), uploaded=uploaded)


async def run(*, dry_run: bool = False) -> BackfillResult:
    return await asyncio.to_thread(_backfill, dry_run)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO)
    result = asyncio.run(run(dry_run=args.dry_run))
    if result.status == "disabled":
        print("MEDIA_STORAGE_BACKEND is not 'r2'; nothing uploaded.")
    print(
        f"Public media backfill: status={result.status} "
        f"found={result.found} uploaded={result.uploaded}"
    )


if __name__ == "__main__":
    main()
