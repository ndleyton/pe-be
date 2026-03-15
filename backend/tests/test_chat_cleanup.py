from types import SimpleNamespace

import pytest

from src.chat import cleanup


@pytest.mark.asyncio(loop_scope="session")
async def test_run_cleanup_uses_session_factory(monkeypatch):
    class FakeSessionContext:
        async def __aenter__(self):
            return "session"

        async def __aexit__(self, exc_type, exc, tb):
            return False

    async def _fake_cleanup(session):
        assert session == "session"
        return 7

    monkeypatch.setattr(cleanup, "async_session_maker", lambda: FakeSessionContext())
    monkeypatch.setattr(
        cleanup,
        "ChatService",
        SimpleNamespace(cleanup_orphaned_attachments=_fake_cleanup),
    )

    assert await cleanup._run_cleanup() == 7


def test_cleanup_main_prints_deleted_count(monkeypatch, capsys):
    def _fake_run(coro):
        coro.close()
        return 3

    monkeypatch.setattr(cleanup.asyncio, "run", _fake_run)

    cleanup.main()

    captured = capsys.readouterr()
    assert captured.out.strip() == "Deleted 3 stale orphaned chat attachments."
