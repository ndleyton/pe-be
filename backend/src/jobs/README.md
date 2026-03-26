# Backend Jobs

This package contains backend-owned CLI jobs that are intended to run outside the FastAPI request lifecycle.

The design follows [RFC 0003](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/docs/rfcs/0003-backend-cron-jobs-on-vps.md):

- job logic lives in the backend codebase
- scheduling is external to the API process
- jobs are safe against overlap through Postgres advisory locks
- jobs log start, finish, duration, and outcome in UTC

## Current Job

- [chat_attachment_cleanup.py](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/jobs/chat_attachment_cleanup.py)

Manual run:

```bash
cd backend
uv run python -m src.jobs.chat_attachment_cleanup
```

This job cleans up stale orphaned chat attachments by calling `ChatService.cleanup_orphaned_attachments(...)`.

Operator kill switch:

```bash
JOB_CHAT_ATTACHMENT_CLEANUP_ENABLED=false
```

When disabled, the job exits cleanly without doing work. This lets operators stop a broken scheduled job through environment config while leaving the VPS timer in place.

## Package Structure

- [shared.py](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/jobs/shared.py): common runtime helper for jobs
- [chat_attachment_cleanup.py](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/jobs/chat_attachment_cleanup.py): first standardized recurring job

## Job Contract

Each job in this package should follow the same pattern:

1. Expose an async `run()` function that returns a `JobRunResult`.
2. Expose a sync `main()` function that wraps `asyncio.run(...)`.
3. Delegate session lifecycle, advisory locking, and logging to `run_managed_job(...)`.
4. Keep the actual domain work in a small async callable that receives an `AsyncSession`.
5. Return a small metrics dictionary for logging and operator visibility.

## Shared Helper

`run_managed_job(...)` in [shared.py](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/jobs/shared.py) provides the standard runtime behavior:

- configures stable job lock keys from job names
- opens a dedicated DB session with `async_session_maker`
- attempts to acquire a Postgres advisory lock before work starts
- skips cleanly if another run already holds the lock
- logs `started`, `skipped`, `finished`, and `failed` states
- records UTC timestamps and total `duration_ms`
- releases the advisory lock when the run completes

## Logging

Jobs should emit structured log fields through the standard backend logger. The helper currently logs:

- `job_name`
- `status`
- `lock_key`
- `started_at`
- `finished_at`
- `duration_ms`
- any job-specific metrics such as `deleted_count`

The timestamps are emitted in UTC via `datetime.now(timezone.utc).isoformat()`.

## Overlap Protection

Recurring jobs must be safe to trigger from:

- a VPS `systemd` timer
- host `cron`
- a manual operator run

Because these triggers can overlap, the shared helper uses `pg_try_advisory_lock(...)` and `pg_advisory_unlock(...)` on the existing Postgres database connection.

If the lock cannot be acquired:

- the job does not run
- the run is logged as `skipped`
- the process exits successfully

That behavior prevents duplicate work without turning expected overlap into an operational failure.

## Adding a New Job

Use the existing cleanup job as the template.

Recommended shape:

```python
from __future__ import annotations

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from src.jobs.shared import JobRunResult, configure_job_runtime, run_managed_job


logger = logging.getLogger(__name__)
JOB_NAME = "example_job"


async def _job(session: AsyncSession) -> dict[str, int]:
    processed = 0
    return {"processed_count": processed}


async def run() -> JobRunResult:
    return await run_managed_job(
        job_name=JOB_NAME,
        job_callable=_job,
        job_logger=logger,
    )


def main() -> None:
    configure_job_runtime()
    asyncio.run(run())


if __name__ == "__main__":
    main()
```

Implementation guidelines:

- keep jobs idempotent where possible
- avoid importing scheduler-specific concerns into job code
- use one module per recurring job
- keep side effects explicit and metric-friendly
- add focused tests for both the job module and any shared job helper behavior

## Scheduling

This package does not own scheduling.

Per RFC 0003, jobs here are intended to be triggered by external VPS scheduling, with `systemd` timers as the preferred production mechanism and host `cron` as a fallback.
