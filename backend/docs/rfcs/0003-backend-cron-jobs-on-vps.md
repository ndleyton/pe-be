# RFC 0003: Backend Cron Jobs on a VPS

- Status: Proposed
- Date: 2026-03-26
- Owners: Backend

## Summary

Now that the backend runs on a VPS, we need a reliable way to execute recurring backend jobs such as chat attachment cleanup, data sync, notifications, or future maintenance tasks.

This RFC recommends a two-part approach:

1. Keep job execution logic inside the backend codebase as explicit CLI entrypoints under `src`.
2. Trigger those entrypoints from an external scheduler on the VPS, with `systemd` timers as the preferred scheduler and host `cron` as the simpler fallback.

This RFC does **not** recommend running recurring jobs inside the FastAPI web process, and it does **not** recommend introducing Celery, Redis, or another queue system yet.

The first concrete job to standardize behind this pattern is the existing chat attachment cleanup flow in [`backend/src/chat/cleanup.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/chat/cleanup.py).

## Context

### Current repo constraints

The existing repo documentation and codebase establish a few clear constraints:

- The backend is a FastAPI application in `backend/`.
- Dependency management is done with `uv`.
- Production currently appears oriented around Docker and Docker Compose, with a single backend container in [`backend/Dockerfile`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/Dockerfile) and [`docker-compose.yml`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/docker-compose.yml).
- The backend already includes one operational cleanup entrypoint in [`backend/src/chat/cleanup.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/chat/cleanup.py).
- There is no existing scheduler framework in the app lifecycle. [`backend/src/main.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/main.py) does not define lifespan-managed background loops, startup schedulers, or worker processes.
- The repo already emphasizes UTC-first time handling in [`README.md`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/README.md), and that should carry through to job scheduling, logging, and execution semantics.
- The backend already exposes production-oriented configuration and observability patterns in [`backend/src/core/config.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/core/config.py) and [`backend/src/core/observability.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/core/observability.py).

### Existing recurring-job candidate

The strongest immediate candidate is stale chat attachment cleanup:

- [`backend/src/chat/service.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/chat/service.py) already implements `cleanup_orphaned_attachments(...)`.
- [`backend/src/chat/router.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/chat/router.py) currently invokes cleanup opportunistically during attachment uploads.
- [`backend/src/chat/cleanup.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/chat/cleanup.py) already exposes a small CLI-friendly wrapper.
- There are tests for this cleanup path in [`backend/tests/test_chat_cleanup.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/tests/test_chat_cleanup.py).

This is a good signal that the repo already wants some work to happen outside normal request handling.

### Operational change

Before the VPS move, recurring tasks may have been avoidable or tolerable as request-coupled cleanup. On a VPS, recurring operational work should be explicit:

- jobs should run even during low traffic periods
- job failures should be visible
- schedules should be managed predictably
- overlapping runs should be prevented
- deploys should not silently disable recurring work

That shifts the question from "can we run cleanup somewhere?" to "what is the smallest production-grade recurring-job architecture that fits this repo right now?"

## Goals

- Support recurring backend jobs on a single VPS with low operational complexity.
- Keep job logic in the backend repo, using the same configuration, DB access, and observability patterns as the API.
- Make jobs easy to run manually for debugging and easy to schedule automatically in production.
- Avoid coupling recurring execution to the FastAPI request lifecycle.
- Keep the first implementation simple enough to ship quickly.
- Leave a safe migration path for future scaling if the app later runs more than one backend instance.

## Non-Goals

- Introducing a full distributed task queue in this RFC
- Replacing synchronous request-time background work across the app
- Building user-configurable schedules in the product
- Solving high-volume event processing or long-running workflow orchestration
- Mandating Kubernetes, Nomad, or another orchestrator

## Decision

Use an **external VPS scheduler** to trigger **backend-owned CLI job entrypoints**.

The recommended production default is:

- `systemd` timer on the VPS
- one-shot command that runs a backend job entrypoint
- Postgres-backed overlap protection and idempotent job behavior

The recommended code pattern is:

- one module per recurring job under a new `src/jobs/` package
- each job creates its own DB session
- each job logs start, finish, duration, and outcome
- each job exits non-zero on failure
- each job acquires a DB advisory lock before doing work

The first standardized job should be a cleaned-up version of chat attachment cleanup.

## Why This Is The Best Fit

### 1. It matches the current architecture

This backend is a straightforward FastAPI + Postgres app. There is no Redis, no message broker, no worker fleet, and no app-internal scheduler.

Adding recurring work by running backend-owned CLI commands is compatible with:

- `uv` dependency management
- the current database/session setup
- existing config loading from `.env`
- existing logging and observability hooks

It adds the least new architecture.

### 2. It separates API uptime from job scheduling

Recurring work should not depend on the health of a specific FastAPI process or Uvicorn worker.

If scheduling lives inside the API process:

- restarts can skip schedules
- multiple app replicas can duplicate work
- deploy timing can affect run frequency
- scheduler state becomes coupled to web serving

An external scheduler avoids these failure modes.

### 3. It is operationally appropriate for a VPS

On a VPS, the host already gives us mature scheduling primitives.

`systemd` timers provide:

- startup ordering
- restart semantics
- persistent missed-run behavior if desired
- centralized logs via `journalctl`
- explicit status inspection

Host `cron` also works, but it is weaker on observability and service management.

### 4. It preserves a future migration path

If the app later needs a queue system, the job logic can stay mostly intact.

The backend-owned job modules can later be invoked by:

- Celery workers
- a dedicated scheduler container
- GitHub Actions or another external runner
- Kubernetes CronJobs

The scheduler can change without rewriting the domain work itself.

## Options Considered

### Option A: Run recurring jobs inside FastAPI on startup or lifespan

Description:

- start an in-process scheduler when the app boots
- run recurring loops with asyncio tasks or APScheduler inside the API container

Pros:

- minimal host setup
- all logic stays "inside the app"
- easy local experimentation

Cons:

- duplicates work if multiple API instances run
- jobs stop when the API process restarts
- deploy cadence changes schedule behavior
- app-serving concerns and scheduler concerns become entangled
- harder to observe and operate cleanly

Decision:

- rejected

Reason:

- this is fragile on a VPS and becomes worse if the app ever scales beyond one process

### Option B: Use host `cron` to run backend commands

Description:

- add crontab entries on the VPS that invoke backend job commands

Pros:

- simple
- already available on most VPS images
- minimal new dependencies

Cons:

- weaker logs and status visibility
- weaker missed-run behavior
- more brittle environment loading unless carefully wrapped
- less explicit service ownership than `systemd`

Decision:

- accepted as fallback, not as the primary recommendation

Reason:

- workable for simple installs, but `systemd` timers are the better production default on a managed VPS

### Option C: Use `systemd` timers to run backend commands

Description:

- define a `*.service` for each recurring job
- define a matching `*.timer` for the schedule

Pros:

- robust host-native scheduling
- good logs via `journalctl`
- explicit status and failure inspection
- can express dependencies on Docker, network, and env files
- persistent timers can catch missed runs after downtime

Cons:

- some extra VPS setup
- not portable to every environment in exactly the same way

Decision:

- accepted and recommended

Reason:

- best balance of reliability, simplicity, and operational clarity for the current deployment model

### Option D: Add APScheduler as an app or sidecar scheduler

Description:

- use APScheduler from Python to manage schedules

Pros:

- flexible scheduling syntax
- Python-native schedules
- can persist schedule metadata if expanded later

Cons:

- introduces a scheduler framework we do not currently need
- still requires careful deployment topology choices
- easier to misuse by embedding in the API process
- duplicates capabilities the VPS already provides

Decision:

- rejected for now

Reason:

- this adds framework complexity without solving a problem the host scheduler cannot already solve

### Option E: Add Celery plus Redis or another broker

Description:

- use a worker queue and scheduler such as Celery beat

Pros:

- strong long-term fit for high-volume async jobs
- retry control
- delayed tasks
- better fan-out and workload isolation

Cons:

- introduces Redis or another broker
- adds deployment, monitoring, and failure-mode complexity
- much more infrastructure than the current backend needs

Decision:

- deferred

Reason:

- too heavy for the current stage and the current problem

### Option F: Use Postgres-native scheduling such as `pg_cron`

Description:

- schedule jobs from the database itself

Pros:

- central scheduling location
- strong fit for pure SQL maintenance

Cons:

- many backend jobs are Python/domain-logic jobs, not just SQL
- requires DB extension support and DB-level operational ownership
- pushes application concerns into the database layer

Decision:

- rejected for general backend jobs

Reason:

- useful only for a narrower class of tasks than this backend is likely to need

## Detailed Design

### 1. Job layout inside the backend

Create a first-class jobs package:

- `backend/src/jobs/__init__.py`
- `backend/src/jobs/chat_attachment_cleanup.py`
- future jobs such as `backend/src/jobs/import_sync.py`, `backend/src/jobs/digest_emails.py`, or `backend/src/jobs/maintenance_*.py`

Each job module should expose:

- an async `run()` function containing the actual work
- a synchronous `main()` that wraps `asyncio.run(...)`

That matches the current pattern already used by [`backend/src/chat/cleanup.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/chat/cleanup.py).

