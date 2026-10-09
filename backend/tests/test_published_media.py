from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
import json
import os
from pathlib import Path

import httpx
import pytest
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.admin.exercise_image_service import unpublish_images
from src.core import object_storage
from src.core.config import settings
from src.exercises import published_media as media
from src.exercises.image_assets import delete_published_images
from src.exercises.models import ExerciseType
from src.jobs import reconcile_public_media
from src.jobs.shared import JobRunResult


class Session:
    no_autoflush = nullcontext()

    def __init__(self, rows=()):
        self.rows = list(rows)
        self.locked = False
        self.reads = 0

    async def execute(self, statement):
        if "pg_advisory_xact_lock" in str(statement):
            self.locked = True
            return []
        assert self.locked
        self.reads += 1
        return self.rows


@pytest.fixture
def storage(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "EXERCISE_IMAGE_STORAGE_DIR", str(tmp_path))
    monkeypatch.setattr(settings, "MEDIA_STORAGE_BACKEND", "r2")
    monkeypatch.setattr(settings, "MEDIA_PUBLIC_BASE_URL", "https://media.example.com")
    objects = {}
    client = SimpleNamespace(
        list_objects=lambda prefix: iter(list(objects.items())),
        delete=Mock(side_effect=lambda key: objects.pop(key, None)),
    )
    monkeypatch.setattr(media, "get_public_media_storage", lambda: client)
    purge = Mock()
    monkeypatch.setattr(media, "purge_public_media", purge)
    return objects, client, purge


def write(tmp_path, key, *, hours_old=48):
    path = tmp_path / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"image")
    age = (datetime.now(timezone.utc) - timedelta(hours=hours_old)).timestamp()
    os.utime(path, (age, age))
    return path


@pytest.mark.asyncio
@pytest.mark.parametrize("dry_run", [False, True])
async def test_takedowns_lock_before_listing_and_reading_records(
    storage, monkeypatch, dry_run
):
    key = "published/pending.png"
    media.queue_takedowns([key])
    session = Session()
    glob = Path.glob
    read_text = Path.read_text

    def locked_glob(path, *args, **kwargs):
        assert session.locked
        return glob(path, *args, **kwargs)

    def locked_read_text(path, *args, **kwargs):
        assert session.locked
        return read_text(path, *args, **kwargs)

    monkeypatch.setattr(Path, "glob", locked_glob)
    monkeypatch.setattr(Path, "read_text", locked_read_text)
    result = await media.process_takedowns(session, dry_run=dry_run)
    assert result == {
        "eligible": 1,
        "deleted": int(not dry_run),
        "failed": 0,
    }


@pytest.mark.asyncio
async def test_reconcile_preserves_db_references_without_local_files(storage, tmp_path):
    objects, client, purge = storage
    old = datetime.now(timezone.utc) - timedelta(days=2)
    objects.update(
        {
            "published/live.png": old,
            "published/reference.png": old,
            "published/orphan.png": old,
        }
    )
    local = write(tmp_path, "published/local-orphan.png")
    session = Session([('["published/live.png"]', '["published/reference.png"]')])
    result = await media.reconcile_publications(session, dry_run=False, grace_hours=24)
    assert result == {"orphans": 2, "eligible": 2, "deleted": 2, "failed": 0}
    assert set(objects) == {"published/live.png", "published/reference.png"}
    assert not local.exists()
    assert session.reads == 2
    assert purge.call_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("dry_run", [False, True])
async def test_takedown_batch_reads_references_once(storage, tmp_path, dry_run):
    objects, client, purge = storage
    live = "published/live.png"
    orphans = [f"published/orphan-{index}.png" for index in range(10)]
    for key in [live, *orphans]:
        write(tmp_path, key)
    media.queue_takedowns([live, *orphans])
    session = Session([(json.dumps([live]), None)])

    result = await media.process_takedowns(session, dry_run=dry_run)

    assert session.reads == 1
    assert result == {
        "eligible": 10,
        "deleted": 0 if dry_run else 10,
        "failed": 0,
    }
    assert (tmp_path / live).exists()
    for key in orphans:
        assert (tmp_path / key).exists() == dry_run


