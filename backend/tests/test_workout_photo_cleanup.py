"""Tests for workout photo cleanup: service layer + job wiring."""
from __future__ import annotations

import hashlib
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.jobs import workout_photo_cleanup
from src.jobs.shared import JobRunResult
from src.workouts.models import WorkoutPhoto
from src.workouts.photo_service import cleanup_deleted_workout_photos
from tests.test_exercises_crud import _seed_user, _seed_workout, _seed_workout_type


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _make_photo(
    *,
    workout_id: int,
    user_id: int,
    storage_key: str,
    is_primary: bool = True,
    deleted_at: datetime | None = None,
    size_bytes: int = 1024,
) -> WorkoutPhoto:
    return WorkoutPhoto(
        workout_id=workout_id,
        user_id=user_id,
        storage_key=storage_key,
        mime_type="image/webp",
        size_bytes=size_bytes,
        sha256=hashlib.sha256(storage_key.encode()).hexdigest(),
        width=800,
        height=600,
        is_primary=is_primary,
        deleted_at=deleted_at,
        original_filename="test.webp",
    )


async def _count_photos(session: AsyncSession) -> int:
    result = await session.execute(select(WorkoutPhoto))
    return len(result.scalars().all())


# ---------------------------------------------------------------------------
# Service-level integration tests
# ---------------------------------------------------------------------------


async def test_cleanup_deletes_soft_deleted_photos_past_retention(
    db_session: AsyncSession,
    tmp_path: Path,
):
    """Soft-deleted photos older than the retention window are purged (DB + file)."""
    user = await _seed_user(db_session, "photo-cleanup-delete@example.com")
    wt = await _seed_workout_type(db_session, "Photo Cleanup Delete")
    workout = await _seed_workout(db_session, user.id, wt.id)
    await db_session.commit()

    # Create a file on disk for the deleted photo
    storage_key = f"user-{user.id}/workout-{workout.id}/old-deleted.webp"
    file_path = tmp_path / storage_key
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(b"fake-image-data")

    deleted_long_ago = datetime.now(timezone.utc) - timedelta(days=10)
    deleted_photo = _make_photo(
        workout_id=workout.id,
        user_id=user.id,
        storage_key=storage_key,
        is_primary=False,
        deleted_at=deleted_long_ago,
    )
    db_session.add(deleted_photo)
    await db_session.commit()

    result = await cleanup_deleted_workout_photos(
        db_session,
        storage_dir=tmp_path,
        retention_days=7,
        batch_size=100,
    )

    assert result["deleted_rows"] >= 1
    assert result["reclaimed_bytes"] >= len(b"fake-image-data")
    assert not file_path.exists(), "Deleted photo file should be removed"

    remaining = await _count_photos(db_session)
    assert remaining == 0


async def test_cleanup_preserves_active_primary_photo(
    db_session: AsyncSession,
    tmp_path: Path,
):
    """Active photos (deleted_at IS NULL) must NOT be touched."""
    user = await _seed_user(db_session, "photo-cleanup-active@example.com")
    wt = await _seed_workout_type(db_session, "Photo Cleanup Active")
    workout = await _seed_workout(db_session, user.id, wt.id)
    await db_session.commit()

    active_key = f"user-{user.id}/workout-{workout.id}/active.webp"
    active_path = tmp_path / active_key
    active_path.parent.mkdir(parents=True, exist_ok=True)
    active_path.write_bytes(b"active-image")

    active_photo = _make_photo(
        workout_id=workout.id,
        user_id=user.id,
        storage_key=active_key,
        is_primary=True,
        deleted_at=None,
    )
    db_session.add(active_photo)
    await db_session.commit()

    result = await cleanup_deleted_workout_photos(
        db_session,
        storage_dir=tmp_path,
        retention_days=7,
        batch_size=100,
    )

    assert result["deleted_rows"] == 0
    assert active_path.exists(), "Active photo file must NOT be removed"

    remaining = await _count_photos(db_session)
    assert remaining == 1


async def test_cleanup_preserves_recently_deleted_photos(
    db_session: AsyncSession,
    tmp_path: Path,
):
    """Soft-deleted photos within the retention window are kept."""
    user = await _seed_user(db_session, "photo-cleanup-recent@example.com")
    wt = await _seed_workout_type(db_session, "Photo Cleanup Recent")
    workout = await _seed_workout(db_session, user.id, wt.id)
    await db_session.commit()

    recent_key = f"user-{user.id}/workout-{workout.id}/recent-deleted.webp"
    recent_path = tmp_path / recent_key
    recent_path.parent.mkdir(parents=True, exist_ok=True)
    recent_path.write_bytes(b"recent-image")

    recently_deleted = datetime.now(timezone.utc) - timedelta(days=1)
    recent_photo = _make_photo(
        workout_id=workout.id,
        user_id=user.id,
        storage_key=recent_key,
        is_primary=False,
        deleted_at=recently_deleted,
    )
    db_session.add(recent_photo)
    await db_session.commit()

    result = await cleanup_deleted_workout_photos(
        db_session,
        storage_dir=tmp_path,
        retention_days=7,
        batch_size=100,
    )

    assert result["deleted_rows"] == 0
    assert recent_path.exists(), "Recently deleted photo should be kept"

    remaining = await _count_photos(db_session)
    assert remaining == 1