### 2. Standard job contract

Each recurring job should follow these rules:

1. Load configuration the same way the app does.
2. Open its own async DB session with `async_session_maker`.
3. Acquire a Postgres advisory lock before doing work.
4. Log start, finish, duration, and key counters.
5. Return zero on success and non-zero on failure.
6. Be safe to run more than once.

That means jobs should be:

- idempotent when possible
- overlap-safe
- explicit about batch sizes and limits

### 3. Overlap protection

Even on one VPS, overlap protection should be part of the design now.

Reasons:

- a timer may fire again before a prior run completes
- a human may manually trigger a job while the schedule also fires
- the app may later be deployed on more than one machine

Recommended mechanism:

- use Postgres advisory locks keyed per job name

Why advisory locks:

- no extra infrastructure
- natural fit because Postgres already exists
- protect against concurrent runs across processes and hosts sharing the same DB

If the lock is already held:

- log a structured "skipped due to active run" message
- exit successfully

That behavior is usually better than failing the timer for expected overlap prevention.

### 4. Scheduling layer

#### Preferred: `systemd` timer

Each scheduled job gets:

- `pe-be-chat-attachment-cleanup.service`
- `pe-be-chat-attachment-cleanup.timer`

The service should:

- run as the deployment user
- `cd` into the backend working directory or compose project directory
- load the same production env file used by the app
- execute the job command