@pytest.mark.asyncio
async def test_grace_period_preserves_recent_files_and_objects(storage, tmp_path):
    objects, client, purge = storage
    objects["published/recent-r2.png"] = datetime.now(timezone.utc)
    recent = write(tmp_path, "published/recent-local.png", hours_old=0)
    result = await media.reconcile_publications(
        Session(), dry_run=False, grace_hours=24
    )
    assert result["eligible"] == 0
    assert recent.exists()
    client.delete.assert_not_called()
    purge.assert_not_called()


@pytest.mark.asyncio
async def test_dry_run_changes_neither_files_objects_nor_retry_records(
    storage, tmp_path
):
    objects, client, purge = storage
    objects["published/orphan.png"] = datetime.now(timezone.utc) - timedelta(days=2)
    orphan = write(tmp_path, "published/orphan.png")
    media.queue_takedowns(["published/pending.png"])
    pending = media._record_path("published/pending.png")
    contents = pending.read_bytes()
    result = await media.reconcile_publications(Session(), dry_run=True, grace_hours=24)
    assert result["eligible"] == 2
    assert orphan.exists()
    assert pending.read_bytes() == contents
    assert not media._record_path("published/orphan.png").exists()
    client.delete.assert_not_called()
    purge.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["delete", "purge"])
async def test_failures_remain_pending_and_retry_after_origins_disappear(
    storage, tmp_path, failure
):
    objects, client, purge = storage
    key = "published/orphan.png"
    local = write(tmp_path, key)
    objects[key] = datetime.now(timezone.utc) - timedelta(days=2)
    media.queue_takedowns([key])
    target = client.delete if failure == "delete" else purge
    target.side_effect = RuntimeError("unavailable")
    result = await media.process_takedowns(Session())
    assert result["failed"] == 1
    assert not local.exists()
    assert media._record_path(key).exists()
    if failure == "purge":
        assert key not in objects
    client.delete.side_effect = lambda key: objects.pop(key, None)
    purge.side_effect = None
    result = await media.reconcile_publications(
        Session(), dry_run=False, grace_hours=24
    )
    assert result["deleted"] == 1
    assert not media._record_path(key).exists()
    assert not objects


@pytest.mark.asyncio
async def test_fresh_reference_check_prevents_deleting_a_reused_key(storage, tmp_path):
    objects, client, purge = storage
    key = "published/reused.png"
    local = write(tmp_path, key)
    session = Session()
    execute = session.execute

    async def new_reference(statement):
        if session.reads == 1:
            session.rows = [(json.dumps([key]), None)]
        return await execute(statement)

    session.execute = new_reference
    result = await media.reconcile_publications(session, dry_run=False, grace_hours=24)
    assert result["orphans"] == 1
    assert result["deleted"] == 0
    assert local.exists()
    client.delete.assert_not_called()


@pytest.mark.asyncio
async def test_new_publication_record_respects_grace_and_live_reference(
    storage, tmp_path
):
    objects, client, purge = storage
    key = "published/new.png"
    write(tmp_path, key)
    media.queue_takedowns([key], grace_hours=24)
    assert (await media.process_takedowns(Session()))["eligible"] == 0
    client.delete.assert_not_called()
    media.queue_takedowns([key])
    assert (await media.process_takedowns(Session([(json.dumps([key]), None)])))[
        "deleted"
    ] == 0
    assert not media._record_path(key).exists()
    assert (tmp_path / key).exists()
    client.delete.assert_not_called()
    purge.assert_not_called()


def test_failed_publish_cleanup_keeps_retry_record(storage, tmp_path):
    objects, client, purge = storage
    key = "published/new.png"
    write(tmp_path, key)
    client.delete.side_effect = RuntimeError("R2 unavailable")
    delete_published_images([key])
    assert not (tmp_path / key).exists()
    assert media._record_path(key).exists()