async def test_cleanup_handles_missing_files_gracefully(
    db_session: AsyncSession,
    tmp_path: Path,
):
    """If the file is already gone from disk, just delete the DB row."""
    user = await _seed_user(db_session, "photo-cleanup-nofile@example.com")
    wt = await _seed_workout_type(db_session, "Photo Cleanup No File")
    workout = await _seed_workout(db_session, user.id, wt.id)
    await db_session.commit()

    storage_key = f"user-{user.id}/workout-{workout.id}/no-file.webp"
    deleted_long_ago = datetime.now(timezone.utc) - timedelta(days=10)
    orphan_photo = _make_photo(
        workout_id=workout.id,
        user_id=user.id,
        storage_key=storage_key,
        is_primary=False,
        deleted_at=deleted_long_ago,
    )
    db_session.add(orphan_photo)
    await db_session.commit()

    result = await cleanup_deleted_workout_photos(
        db_session,
        storage_dir=tmp_path,
        retention_days=7,
        batch_size=100,
    )

    assert result["deleted_rows"] >= 1

    remaining = await _count_photos(db_session)
    assert remaining == 0


async def test_cleanup_mixed_active_and_deleted_photos(
    db_session: AsyncSession,
    tmp_path: Path,
):
    """With both active and deleted photos, only delete the eligible ones."""
    user = await _seed_user(db_session, "photo-cleanup-mixed@example.com")
    wt = await _seed_workout_type(db_session, "Photo Cleanup Mixed")
    workout = await _seed_workout(db_session, user.id, wt.id)
    await db_session.commit()

    # Active photo
    active_key = f"user-{user.id}/workout-{workout.id}/current.webp"
    active_path = tmp_path / active_key
    active_path.parent.mkdir(parents=True, exist_ok=True)
    active_path.write_bytes(b"current-image")

    active_photo = _make_photo(
        workout_id=workout.id,
        user_id=user.id,
        storage_key=active_key,
        is_primary=True,
        deleted_at=None,
    )
    db_session.add(active_photo)

    # Old deleted photo
    old_key = f"user-{user.id}/workout-{workout.id}/replaced.webp"
    old_path = tmp_path / old_key
    old_path.parent.mkdir(parents=True, exist_ok=True)
    old_path.write_bytes(b"replaced-image")

    old_deleted = datetime.now(timezone.utc) - timedelta(days=30)
    old_photo = _make_photo(
        workout_id=workout.id,
        user_id=user.id,
        storage_key=old_key,
        is_primary=False,
        deleted_at=old_deleted,
    )
    db_session.add(old_photo)
    await db_session.commit()

    result = await cleanup_deleted_workout_photos(
        db_session,
        storage_dir=tmp_path,
        retention_days=7,
        batch_size=100,
    )

    assert result["deleted_rows"] == 1
    assert not old_path.exists(), "Old deleted photo file should be removed"
    assert active_path.exists(), "Active photo file must NOT be touched"

    remaining = await _count_photos(db_session)
    assert remaining == 1


async def test_cleanup_removes_orphaned_files_on_disk(
    db_session: AsyncSession,
    tmp_path: Path,
):
    """Files on disk with no matching DB row are cleaned up after grace period."""
    # Create file on disk with no DB row, and set its mtime to old
    orphan_dir = tmp_path / "user-999" / "workout-999"
    orphan_dir.mkdir(parents=True, exist_ok=True)
    orphan_file = orphan_dir / "orphaned.webp"
    orphan_file.write_bytes(b"orphan-data")

    old_time = (datetime.now(timezone.utc) - timedelta(hours=48)).timestamp()
    os.utime(orphan_file, (old_time, old_time))

    result = await cleanup_deleted_workout_photos(
        db_session,
        storage_dir=tmp_path,
        retention_days=7,
        batch_size=100,
        orphan_grace_hours=24,
    )

    assert result["orphaned_files"] >= 1
    assert not orphan_file.exists()


async def test_cleanup_preserves_recent_orphaned_files(
    db_session: AsyncSession,
    tmp_path: Path,
):
    """Recently-created orphan files within grace period are NOT removed."""
    # Create file on disk with no DB row, but it's recent
    orphan_dir = tmp_path / "user-998" / "workout-998"
    orphan_dir.mkdir(parents=True, exist_ok=True)
    orphan_file = orphan_dir / "recent-orphan.webp"
    orphan_file.write_bytes(b"recent-orphan-data")
    # mtime is "now" by default -- within grace period

    await cleanup_deleted_workout_photos(
        db_session,
        storage_dir=tmp_path,
        retention_days=7,
        batch_size=100,
        orphan_grace_hours=24,
    )

    assert orphan_file.exists(), "Recent orphan file should be preserved"


