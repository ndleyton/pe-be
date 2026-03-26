from types import SimpleNamespace

import pytest

from src.jobs import chat_attachment_cleanup
from src.jobs.shared import JobRunResult


@pytest.mark.asyncio(loop_scope="session")
async def test_cleanup_job_run_delegates_to_managed_runner(monkeypatch):
    async def _fake_cleanup(session):
        assert session == "session"
        return 7

    async def _fake_run_managed_job(*, job_name, job_callable, job_logger):
        assert job_name == chat_attachment_cleanup.JOB_NAME
        assert job_logger is chat_attachment_cleanup.logger
        metrics = await job_callable("session")
        assert metrics == {"deleted_count": 7}
        return JobRunResult(job_name=job_name, status="success", metrics=metrics)

    monkeypatch.setattr(
        chat_attachment_cleanup,
        "ChatService",
        SimpleNamespace(cleanup_orphaned_attachments=_fake_cleanup),
    )
    monkeypatch.setattr(
        chat_attachment_cleanup,
        "run_managed_job",
        _fake_run_managed_job,
    )

    result = await chat_attachment_cleanup.run()

    assert result.status == "success"
    assert result.metrics["deleted_count"] == 7


@pytest.mark.asyncio(loop_scope="session")
async def test_cleanup_job_run_returns_disabled_when_config_flag_is_false(monkeypatch):
    async def _unexpected_run_managed_job(**kwargs):
        raise AssertionError("managed job runner should not be called when disabled")

    monkeypatch.setattr(
        chat_attachment_cleanup.settings,
        "JOB_CHAT_ATTACHMENT_CLEANUP_ENABLED",
        False,
        raising=False,
    )
    monkeypatch.setattr(
        chat_attachment_cleanup,
        "run_managed_job",
        _unexpected_run_managed_job,
    )

    result = await chat_attachment_cleanup.run()

    assert result.status == "disabled"
    assert result.metrics == {}


def test_cleanup_job_main_prints_skipped_message(monkeypatch, capsys):
    def _fake_configure_job_runtime():
        return None

    def _fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name=chat_attachment_cleanup.JOB_NAME,
            status="skipped",
            metrics={},
        )

    monkeypatch.setattr(
        chat_attachment_cleanup,
        "configure_job_runtime",
        _fake_configure_job_runtime,
    )
    monkeypatch.setattr(chat_attachment_cleanup.asyncio, "run", _fake_run)

    chat_attachment_cleanup.main()

    captured = capsys.readouterr()
    assert (
        captured.out.strip()
        == "Skipped stale orphaned chat attachment cleanup; another run is active."
    )


def test_cleanup_job_main_prints_disabled_message(monkeypatch, capsys):
    def _fake_configure_job_runtime():
        return None

    def _fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name=chat_attachment_cleanup.JOB_NAME,
            status="disabled",
            metrics={},
        )

    monkeypatch.setattr(
        chat_attachment_cleanup,
        "configure_job_runtime",
        _fake_configure_job_runtime,
    )
    monkeypatch.setattr(chat_attachment_cleanup.asyncio, "run", _fake_run)

    chat_attachment_cleanup.main()

    captured = capsys.readouterr()
    assert captured.out.strip() == "Chat attachment cleanup is disabled."