@pytest.mark.asyncio
async def test_unpublish_commits_before_deleting_and_preserves_shared_reference(
    storage, tmp_path
):
    objects, client, purge = storage
    key = "published/shared.png"
    exclusive = "published/exclusive.png"
    write(tmp_path, key)
    write(tmp_path, exclusive)
    exercise = SimpleNamespace(
        images_url=json.dumps([key, exclusive]),
        reference_images_url='["uploads/private.png"]',
    )
    session = Session([(exercise.images_url, exercise.reference_images_url)])
    session.refresh = AsyncMock()

    async def commit():
        client.delete.assert_not_called()
        session.rows = [
            (exercise.images_url, exercise.reference_images_url),
            (json.dumps([key]), None),
        ]

    session.commit = AsyncMock(side_effect=commit)
    await unpublish_images(session, exercise)
    assert json.loads(exercise.images_url) == []
    assert exercise.reference_images_url == '["uploads/private.png"]'
    assert (tmp_path / key).exists()
    assert not (tmp_path / exclusive).exists()
    client.delete.assert_called_once_with(exclusive)


@pytest.mark.asyncio
async def test_unpublish_commit_failure_does_not_delete_live_publication(
    storage, tmp_path
):
    objects, client, purge = storage
    key = "published/live.png"
    write(tmp_path, key)
    exercise = SimpleNamespace(images_url=json.dumps([key]), reference_images_url=None)
    session = Session([(exercise.images_url, None)])
    session.refresh = AsyncMock()
    session.commit = AsyncMock(side_effect=RuntimeError("ambiguous commit"))
    with pytest.raises(RuntimeError, match="ambiguous commit"):
        await unpublish_images(session, exercise)
    client.delete.assert_not_called()
    assert media._record_path(key).exists()
    assert (await media.process_takedowns(session))["deleted"] == 0
    assert (tmp_path / key).exists()


def test_public_keys_accept_cdn_urls_and_reject_path_escape(monkeypatch):
    monkeypatch.setattr(settings, "MEDIA_PUBLIC_BASE_URL", "https://media.example.com")
    assert media.published_keys('["https://media.example.com/published/a.png"]') == {
        "published/a.png"
    }
    with pytest.raises(ValueError, match="Invalid"):
        media.published_keys('["published/../../secret"]')


@pytest.mark.parametrize("success", [True, False])
def test_purge_request_and_api_failure(monkeypatch, success):
    monkeypatch.setattr(settings, "CLOUDFLARE_ZONE_ID", "zone")
    monkeypatch.setattr(settings, "CLOUDFLARE_CACHE_PURGE_TOKEN", "token")
    post = Mock(
        return_value=httpx.Response(
            200,
            json={"success": success},
            request=httpx.Request("POST", "https://api.cloudflare.com"),
        )
    )
    monkeypatch.setattr(httpx, "post", post)
    if success:
        object_storage.purge_public_media(
            "published/a.png", base_url="https://media.example.com/"
        )
    else:
        with pytest.raises(RuntimeError, match="unsuccessful"):
            object_storage.purge_public_media(
                "published/a.png", base_url="https://media.example.com/"
            )
    assert post.call_args.kwargs["json"] == {
        "files": ["https://media.example.com/published/a.png"]
    }
    assert post.call_args.kwargs["headers"] == {"Authorization": "Bearer token"}


def test_r2_listing_follows_all_pages():
    paginator = Mock()
    now = datetime.now(timezone.utc)
    paginator.paginate.return_value = [
        {"Contents": [{"Key": "published/a", "LastModified": now}]},
        {},
        {"Contents": [{"Key": "published/b", "LastModified": now}]},
    ]
    client = Mock()
    client.get_paginator.return_value = paginator
    storage = object_storage.ObjectStorage(bucket="bucket", client=client)
    assert list(storage.list_objects("published/")) == [
        ("published/a", now),
        ("published/b", now),
    ]
    paginator.paginate.assert_called_once_with(Bucket="bucket", Prefix="published/")


@pytest.mark.asyncio
async def test_reconciliation_job_disabled(monkeypatch):
    monkeypatch.setattr(settings, "JOB_PUBLIC_MEDIA_RECONCILIATION_ENABLED", False)
    assert (await reconcile_public_media.run()).status == "disabled"


def test_reconciliation_main_dry_run(monkeypatch, capsys):
    def fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name="reconcile_public_media", status="success", metrics={"eligible": 2}
        )

    monkeypatch.setattr(reconcile_public_media.asyncio, "run", fake_run)
    monkeypatch.setattr(reconcile_public_media, "configure_job_runtime", lambda: None)
    reconcile_public_media.main(["--dry-run"])
    assert "eligible" in capsys.readouterr().out


