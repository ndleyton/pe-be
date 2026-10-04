from __future__ import annotations

import json

import pytest

from src.core import object_storage
from src.core.object_storage import PUBLIC_IMMUTABLE_CACHE_CONTROL, ObjectStorage
from src.exercises.image_assets import (
    delete_published_images,
    mirror_published_images,
    resolve_exercise_image_url,
)
from src.jobs import backfill_public_media
from src.jobs.shared import JobRunResult


class FakeS3Client:
    def __init__(self) -> None:
        self.objects: dict[str, dict] = {}

    def put_object(self, *, Bucket, Key, Body, **extra):
        self.objects[f"{Bucket}/{Key}"] = {"body": Body, **extra}

    def delete_object(self, *, Bucket, Key):
        self.objects.pop(f"{Bucket}/{Key}", None)


@pytest.fixture
def fake_r2(monkeypatch, tmp_path):
    client = FakeS3Client()
    monkeypatch.setattr("src.core.config.settings.MEDIA_STORAGE_BACKEND", "r2")
    monkeypatch.setattr("src.core.config.settings.R2_PUBLIC_BUCKET", "pe-be-public")
    monkeypatch.setattr(
        "src.core.config.settings.EXERCISE_IMAGE_STORAGE_DIR", str(tmp_path)
    )
    monkeypatch.setattr(object_storage, "_r2_client", lambda: client)
    return client


def _write(tmp_path, relative_path: str, data: bytes = b"img") -> None:
    path = tmp_path / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def test_put_bytes_guesses_content_type_and_sets_cache_control():
    client = FakeS3Client()
    storage = ObjectStorage(bucket="b", client=client)

    storage.put_bytes("a/b.webp", b"x", cache_control="no-cache")

    stored = client.objects["b/a/b.webp"]
    assert stored["ContentType"] == "image/webp"
    assert stored["CacheControl"] == "no-cache"

    storage.delete("a/b.webp")
    assert client.objects == {}


def test_public_storage_disabled_by_default(monkeypatch):
    monkeypatch.setattr("src.core.config.settings.MEDIA_STORAGE_BACKEND", "local")
    assert object_storage.get_public_media_storage() is None
    assert mirror_published_images(["published/x.png"]) == 0


def test_r2_requires_public_bucket(monkeypatch):
    monkeypatch.setattr("src.core.config.settings.MEDIA_STORAGE_BACKEND", "r2")
    monkeypatch.setattr("src.core.config.settings.R2_PUBLIC_BUCKET", "")
    with pytest.raises(RuntimeError, match="R2_PUBLIC_BUCKET"):
        object_storage.get_public_media_storage()


def test_mirror_uploads_only_published_paths(fake_r2, tmp_path):
    _write(tmp_path, "published/exercise-type-1/a/0-key.png", b"png")
    _write(tmp_path, "uploads/private.png")

    mirrored = mirror_published_images(
        ["published/exercise-type-1/a/0-key.png", "uploads/private.png"]
    )

    assert mirrored == 1
    stored = fake_r2.objects["pe-be-public/published/exercise-type-1/a/0-key.png"]
    assert stored["body"] == b"png"
    assert stored["ContentType"] == "image/png"
    assert stored["CacheControl"] == PUBLIC_IMMUTABLE_CACHE_CONTROL


def test_resolve_published_url_uses_cdn_only_when_configured(monkeypatch):
    monkeypatch.setattr("src.core.config.settings.MEDIA_PUBLIC_BASE_URL", "")
    assert resolve_exercise_image_url("published/x.png").endswith(
        "/exercises/assets/published/x.png"
    )

    monkeypatch.setattr(
        "src.core.config.settings.MEDIA_PUBLIC_BASE_URL",
        "https://media.example.com/",
    )
    assert (
        resolve_exercise_image_url("published/x.png")
        == "https://media.example.com/published/x.png"
    )
    assert resolve_exercise_image_url("uploads/x.png").endswith(
        "/exercises/assets/uploads/x.png"
    )


class FakeSession:
    def __init__(self, images_urls):
        self._rows = [(value,) for value in images_urls]

    async def execute(self, statement):
        return self._rows


def test_delete_published_images_removes_local_and_r2(fake_r2, tmp_path):
    _write(tmp_path, "published/a.png")
    mirror_published_images(["published/a.png"])

    delete_published_images(["published/a.png", "uploads/keep.png"])

    assert not (tmp_path / "published/a.png").exists()
    assert fake_r2.objects == {}


@pytest.mark.asyncio
async def test_referenced_paths_skip_unreferenced_and_missing_files(fake_r2, tmp_path):
    _write(tmp_path, "published/exercise-type-1/a/0-key.png")
    _write(tmp_path, "published/exercise-type-1/a/orphan.png")
    session = FakeSession(
        [
            json.dumps(
                [
                    "published/exercise-type-1/a/0-key.png",
                    "published/exercise-type-1/a/missing.png",
                    "uploads/private.png",
                ]
            ),
            json.dumps(["https://legacy.example.com/x.png"]),
        ]
    )

    paths = await backfill_public_media.referenced_published_paths(session)

    assert paths == ["published/exercise-type-1/a/0-key.png"]


@pytest.mark.asyncio
async def test_backfill_job_dry_run_does_not_upload(fake_r2, tmp_path):
    _write(tmp_path, "published/x.png")
    session = FakeSession([json.dumps(["published/x.png"])])

    metrics = await backfill_public_media._backfill_job(session, dry_run=True)

    assert metrics == {"found": 1, "uploaded": 0}
    assert fake_r2.objects == {}


@pytest.mark.asyncio
async def test_backfill_job_uploads_referenced_files(fake_r2, tmp_path):
    _write(tmp_path, "published/x.png")
    _write(tmp_path, "published/orphan.png")
    session = FakeSession([json.dumps(["published/x.png"])])

    metrics = await backfill_public_media._backfill_job(session, dry_run=False)

    assert metrics == {"found": 1, "uploaded": 1}
    assert set(fake_r2.objects) == {"pe-be-public/published/x.png"}


@pytest.mark.asyncio
async def test_backfill_disabled_without_r2(monkeypatch):
    monkeypatch.setattr("src.core.config.settings.MEDIA_STORAGE_BACKEND", "local")

    result = await backfill_public_media.run()

    assert result.status == "disabled"


def test_backfill_main_prints_summary(monkeypatch, capsys):
    result = JobRunResult(
        job_name="backfill_public_media",
        status="success",
        metrics={"found": 3, "uploaded": 0},
    )

    def fake_asyncio_run(coro):
        coro.close()
        return result

    monkeypatch.setattr(backfill_public_media, "configure_job_runtime", lambda: None)
    monkeypatch.setattr(backfill_public_media.asyncio, "run", fake_asyncio_run)

    backfill_public_media.main(["--dry-run"])

    assert "(dry run): found=3 uploaded=0" in capsys.readouterr().out
