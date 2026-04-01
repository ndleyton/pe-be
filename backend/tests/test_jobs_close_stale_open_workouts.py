from types import SimpleNamespace

import pytest

from src.jobs import close_stale_open_workouts
from src.jobs.shared import JobRunResult


@pytest.mark.asyncio(loop_scope="session")
async def test_close_stale_open_workouts_run_delegates_to_managed_runner(monkeypatch):
    async def _fake_close(session, *, max_age_hours):
        assert session == "session"
        assert max_age_hours == 24
        return 4

    async def _fake_run_managed_job(*, job_name, job_callable, job_logger):
        assert job_name == close_stale_open_workouts.JOB_NAME
        assert job_logger is close_stale_open_workouts.logger
        metrics = await job_callable("session")
        assert metrics == {"closed_count": 4, "max_age_hours": 24}
        return JobRunResult(job_name=job_name, status="success", metrics=metrics)

    monkeypatch.setattr(
        close_stale_open_workouts.settings,
        "JOB_CLOSE_STALE_OPEN_WORKOUTS_MAX_AGE_HOURS",
        24,
        raising=False,
    )
    monkeypatch.setattr(
        close_stale_open_workouts,
        "WorkoutService",
        SimpleNamespace(close_stale_open_workouts=_fake_close),
    )
    monkeypatch.setattr(
        close_stale_open_workouts,
        "run_managed_job",
        _fake_run_managed_job,
    )

    result = await close_stale_open_workouts.run()

    assert result.status == "success"
    assert result.metrics["closed_count"] == 4
    assert result.metrics["max_age_hours"] == 24


@pytest.mark.asyncio(loop_scope="session")
async def test_close_stale_open_workouts_run_returns_disabled_when_config_flag_is_false(
    monkeypatch,
):
    async def _unexpected_run_managed_job(**kwargs):
        raise AssertionError("managed job runner should not be called when disabled")

    monkeypatch.setattr(
        close_stale_open_workouts.settings,
        "JOB_CLOSE_STALE_OPEN_WORKOUTS_ENABLED",
        False,
        raising=False,
    )
    monkeypatch.setattr(
        close_stale_open_workouts,
        "run_managed_job",
        _unexpected_run_managed_job,
    )

    result = await close_stale_open_workouts.run()

    assert result.status == "disabled"
    assert result.metrics == {}


def test_close_stale_open_workouts_main_prints_skipped_message(monkeypatch, capsys):
    def _fake_configure_job_runtime():
        return None

    def _fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name=close_stale_open_workouts.JOB_NAME,
            status="skipped",
            metrics={},
        )

    monkeypatch.setattr(
        close_stale_open_workouts,
        "configure_job_runtime",
        _fake_configure_job_runtime,
    )
    monkeypatch.setattr(close_stale_open_workouts.asyncio, "run", _fake_run)

    close_stale_open_workouts.main()

    captured = capsys.readouterr()
    assert (
        captured.out.strip()
        == "Skipped stale open workout auto-close; another run is active."
    )


def test_close_stale_open_workouts_main_prints_disabled_message(monkeypatch, capsys):
    def _fake_configure_job_runtime():
        return None

    def _fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name=close_stale_open_workouts.JOB_NAME,
            status="disabled",
            metrics={},
        )

    monkeypatch.setattr(
        close_stale_open_workouts,
        "configure_job_runtime",
        _fake_configure_job_runtime,
    )
    monkeypatch.setattr(close_stale_open_workouts.asyncio, "run", _fake_run)

    close_stale_open_workouts.main()

    captured = capsys.readouterr()
    assert captured.out.strip() == "Close stale open workouts job is disabled."


def test_close_stale_open_workouts_main_prints_closed_count(monkeypatch, capsys):
    def _fake_configure_job_runtime():
        return None

    def _fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name=close_stale_open_workouts.JOB_NAME,
            status="success",
            metrics={"closed_count": 2, "max_age_hours": 24},
        )

    monkeypatch.setattr(
        close_stale_open_workouts,
        "configure_job_runtime",
        _fake_configure_job_runtime,
    )
    monkeypatch.setattr(close_stale_open_workouts.asyncio, "run", _fake_run)

    close_stale_open_workouts.main()

    captured = capsys.readouterr()
    assert captured.out.strip() == "Closed 2 stale open workouts older than 24 hours."