@pytest.mark.integration
@pytest.mark.asyncio
async def test_publication_lock_blocks_another_session_until_commit(db_session):
    await media.lock_publications(db_session)
    async with AsyncSession(bind=db_session.bind) as other:
        assert not await other.scalar(
            select(func.pg_try_advisory_xact_lock(media.PUBLICATION_LOCK_KEY))
        )
        await db_session.commit()
        assert await other.scalar(
            select(func.pg_try_advisory_xact_lock(media.PUBLICATION_LOCK_KEY))
        )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_reference_query_preserves_r2_only_and_reference_images(
    db_session, storage
):
    db_session.add(
        ExerciseType(
            name="Test",
            images_url='["published/live.png"]',
            reference_images_url='["published/reference.png"]',
        )
    )
    await db_session.commit()
    await media.lock_publications(db_session)
    assert await media.referenced_publications(db_session) == {
        "published/live.png",
        "published/reference.png",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("live", [False, True])
async def test_failed_publish_preserves_live_r2_path_when_local_copy_was_missing(
    storage, tmp_path, monkeypatch, live
):
    from src.admin import exercise_image_service as service

    objects, client, purge = storage
    candidate = SimpleNamespace(
        id=1,
        option_key="front",
        source_image_index=0,
        generation_key="key",
        pipeline_key=service.REFERENCE_PIPELINE_KEY,
        storage_path="generated/source.png",
        status="active",
    )
    write(tmp_path, candidate.storage_path)
    key = service._published_storage_path_for_candidate(1, "front", 0, "key", b"image")
    objects[key] = datetime.now(timezone.utc) - timedelta(days=2)
    exercise = SimpleNamespace(
        id=1, images_url=json.dumps([key]), reference_images_url='["reference.png"]'
    )
    session = Session(
        [(exercise.images_url if live else None, exercise.reference_images_url)]
    )
    session.refresh = AsyncMock()
    session.commit = AsyncMock()
    monkeypatch.setattr(
        service, "_load_candidates", AsyncMock(return_value=[candidate])
    )
    monkeypatch.setattr(
        service, "mirror_published_images", Mock(side_effect=RuntimeError("PUT failed"))
    )
    with pytest.raises(RuntimeError, match="PUT failed"):
        await service.apply_reference_or_option(
            session, exercise, option_key="front", use_reference=False
        )
    assert (tmp_path / key).exists() == live
    assert (key in objects) == live
    if live:
        client.delete.assert_not_called()
    else:
        client.delete.assert_called_once_with(key)
    session.commit.assert_not_awaited()


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("purge_fails", [False, True])
async def test_withdraw_endpoint_requires_admin_and_reports_pending_purge(
    async_client, db_session, storage, tmp_path, purge_fails
):
    from src.main import app
    from src.users.models import User
    from src.users.router import current_active_user

    objects, client, purge = storage
    key = "published/withdraw.png"
    write(tmp_path, key)
    exercise = ExerciseType(name="Withdraw", images_url=json.dumps([key]))
    user = User(
        email="withdraw@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add_all([exercise, user])
    await db_session.commit()
    await db_session.refresh(exercise)
    await db_session.refresh(user)
    exercise_id = exercise.id

    async def override_user():
        return user

    app.dependency_overrides[current_active_user] = override_user
    try:
        url = f"/api/v1/admin/exercise-types/{exercise_id}/published-images"
        forbidden = await async_client.delete(url)
        assert forbidden.status_code == 403
        assert (tmp_path / key).exists()
        user.is_superuser = True
        await db_session.commit()
        if purge_fails:
            purge.side_effect = RuntimeError("purge failed")
        response = await async_client.delete(url)
        assert response.status_code == (202 if purge_fails else 200), response.text
        assert response.json()["failed"] == int(purge_fails)
        assert not (tmp_path / key).exists()
        await db_session.refresh(exercise)
        assert json.loads(exercise.images_url) == []
        assert media._record_path(key).exists() == purge_fails
        assert (
            await async_client.delete(
                "/api/v1/admin/exercise-types/999999/published-images"
            )
        ).status_code == 404
    finally:
        app.dependency_overrides.pop(current_active_user, None)


@pytest.mark.asyncio
async def test_job_reports_pending_failures(monkeypatch):
    monkeypatch.setattr(settings, "JOB_PUBLIC_MEDIA_RECONCILIATION_ENABLED", True)
    monkeypatch.setattr(
        reconcile_public_media,
        "reconcile_publications",
        AsyncMock(return_value={"failed": 1}),
    )

    async def managed(**kwargs):
        return await kwargs["job_callable"](object())

    monkeypatch.setattr(reconcile_public_media, "run_managed_job", managed)
    with pytest.raises(RuntimeError, match="remain pending"):
        await reconcile_public_media.run()


def test_public_media_cache_policy_limits_browser_retention():
    assert (
        object_storage.PUBLIC_MEDIA_CACHE_CONTROL
        == "public, max-age=300, s-maxage=31536000"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("dry_run", [False, True])
@pytest.mark.parametrize(
    "contents", ["{", '{"key": "published/bad.png", "not_before": "bad"}']
)
async def test_reconcile_continues_past_corrupt_records(
    storage, tmp_path, caplog, dry_run, contents
):
    key = "published/pending.png"
    local = write(tmp_path, key)
    media.queue_takedowns([key])
    corrupt = media._record_path("published/bad.png")
    corrupt.write_text(contents)
    bad_local = write(tmp_path, "published/bad.png")
    result = await media.reconcile_publications(
        Session(), dry_run=dry_run, grace_hours=24
    )
    assert result == {
        "orphans": 2,
        "eligible": 1 + int(dry_run),
        "deleted": int(not dry_run),
        "failed": 1,
    }
    assert local.exists() == dry_run
    assert bad_local.exists()
    assert corrupt.read_text() == contents
    assert str(corrupt) in caplog.text


@pytest.mark.asyncio
async def test_publish_returns_success_when_post_commit_cleanup_fails(
    storage, monkeypatch, caplog
):
    from src.admin import exercise_image_service as service

    retired = "published/retired.png"
    exercise = SimpleNamespace(
        id=1, images_url=json.dumps([retired]), reference_images_url='["reference.png"]'
    )
    session = Session()
    session.refresh = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    response = object()
    session.execute = AsyncMock(return_value=Mock(scalars=lambda: Mock(all=lambda: [])))

    async def fail_cleanup(*args, **kwargs):
        session.commit.assert_awaited_once()
        assert media._record_path(retired).exists()
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(service, "mirror_published_images", Mock())
    monkeypatch.setattr(service, "process_takedowns", fail_cleanup)
    monkeypatch.setattr(
        service, "build_image_options_response", AsyncMock(return_value=response)
    )
    assert (
        await service.apply_reference_or_option(
            session, exercise, option_key=None, use_reference=True
        )
        is response
    )
    assert exercise.images_url == '["reference.png"]'
    session.rollback.assert_awaited_once()
    assert media._record_path(retired).exists()
    assert "deferring to reconciliation" in caplog.text


@pytest.mark.asyncio
async def test_reconcile_skips_invalid_local_and_storage_keys(
    storage, tmp_path, caplog
):
    objects, client, purge = storage
    old = datetime.now(timezone.utc) - timedelta(days=2)
    invalid_local = "published/bad\\name.png"
    invalid_storage = "published/../outside.png"
    local = write(tmp_path, invalid_local)
    valid_local = write(tmp_path, "published/local-valid.png")
    objects.update({invalid_storage: old, "published/storage-valid.png": old})

    result = await media.reconcile_publications(
        Session(), dry_run=False, grace_hours=24
    )

    assert result == {"orphans": 2, "eligible": 2, "deleted": 2, "failed": 0}
    assert local.exists()
    assert not valid_local.exists()
    assert set(objects) == {invalid_storage}
    assert invalid_local in caplog.text
    assert invalid_storage in caplog.text
    assert caplog.records[0].levelname == "WARNING"
    assert {call.args[0] for call in client.delete.call_args_list} == {
        "published/local-valid.png",
        "published/storage-valid.png",
    }