async def test_cleanup_batch_size_limits_deletions(
    db_session: AsyncSession,
    tmp_path: Path,
):
    """Batch size limits how many rows are deleted per run."""
    user = await _seed_user(db_session, "photo-cleanup-batch@example.com")
    wt = await _seed_workout_type(db_session, "Photo Cleanup Batch")
    workout = await _seed_workout(db_session, user.id, wt.id)
    await db_session.commit()

    deleted_long_ago = datetime.now(timezone.utc) - timedelta(days=10)
    for i in range(5):
        key = f"user-{user.id}/workout-{workout.id}/batch-{i}.webp"
        photo = _make_photo(
            workout_id=workout.id,
            user_id=user.id,
            storage_key=key,
            is_primary=False,
            deleted_at=deleted_long_ago,
        )
        db_session.add(photo)
    await db_session.commit()

    result = await cleanup_deleted_workout_photos(
        db_session,
        storage_dir=tmp_path,
        retention_days=7,
        batch_size=2,
    )

    assert result["deleted_rows"] == 2


# ---------------------------------------------------------------------------
# Job module tests (unit-level, monkeypatched)
# ---------------------------------------------------------------------------


async def test_job_run_delegates_to_managed_runner(monkeypatch):
    async def _fake_cleanup(session):
        assert session == "session"
        return {"deleted_rows": 3, "orphaned_files": 1, "reclaimed_bytes": 4096}

    async def _fake_run_managed_job(*, job_name, job_callable, job_logger):
        assert job_name == workout_photo_cleanup.JOB_NAME
        assert job_logger is workout_photo_cleanup.logger
        metrics = await job_callable("session")
        assert metrics == {
            "deleted_rows": 3,
            "orphaned_files": 1,
            "reclaimed_bytes": 4096,
        }
        return JobRunResult(job_name=job_name, status="success", metrics=metrics)

    monkeypatch.setattr(
        workout_photo_cleanup,
        "cleanup_deleted_workout_photos",
        _fake_cleanup,
    )
    monkeypatch.setattr(
        workout_photo_cleanup,
        "run_managed_job",
        _fake_run_managed_job,
    )

    result = await workout_photo_cleanup.run()

    assert result.status == "success"
    assert result.metrics["deleted_rows"] == 3
    assert result.metrics["orphaned_files"] == 1
    assert result.metrics["reclaimed_bytes"] == 4096


async def test_job_run_returns_disabled_when_config_flag_is_false(monkeypatch):
    async def _unexpected_run_managed_job(**kwargs):
        raise AssertionError("managed job runner should not be called when disabled")

    monkeypatch.setattr(
        workout_photo_cleanup.settings,
        "JOB_WORKOUT_PHOTO_CLEANUP_ENABLED",
        False,
        raising=False,
    )
    monkeypatch.setattr(
        workout_photo_cleanup,
        "run_managed_job",
        _unexpected_run_managed_job,
    )

    result = await workout_photo_cleanup.run()

    assert result.status == "disabled"
    assert result.metrics == {}


def test_job_main_prints_skipped_message(monkeypatch, capsys):
    def _fake_configure_job_runtime():
        return None

    def _fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name=workout_photo_cleanup.JOB_NAME,
            status="skipped",
            metrics={},
        )

    monkeypatch.setattr(
        workout_photo_cleanup,
        "configure_job_runtime",
        _fake_configure_job_runtime,
    )
    monkeypatch.setattr(workout_photo_cleanup.asyncio, "run", _fake_run)

    workout_photo_cleanup.main()

    captured = capsys.readouterr()
    assert (
        captured.out.strip()
        == "Skipped workout photo cleanup; another run is active."
    )


def test_job_main_prints_disabled_message(monkeypatch, capsys):
    def _fake_configure_job_runtime():
        return None

    def _fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name=workout_photo_cleanup.JOB_NAME,
            status="disabled",
            metrics={},
        )

    monkeypatch.setattr(
        workout_photo_cleanup,
        "configure_job_runtime",
        _fake_configure_job_runtime,
    )
    monkeypatch.setattr(workout_photo_cleanup.asyncio, "run", _fake_run)

    workout_photo_cleanup.main()

    captured = capsys.readouterr()
    assert captured.out.strip() == "Workout photo cleanup is disabled."


def test_job_main_prints_success_metrics(monkeypatch, capsys):
    def _fake_configure_job_runtime():
        return None

    def _fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name=workout_photo_cleanup.JOB_NAME,
            status="success",
            metrics={"deleted_rows": 3, "orphaned_files": 1, "reclaimed_bytes": 4096},
        )

    monkeypatch.setattr(
        workout_photo_cleanup,
        "configure_job_runtime",
        _fake_configure_job_runtime,
    )
    monkeypatch.setattr(workout_photo_cleanup.asyncio, "run", _fake_run)

    workout_photo_cleanup.main()

    captured = capsys.readouterr()
    assert (
        captured.out.strip()
        == "Cleaned workout photos: deleted_rows=3 orphaned_files=1 reclaimed_bytes=4096"
    )
