import hashlib
import threading
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.admin import exercise_image_service as service
from src.core.config import settings


@pytest.mark.asyncio
@pytest.mark.parametrize("stored_digest", [False, True])
@pytest.mark.parametrize("current_kind", ["digest", "legacy", "different"])
async def test_option_currency_uses_digest_or_reads_off_event_loop(
    monkeypatch, tmp_path, stored_digest, current_kind
):
    monkeypatch.setattr(settings, "EXERCISE_IMAGE_STORAGE_DIR", str(tmp_path))
    data = b"candidate image"
    digest = hashlib.sha256(data).hexdigest()
    source = tmp_path / "generated/candidate.png"
    source.parent.mkdir()
    source.write_bytes(data)
    option = service._option_specs()[0]
    candidate = SimpleNamespace(
        id=1,
        option_key=option.key,
        pipeline_key=option.pipeline_key,
        source_image_index=0,
        generation_key="generation",
        storage_path="generated/candidate.png",
        source_image_url="reference.png",
        sha256=digest if stored_digest else None,
    )
    current = service._published_storage_path_for_candidate(
        1, option.key, 0, "generation",
        content_digest=None if current_kind == "legacy" else (
            digest if current_kind == "digest" else "0" * 64
        ),
    )
    event_loop_thread = threading.get_ident()
    original_read = Path.read_bytes
    reads = []

    def read_bytes(path):
        assert not stored_digest, "stored digest should avoid reading candidate bytes"
        assert threading.get_ident() != event_loop_thread
        reads.append(path)
        return original_read(path)

    monkeypatch.setattr(Path, "read_bytes", read_bytes)
    options = await service._candidate_groups(
        exercise_type_id=1,
        candidates=[candidate],
        current_images=[current],
        reference_images=["reference.png"],
    )
    assert len(options) == 1
    assert options[0].is_current == (current_kind != "different")
    assert len(reads) == int(not stored_digest)