Recommended command shape if the backend runs directly on the host:

```bash
cd /srv/pe-be/backend && /usr/local/bin/uv run python -m src.jobs.chat_attachment_cleanup
```

Recommended command shape if the backend runs via Docker Compose:

```bash
cd /srv/pe-be && /usr/bin/docker compose exec -T backend python -m src.jobs.chat_attachment_cleanup
```

For stricter isolation, a one-shot ephemeral container is often better than `exec`:

```bash
cd /srv/pe-be && /usr/bin/docker compose run --rm backend python -m src.jobs.chat_attachment_cleanup
```

Tradeoff:

- `exec` is faster and reuses the running container
- `run --rm` is cleaner and less coupled to the health of the long-lived API container

For production, prefer `docker compose run --rm` unless startup latency is a real issue.

#### Fallback: host `cron`

If `systemd` timers are not available, a crontab entry can invoke the same command.

That fallback is acceptable if:

- stdout/stderr are redirected to logs
- environment loading is explicit
- advisory locking is implemented in the job

### 5. Configuration

Add a small recurring-jobs configuration section to [`backend/.env.example`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/.env.example) and [`backend/src/core/config.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/core/config.py).

Recommended fields:

- `JOBS_TIMEZONE=UTC`
- `JOB_CHAT_ATTACHMENT_CLEANUP_ENABLED=true`
- `JOB_CHAT_ATTACHMENT_CLEANUP_SCHEDULE=hourly`
- `JOB_CHAT_ATTACHMENT_CLEANUP_BATCH_SIZE=25`
- `JOB_CHAT_ATTACHMENT_CLEANUP_LOCK_KEY=...` or derive lock key from job name in code

Important rule:

- actual scheduler cadence lives in VPS config
- backend config controls job behavior, not host scheduler semantics

We should avoid pretending the application owns the cron schedule if the host actually does.

### 6. Logging and observability

Jobs should emit structured logs consistent with the rest of the backend:

- `job_name`
- `started_at`
- `finished_at`
- `duration_ms`
- `status`
- relevant counters such as `deleted_count`

If OpenTelemetry is enabled, jobs should also initialize observability so timer-driven work appears alongside request traces where practical.

This matters because recurring jobs will affect:

- disk usage
- database churn
- attachment lifecycle correctness
- future user-visible asynchronous behaviors

### 7. Time handling

Because the repo already uses a UTC-first strategy, recurring jobs should follow the same rule:

- store and compare timestamps in UTC
- log UTC timestamps
- define schedules in UTC unless a product requirement explicitly demands another business timezone

If a future job must run at a user-facing local business time, convert deliberately and document it rather than letting the VPS default timezone decide implicitly.

### 8. First job to implement

Standardize chat attachment cleanup first.

Recommended changes:

1. Move or mirror the current [`backend/src/chat/cleanup.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/chat/cleanup.py) entrypoint under `src/jobs/chat_attachment_cleanup.py`.
2. Add advisory-lock protection around the cleanup run.
3. Add structured logging around deleted-count and duration.
4. Keep the opportunistic cleanup call in [`backend/src/chat/router.py`](/Users/ndleyton/.codex/worktrees/6b15/pe-be/backend/src/chat/router.py) for now only if it remains cheap.
5. After the scheduled job is proven in production, consider removing request-path cleanup so upload latency is not coupled to maintenance work.

