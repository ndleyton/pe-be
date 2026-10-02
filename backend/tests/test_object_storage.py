from __future__ import annotations

import pytest

from src.core import object_storage
from src.core.object_storage import PUBLIC_IMMUTABLE_CACHE_CONTROL, ObjectStorage
from src.exercises.image_assets import (
    mirror_published_images,
    resolve_exercise_image_url,
)
from src.jobs import backfill_public_media


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


@pytest.mark.asyncio
async def test_backfill_dry_run_counts_without_uploading(fake_r2, tmp_path):
    _write(tmp_path, "published/exercise-type-1/a/0-key.png")
    _write(tmp_path, "generated/exercise-type-1/a/0-key.png")

    result = await backfill_public_media.run(dry_run=True)

    assert (result.status, result.found, result.uploaded) == ("dry_run", 1, 0)
    assert fake_r2.objects == {}


@pytest.mark.asyncio
async def test_backfill_uploads_published_files(fake_r2, tmp_path):
    _write(tmp_path, "published/exercise-type-1/a/0-key.png")
    _write(tmp_path, "published/exercise-type-2/uploaded/5.webp")

    result = await backfill_public_media.run()

    assert (result.status, result.found, result.uploaded) == ("ok", 2, 2)
    assert set(fake_r2.objects) == {
        "pe-be-public/published/exercise-type-1/a/0-key.png",
        "pe-be-public/published/exercise-type-2/uploaded/5.webp",
    }


@pytest.mark.asyncio
async def test_backfill_disabled_without_r2(monkeypatch, tmp_path):
    monkeypatch.setattr("src.core.config.settings.MEDIA_STORAGE_BACKEND", "local")
    monkeypatch.setattr(
        "src.core.config.settings.EXERCISE_IMAGE_STORAGE_DIR", str(tmp_path)
    )
    _write(tmp_path, "published/x.png")

    result = await backfill_public_media.run()

    assert (result.status, result.found) == ("disabled", 1)


def test_backfill_main_prints_summary(monkeypatch, capsys):
    async def fake_run(*, dry_run: bool):
        return backfill_public_media.BackfillResult("dry_run", 3, 0)

    def fake_asyncio_run(coro):
        coro.close()
        return backfill_public_media.BackfillResult("dry_run", 3, 0)

    monkeypatch.setattr(backfill_public_media, "run", fake_run)
    monkeypatch.setattr(backfill_public_media.asyncio, "run", fake_asyncio_run)

    backfill_public_media.main(["--dry-run"])

    assert "status=dry_run found=3 uploaded=0" in capsys.readouterr().out
