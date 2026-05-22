import pytest
from src.jobs import exercise_image_cleanup
from src.jobs.shared import JobRunResult


@pytest.mark.asyncio(loop_scope="session")
async def test_cleanup_job_run_delegates_to_managed_runner(monkeypatch):
    async def _fake_cleanup(session):
        assert session == "session"
        return {"deleted_rows": 5, "orphaned_files": 2, "reclaimed_bytes": 1024}

    async def _fake_run_managed_job(*, job_name, job_callable, job_logger):
        assert job_name == exercise_image_cleanup.JOB_NAME
        assert job_logger is exercise_image_cleanup.logger
        metrics = await job_callable("session")
        assert metrics == {"deleted_rows": 5, "orphaned_files": 2, "reclaimed_bytes": 1024}
        return JobRunResult(job_name=job_name, status="success", metrics=metrics)

    monkeypatch.setattr(
        exercise_image_cleanup,
        "cleanup_exercise_image_candidates",
        _fake_cleanup,
    )
    monkeypatch.setattr(
        exercise_image_cleanup,
        "run_managed_job",
        _fake_run_managed_job,
    )

    result = await exercise_image_cleanup.run()

    assert result.status == "success"
    assert result.metrics["deleted_rows"] == 5
    assert result.metrics["orphaned_files"] == 2
    assert result.metrics["reclaimed_bytes"] == 1024


@pytest.mark.asyncio(loop_scope="session")
async def test_cleanup_job_run_returns_disabled_when_config_flag_is_false(monkeypatch):
    async def _unexpected_run_managed_job(**kwargs):
        raise AssertionError("managed job runner should not be called when disabled")

    monkeypatch.setattr(
        exercise_image_cleanup.settings,
        "JOB_EXERCISE_IMAGE_CLEANUP_ENABLED",
        False,
        raising=False,
    )
    monkeypatch.setattr(
        exercise_image_cleanup,
        "run_managed_job",
        _unexpected_run_managed_job,
    )

    result = await exercise_image_cleanup.run()

    assert result.status == "disabled"
    assert result.metrics == {}


def test_cleanup_job_main_prints_skipped_message(monkeypatch, capsys):
    def _fake_configure_job_runtime():
        return None

    def _fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name=exercise_image_cleanup.JOB_NAME,
            status="skipped",
            metrics={},
        )

    monkeypatch.setattr(
        exercise_image_cleanup,
        "configure_job_runtime",
        _fake_configure_job_runtime,
    )
    monkeypatch.setattr(exercise_image_cleanup.asyncio, "run", _fake_run)

    exercise_image_cleanup.main()

    captured = capsys.readouterr()
    assert (
        captured.out.strip()
        == "Skipped exercise image cleanup; another run is active."
    )


def test_cleanup_job_main_prints_disabled_message(monkeypatch, capsys):
    def _fake_configure_job_runtime():
        return None

    def _fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name=exercise_image_cleanup.JOB_NAME,
            status="disabled",
            metrics={},
        )

    monkeypatch.setattr(
        exercise_image_cleanup,
        "configure_job_runtime",
        _fake_configure_job_runtime,
    )
    monkeypatch.setattr(exercise_image_cleanup.asyncio, "run", _fake_run)

    exercise_image_cleanup.main()

    captured = capsys.readouterr()
    assert captured.out.strip() == "Exercise image cleanup is disabled."


def test_cleanup_job_main_prints_success_metrics(monkeypatch, capsys):
    def _fake_configure_job_runtime():
        return None

    def _fake_run(coro):
        coro.close()
        return JobRunResult(
            job_name=exercise_image_cleanup.JOB_NAME,
            status="success",
            metrics={"deleted_rows": 5, "orphaned_files": 2, "reclaimed_bytes": 1024},
        )

    monkeypatch.setattr(
        exercise_image_cleanup,
        "configure_job_runtime",
        _fake_configure_job_runtime,
    )
    monkeypatch.setattr(exercise_image_cleanup.asyncio, "run", _fake_run)

    exercise_image_cleanup.main()

    captured = capsys.readouterr()
    assert (
        captured.out.strip()
        == "Cleaned exercise images: deleted_rows=5 orphaned_files=2 reclaimed_bytes=1024"
    )