That gives us one real job implemented under the new pattern before we generalize further.

## Example `systemd` Units

Illustrative service unit:

```ini
[Unit]
Description=PE Backend chat attachment cleanup
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/srv/pe-be
User=pebe
Group=pebe
ExecStart=/usr/bin/docker compose run --rm backend python -m src.jobs.chat_attachment_cleanup
```

Illustrative timer unit:

```ini
[Unit]
Description=Run PE Backend chat attachment cleanup hourly

[Timer]
OnCalendar=hourly
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

Notes:

- `Persistent=true` helps catch up if the VPS was down during a scheduled window.
- `RandomizedDelaySec` reduces synchronized spikes if more jobs are added later.
- If startup cost from `docker compose run --rm` is too high, swap to `docker compose exec -T backend ...`.

## Implementation Plan

### Phase 1: Standardize the pattern

1. Create `src/jobs/`.
2. Move the current cleanup entrypoint into that package.
3. Add a small shared helper for advisory locking and job logging.
4. Keep the command manually runnable:
   `cd backend && uv run python -m src.jobs.chat_attachment_cleanup`

### Phase 2: Deploy the first scheduled job

1. Add VPS `systemd` unit files.
2. Enable the timer.
3. Verify logs and manual execution.
4. Confirm skipped-overlap behavior works.

### Phase 3: Remove request-coupled maintenance where appropriate

1. Measure the cost of upload-path cleanup.
2. If the scheduled job is reliable, stop doing routine maintenance on request paths unless it is needed for correctness.

### Phase 4: Expand carefully

Only add more recurring jobs when there is a concrete operational need, for example:

- cleanup tasks
- sync/import jobs
- notification batching
- materialized cache refreshes

Avoid turning cron into a substitute for a proper event-driven workflow when near-real-time processing is actually required.

## Risks

### 1. Scheduler drift between environments

If local, staging, and production use different scheduler mechanisms, behavior can diverge.

Mitigation:

- keep job logic in Python
- keep schedule definitions documented in ops docs
- use the same manual command everywhere

### 2. Duplicate job runs

This can happen from operator action, overlapping timers, or future multi-instance deployment.

Mitigation:

- Postgres advisory locks
- idempotent job design

### 3. Silent failures

Cron-style systems often fail quietly if logging is weak.

Mitigation:

- non-zero exit codes
- `systemd`/journal logging
- optional alerting later if a job repeatedly fails

### 4. Request-path and timer-path duplication

If the same maintenance logic runs both on request and on schedule, it can add noise or wasted work.

Mitigation:

- keep request-path maintenance only where it materially improves correctness
- otherwise shift recurring cleanup fully to scheduled execution

## Consequences

### Positive

- small and production-appropriate recurring-job system
- no new broker or worker infrastructure
- explicit, testable backend job entrypoints
- safer path to future scaling than in-app scheduling

### Negative

- requires some VPS-level operational setup
- schedules are managed outside the application code
- long-running or high-volume async work may still require a queue in the future

## Open Questions

1. Will production continue to run the backend through Docker Compose on the VPS, or directly via a host virtualenv?
2. Do we want the first job to run hourly or more frequently?
3. Should request-path chat cleanup remain as a temporary guardrail, or be removed immediately once the timer is live?
4. Do we want a small internal `job_runs` audit table later, or are `systemd` logs enough for now?

## Final Recommendation

Adopt **backend-owned CLI jobs plus VPS `systemd` timers** as the standard recurring-job pattern.

Specifically:

- do not run cron-like work inside the FastAPI process
- do not add Celery/Redis yet
- standardize chat attachment cleanup as the first scheduled backend job
- protect each job with Postgres advisory locking
- run schedules in UTC and log them clearly

This is the best solution for the current backend because it is reliable on a VPS, consistent with the repo’s architecture, and cheap to evolve later.
