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
        1,
        option.key,
        0,
        "generation",
        content_digest=None
        if current_kind == "legacy"
        else (digest if current_kind == "digest" else "0" * 64),
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


@pytest.mark.asyncio
@pytest.mark.parametrize("phase", [False, True])
@pytest.mark.parametrize("existing", [False, True])
async def test_generation_keeps_digest_in_sync_with_written_bytes(
    monkeypatch, tmp_path, phase, existing
):
    from unittest.mock import AsyncMock, Mock

    monkeypatch.setattr(settings, "EXERCISE_IMAGE_STORAGE_DIR", str(tmp_path))
    exercise = SimpleNamespace(
        id=1,
        name="Test",
        description="",
        instructions="",
        equipment="",
        category="",
        exercise_muscles=[],
        images_url=None,
        reference_images_url=None if phase else '["reference.png"]',
    )
    option = service.REFERENCE_OPTION_SPECS[0]
    sources = service.PHASE_FALLBACK_IMAGES if phase else [(0, "reference.png", "")]
    candidates = []
    for index, source, _ in sources:
        generation_key = service._build_generation_key(
            exercise_type_id=1,
            source_image_url=source,
            source_image_index=index,
            option_key=service.PHASE_FALLBACK_OPTION_KEY if phase else option.key,
            pipeline_key=service.PHASE_FALLBACK_PIPELINE_KEY
            if phase
            else service.REFERENCE_PIPELINE_KEY,
            prompt_version=service.PHASE_FALLBACK_PROMPT_VERSION
            if phase
            else service.REFERENCE_PROMPT_VERSION,
            model_name=service.exercise_type_phase_model()
            if phase
            else service.exercise_type_reference_model(),
        )
        candidates.append(
            SimpleNamespace(
                generation_key=generation_key,
                storage_path=service._storage_path_for_candidate(
                    1,
                    service.PHASE_FALLBACK_OPTION_KEY if phase else option.key,
                    index,
                    generation_key,
                ),
                sha256="stale digest",
            )
        )
    if existing and phase:
        # One missing phase regenerates the pair, overwriting the surviving phase.
        surviving = tmp_path / candidates[1].storage_path
        surviving.parent.mkdir(parents=True)
        surviving.write_bytes(b"old phase bytes")
    session = SimpleNamespace(
        execute=AsyncMock(),
        commit=AsyncMock(),
        refresh=AsyncMock(),
        add=Mock(),
    )
    monkeypatch.setattr(
        service,
        "_load_candidates_by_keys",
        AsyncMock(return_value=candidates if existing else []),
    )
    monkeypatch.setattr(service, "build_image_options_response", AsyncMock())
    result = SimpleNamespace(
        model="model", prompt_summary="prompt", mime_type="image/png"
    )
    monkeypatch.setattr(
        service, "generate_reference_image_variant", AsyncMock(return_value=result)
    )
    monkeypatch.setattr(
        service,
        "generate_exercise_phase_pair",
        AsyncMock(return_value=(result, result)),
    )
    data = b"regenerated bytes"
    monkeypatch.setattr(service, "decode_generated_image", lambda result: data)

    await service.generate_reference_image_options(
        session, exercise, option_key=None if phase else option.key
    )

    digest = hashlib.sha256(data).hexdigest()
    for candidate in candidates:
        assert (tmp_path / candidate.storage_path).read_bytes() == data
    if existing:
        assert all(candidate.sha256 == digest for candidate in candidates)
    elif phase:
        assert all(call.args[0].sha256 == digest for call in session.add.call_args_list)
        assert session.add.call_count == 2
    else:
        statement = session.execute.call_args.args[0]
        assert statement.compile().params["sha256_m0"] == digest
        assert "sha256 = excluded.sha256" in str(statement)
