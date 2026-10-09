"""Publication locking, persistent takedown records, and orphan reconciliation.

The retry ledger lives on the phase-1 persistent image volume. It must move
with the source of truth before local volumes are retired.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import unquote, urlsplit

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.object_storage import (
    get_public_media_storage,
    purge_public_media,
    r2_enabled,
)
from src.exercises.image_assets import (
    PUBLISHED_PREFIX,
    exercise_image_storage_dir,
    parse_image_url_list,
    storage_path_for_relative_url,
)
from src.exercises.models import ExerciseType

logger = logging.getLogger(__name__)
# Shared by all publication writers and deletions; held until commit/rollback.
# shortcut: one global lock includes network calls; upgrade beyond a few concurrent admins.
PUBLICATION_LOCK_KEY = 724396802113


async def lock_publications(session: AsyncSession) -> None:
    await session.execute(select(func.pg_advisory_xact_lock(PUBLICATION_LOCK_KEY)))


def _validate_key(key: str) -> None:
    if (
        not key.startswith(PUBLISHED_PREFIX)
        or any(part in ("", ".", "..") for part in key.split("/"))
        or "\\" in key
    ):
        raise ValueError("Invalid published media key")
    path = storage_path_for_relative_url(key)
    published_root = storage_path_for_relative_url("published")
    if published_root not in path.parents:
        raise ValueError("Published media key escapes published directory")


def published_keys(raw_value: str | list[str] | None) -> set[str]:
    keys = set()
    base = settings.MEDIA_PUBLIC_BASE_URL.rstrip("/")
    for value in parse_image_url_list(raw_value):
        if base and value.startswith(base + "/"):
            value = unquote(
                urlsplit(value).path[len(urlsplit(base).path.rstrip("/")) + 1 :]
            )
        if value.startswith(PUBLISHED_PREFIX):
            _validate_key(value)
            keys.add(value)
    return keys


async def referenced_publications(session: AsyncSession) -> set[str]:
    # No disk-existence filter: the database protects even R2-only publications.
    with session.no_autoflush:
        rows = await session.execute(
            select(ExerciseType.images_url, ExerciseType.reference_images_url)
        )
    return set().union(*(published_keys(value) for row in rows for value in row))


def _record_path(key: str) -> Path:
    return (
        exercise_image_storage_dir()
        / ".published-media-pending"
        / (hashlib.sha256(key.encode()).hexdigest() + ".json")
    )


def queue_takedowns(keys, *, grace_hours: float = 0) -> None:
    for key in keys:
        if not key.startswith(PUBLISHED_PREFIX):
            continue
        _validate_key(key)
        path = _record_path(key)
        try:
            previous = json.loads(path.read_text()) if path.exists() else {}
            if path.exists():
                _validate_key(previous["key"])
                datetime.fromisoformat(previous["not_before"])
                if not isinstance(previous["r2"], bool) or not isinstance(
                    previous["base_url"], str
                ):
                    raise ValueError("Invalid takedown storage metadata")
        except (ValueError, OSError, KeyError, TypeError):
            # Preserve unreadable retry metadata; the batch reports this record as failed.
            logger.exception(
                "Unable to update published media takedown record=%s", path
            )
            continue
        record = {
            "key": key,
            "not_before": (
                datetime.now(timezone.utc) + timedelta(hours=grace_hours)
            ).isoformat(),
            "r2": previous.get("r2", False) or r2_enabled(),
            "base_url": previous.get("base_url") or settings.MEDIA_PUBLIC_BASE_URL,
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as temporary:
            json.dump(record, temporary)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary.name, path)
        directory_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)


def delete_queued_publication(key: str) -> None:
    _validate_key(key)
    record = json.loads(_record_path(key).read_text())
    # The record survives until origin deletion AND cache purge succeed.
    storage_path_for_relative_url(key).unlink(missing_ok=True)
    if record["r2"]:
        storage = get_public_media_storage()
        if storage is None:
            raise RuntimeError("Pending R2 takedown requires MEDIA_STORAGE_BACKEND=r2")
        storage.delete(key)
        purge_public_media(
            key, base_url=record["base_url"] or settings.MEDIA_PUBLIC_BASE_URL
        )
    _record_path(key).unlink(missing_ok=True)


async def process_takedowns(
    session: AsyncSession, *, keys=None, dry_run: bool = False
) -> dict[str, int]:
    metrics = {"eligible": 0, "deleted": 0, "failed": 0}
    await lock_publications(session)
    pending_dir = _record_path("published/placeholder").parent
    # Publication writers cannot change references while this transaction holds the lock.
    live_paths = await referenced_publications(session)
    for path in pending_dir.glob("*.json"):
        try:
            record = json.loads(path.read_text())
            key = record["key"]
            _validate_key(key)
            if keys is not None and key not in keys:
                continue
            if datetime.fromisoformat(record["not_before"]) > datetime.now(
                timezone.utc
            ):
                continue
            if key in live_paths:
                if not dry_run:
                    path.unlink(missing_ok=True)
                continue
            metrics["eligible"] += 1
            if not dry_run:
                await asyncio.to_thread(delete_queued_publication, key)
                metrics["deleted"] += 1
        except Exception:
            metrics["failed"] += 1
            logger.exception("Published media takedown pending record=%s", path)
    return metrics


def orphan_candidates(*, grace_hours: float) -> set[str]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=grace_hours)
    keys = set()
    root = exercise_image_storage_dir()
    for path in (root / "published").rglob("*"):
        if (
            path.is_file()
            and datetime.fromtimestamp(path.stat().st_mtime, timezone.utc) < cutoff
        ):
            key = path.relative_to(root).as_posix()
            try:
                _validate_key(key)
            except ValueError:
                logger.warning("Skipping invalid local published media key=%s", key)
                continue
            keys.add(key)
    storage = get_public_media_storage()
    if storage is not None:
        for key, modified in storage.list_objects(PUBLISHED_PREFIX):
            if modified < cutoff:
                try:
                    _validate_key(key)
                except ValueError:
                    logger.warning("Skipping invalid storage published media key=%s", key)
                    continue
                keys.add(key)
    return keys


async def reconcile_publications(
    session: AsyncSession, *, dry_run: bool, grace_hours: float
) -> dict[str, int]:
    candidates = await asyncio.to_thread(orphan_candidates, grace_hours=grace_hours)
    await lock_publications(session)
    orphans = candidates - await referenced_publications(session)
    if not dry_run:
        await asyncio.to_thread(queue_takedowns, orphans)
    metrics = await process_takedowns(session, dry_run=dry_run)
    if dry_run:
        # Pending records and newly discovered orphans can overlap.
        pending_keys = set()
        for path in _record_path("published/placeholder").parent.glob("*.json"):
            try:
                record = json.loads(path.read_text())
                _validate_key(record["key"])
                if datetime.fromisoformat(record["not_before"]) <= datetime.now(
                    timezone.utc
                ):
                    pending_keys.add(record["key"])
            except Exception:
                # process_takedowns already counted and logged this bad record.
                continue
        metrics["eligible"] += len(orphans - pending_keys)
    metrics["orphans"] = len(orphans)
    return metrics
