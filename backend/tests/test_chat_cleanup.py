import pytest

from src.chat import cleanup
from src.jobs.shared import JobRunResult


@pytest.mark.asyncio(loop_scope="session")
async def test_legacy_cleanup_wrapper_returns_deleted_count(monkeypatch):
    async def _fake_run():
        return JobRunResult(
            job_name="chat_attachment_cleanup",
            status="success",
            metrics={"deleted_count": 7},
        )

    monkeypatch.setattr(cleanup, "run", _fake_run)

    assert await cleanup._run_cleanup() == 7


def test_cleanup_main_prints_deleted_count(monkeypatch, capsys):
    def _fake_run(coro):
        coro.close()
        return 3

    monkeypatch.setattr(cleanup.asyncio, "run", _fake_run)

    cleanup.main()

    captured = capsys.readouterr()
    assert captured.out.strip() == "Deleted 3 stale orphaned chat attachments."
