from __future__ import annotations

from contextlib import nullcontext

import json

import pytest

from src.core import object_storage
from src.core.object_storage import PUBLIC_MEDIA_CACHE_CONTROL, ObjectStorage
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
    assert stored["CacheControl"] == PUBLIC_MEDIA_CACHE_CONTROL


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


@pytest.mark.asyncio
async def test_generated_republish_uses_new_key_for_changed_bytes(
    monkeypatch, tmp_path
):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from src.admin import exercise_image_service as service

    monkeypatch.setattr(
        "src.core.config.settings.EXERCISE_IMAGE_STORAGE_DIR", str(tmp_path)
    )
    monkeypatch.setattr("src.core.config.settings.MEDIA_STORAGE_BACKEND", "local")
    candidate = SimpleNamespace(
        id=1,
        option_key="front",
        source_image_index=0,
        generation_key="same-inputs",
        sha256=None,
        pipeline_key=service.REFERENCE_PIPELINE_KEY,
        storage_path="generated/source.png",
        status="active",
    )
    exercise = SimpleNamespace(
        id=1, images_url=None, reference_images_url='["reference.png"]'
    )
    session = SimpleNamespace(
        commit=AsyncMock(),
        refresh=AsyncMock(),
        execute=AsyncMock(return_value=[]),
        no_autoflush=nullcontext(),
    )
    monkeypatch.setattr(
        service, "_load_candidates", AsyncMock(return_value=[candidate])
    )
    monkeypatch.setattr(service, "build_image_options_response", AsyncMock())
    _write(tmp_path, candidate.storage_path, b"first image")

    await service.apply_reference_or_option(
        session, exercise, option_key="front", use_reference=False
    )
    first_path = json.loads(exercise.images_url)[0]
    assert await service._published_option_images(1, [candidate]) == [
        resolve_exercise_image_url(first_path)
    ]

    # Regeneration keeps its input key but produces different bytes.
    _write(tmp_path, candidate.storage_path, b"regenerated image")
    await service.apply_reference_or_option(
        session, exercise, option_key="front", use_reference=False
    )
    second_path = json.loads(exercise.images_url)[0]
    assert second_path != first_path
    assert not (tmp_path / first_path).exists()
    assert (tmp_path / second_path).read_bytes() == b"regenerated image"

    await service.apply_reference_or_option(
        session, exercise, option_key="front", use_reference=False
    )
    assert json.loads(exercise.images_url) == [second_path]


def test_generated_legacy_publication_path_remains_supported():
    from src.admin.exercise_image_service import _published_storage_path_for_candidate

    assert (
        _published_storage_path_for_candidate(1, "front", 0, "key")
        == "published/exercise-type-1/front/0-key.png"
    )


@pytest.mark.asyncio
async def test_partial_r2_publish_failure_cleans_only_new_publications(
    fake_r2, monkeypatch, tmp_path
):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from src.admin import exercise_image_service as service

    candidates = []
    published_paths = []
    for index in range(3):
        image_bytes = f"image-{index}".encode()
        candidate = SimpleNamespace(
            id=index + 1,
            option_key="front",
            source_image_index=index,
            generation_key=f"key-{index}",
            pipeline_key=service.REFERENCE_PIPELINE_KEY,
            storage_path=f"generated/source-{index}.png",
            status="active",
        )
        candidates.append(candidate)
        _write(tmp_path, candidate.storage_path, image_bytes)
        published_paths.append(
            service._published_storage_path_for_candidate(
                1, "front", index, candidate.generation_key, image_bytes
            )
        )

    existing_path = published_paths[0]
    _write(tmp_path, existing_path, b"image-0")
    mirror_published_images([existing_path])
    existing_objects = dict(fake_r2.objects)
    previous_images_url = json.dumps([existing_path])
    exercise = SimpleNamespace(
        id=1,
        images_url=previous_images_url,
        reference_images_url=json.dumps([f"reference-{i}.png" for i in range(3)]),
    )
    session = SimpleNamespace(
        commit=AsyncMock(),
        refresh=AsyncMock(),
        execute=AsyncMock(return_value=[]),
        no_autoflush=nullcontext(),
    )
    monkeypatch.setattr(service, "_load_candidates", AsyncMock(return_value=candidates))
    response = AsyncMock()
    monkeypatch.setattr(service, "build_image_options_response", response)

    original_put = fake_r2.put_object
    put_keys = []

    def failing_put(**kwargs):
        put_keys.append(kwargs["Key"])
        original_put(**kwargs)
        # A write can land even when its response fails.
        if kwargs["Key"] == published_paths[2]:
            raise RuntimeError("simulated R2 PUT failure")

    monkeypatch.setattr(fake_r2, "put_object", failing_put)

    with pytest.raises(RuntimeError, match="simulated R2 PUT failure"):
        await service.apply_reference_or_option(
            session, exercise, option_key="front", use_reference=False
        )

    assert put_keys == published_paths
    assert (tmp_path / existing_path).read_bytes() == b"image-0"
    assert all(not (tmp_path / path).exists() for path in published_paths[1:])
    assert fake_r2.objects == existing_objects
    assert all(
        (tmp_path / candidate.storage_path).is_file() for candidate in candidates
    )
    assert exercise.images_url == previous_images_url
    session.commit.assert_not_awaited()
    assert session.refresh.await_count == 1
    response.assert_not_awaited()
