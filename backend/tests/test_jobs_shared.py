import logging
from types import SimpleNamespace

import pytest

from src.jobs import shared


class FakeSessionContext:
    async def __aenter__(self):
        return "session"

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio(loop_scope="session")
async def test_run_managed_job_logs_success_and_releases_lock(monkeypatch, caplog):
    events: list[tuple[str, int]] = []

    async def _fake_try_acquire(session, *, lock_key):
        assert session == "session"
        events.append(("acquire", lock_key))
        return True

    async def _fake_release(session, *, lock_key):
        assert session == "session"
        events.append(("release", lock_key))
        return True

    async def _fake_job(session):
        assert session == "session"
        return {"deleted_count": 5}

    monkeypatch.setattr(shared, "ensure_model_registry_loaded", lambda: None)
    monkeypatch.setattr(shared, "async_session_maker", lambda: FakeSessionContext())
    monkeypatch.setattr(shared, "_try_acquire_advisory_lock", _fake_try_acquire)
    monkeypatch.setattr(shared, "_release_advisory_lock", _fake_release)

    caplog.set_level(logging.INFO)
    result = await shared.run_managed_job(
        job_name="chat_attachment_cleanup",
        job_callable=_fake_job,
    )

    assert result.status == "success"
    assert result.metrics == {"deleted_count": 5}
    assert events[0][0] == "acquire"
    assert events[1][0] == "release"
    assert "Job started" in caplog.text
    assert "Job finished" in caplog.text
    assert "deleted_count=5" in caplog.text


@pytest.mark.asyncio(loop_scope="session")
async def test_run_managed_job_skips_when_lock_is_held(monkeypatch, caplog):
    async def _fake_try_acquire(session, *, lock_key):
        assert session == "session"
        return False

    async def _unexpected_release(session, *, lock_key):
        raise AssertionError("release should not be called when acquire fails")

    async def _unexpected_job(session):
        raise AssertionError("job should not run when lock is held")

    monkeypatch.setattr(shared, "ensure_model_registry_loaded", lambda: None)
    monkeypatch.setattr(shared, "async_session_maker", lambda: FakeSessionContext())
    monkeypatch.setattr(shared, "_try_acquire_advisory_lock", _fake_try_acquire)
    monkeypatch.setattr(shared, "_release_advisory_lock", _unexpected_release)

    caplog.set_level(logging.INFO)
    result = await shared.run_managed_job(
        job_name="chat_attachment_cleanup",
        job_callable=_unexpected_job,
    )

    assert result.status == "skipped"
    assert result.metrics == {}
    assert "Job skipped" in caplog.text


@pytest.mark.asyncio(loop_scope="session")
async def test_run_managed_job_releases_lock_and_reraises_on_failure(
    monkeypatch, caplog
):
    events: list[tuple[str, int]] = []

    async def _fake_try_acquire(session, *, lock_key):
        assert session == "session"
        events.append(("acquire", lock_key))
        return True

    async def _fake_release(session, *, lock_key):
        assert session == "session"
        events.append(("release", lock_key))
        return True

    async def _failing_job(session):
        assert session == "session"
        raise RuntimeError("boom")

    monkeypatch.setattr(shared, "ensure_model_registry_loaded", lambda: None)
    monkeypatch.setattr(shared, "async_session_maker", lambda: FakeSessionContext())
    monkeypatch.setattr(shared, "_try_acquire_advisory_lock", _fake_try_acquire)
    monkeypatch.setattr(shared, "_release_advisory_lock", _fake_release)

    caplog.set_level(logging.INFO)

    with pytest.raises(RuntimeError, match="boom"):
        await shared.run_managed_job(
            job_name="chat_attachment_cleanup",
            job_callable=_failing_job,
        )

    assert events[0][0] == "acquire"
    assert events[1][0] == "release"
    assert "Job started" in caplog.text
    assert "Job failed" in caplog.text


def test_advisory_lock_key_for_job_is_stable():
    first = shared.advisory_lock_key_for_job("chat_attachment_cleanup")
    second = shared.advisory_lock_key_for_job("chat_attachment_cleanup")
    other = shared.advisory_lock_key_for_job("different_job")

    assert first == second
    assert first != other


def test_ensure_model_registry_loaded_imports_modules_once(monkeypatch):
    imported: list[str] = []

    def _fake_import_module(name: str):
        imported.append(name)
        return SimpleNamespace(__name__=name)

    monkeypatch.setattr(
        shared, "importlib", SimpleNamespace(import_module=_fake_import_module)
    )
    monkeypatch.setattr(shared, "_MODEL_REGISTRY_LOADED", False)

    shared.ensure_model_registry_loaded()
    shared.ensure_model_registry_loaded()

    assert imported == [
        "src.chat.models",
        "src.exercise_sets.models",
        "src.exercises.models",
        "src.routines.models",
        "src.users.models",
        "src.workouts.models",
    ]
