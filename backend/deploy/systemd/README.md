# Systemd Timer Deployment

This directory contains the first VPS scheduler assets for backend jobs.

Files:

- `pe-be-chat-attachment-cleanup.service`
- `pe-be-chat-attachment-cleanup.timer`
- `pe-be-close-stale-open-workouts.service`
- `pe-be-close-stale-open-workouts.timer`

These units are intended for a Docker Compose deployment rooted at `/srv/pe-be`.

## Install

Copy both files to `/etc/systemd/system/` on the VPS:

```bash
sudo cp backend/deploy/systemd/pe-be-chat-attachment-cleanup.service /etc/systemd/system/
sudo cp backend/deploy/systemd/pe-be-chat-attachment-cleanup.timer /etc/systemd/system/
sudo cp backend/deploy/systemd/pe-be-close-stale-open-workouts.service /etc/systemd/system/
sudo cp backend/deploy/systemd/pe-be-close-stale-open-workouts.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pe-be-chat-attachment-cleanup.timer
sudo systemctl enable --now pe-be-close-stale-open-workouts.timer
```

If your checkout path is not `/srv/pe-be`, update `WorkingDirectory=` and `EnvironmentFile=` in the service unit before enabling it.

## Operator Controls

The service reads `/srv/pe-be/.env` via `EnvironmentFile=`. The backend container receives:

```bash
JOB_CHAT_ATTACHMENT_CLEANUP_ENABLED=true
JOB_CLOSE_STALE_OPEN_WORKOUTS_ENABLED=true
```

Env flow for these jobs is:

1. `systemd` starts the oneshot service in `/srv/pe-be`.
2. `docker compose run` reads `/srv/pe-be/.env` for Compose variable interpolation.
3. Compose injects the configured job env vars into the ephemeral `backend` container from `docker-compose.yml`.
4. The backend process reads those env vars through `src.core.config.Settings`.

To disable the job without masking the timer:

```bash
JOB_CHAT_ATTACHMENT_CLEANUP_ENABLED=false
JOB_CLOSE_STALE_OPEN_WORKOUTS_ENABLED=false
```

Because the service uses `docker compose run`, Compose re-reads `.env` on each invocation. No timer restart is required for the next scheduled run to pick up the new value.

## Verify

Check the timer:

```bash
sudo systemctl status pe-be-chat-attachment-cleanup.timer
sudo systemctl status pe-be-close-stale-open-workouts.timer
sudo systemctl list-timers --all | grep pe-be-chat-attachment-cleanup
sudo systemctl list-timers --all | grep pe-be-close-stale-open-workouts
```

Run the job manually through the same container path used by the service:

```bash
cd /srv/pe-be
docker compose run --rm backend python -m src.jobs.chat_attachment_cleanup
docker compose run --rm backend python -m src.jobs.close_stale_open_workouts
```

Inspect service logs:

```bash
sudo journalctl -u pe-be-chat-attachment-cleanup.service -n 50 --no-pager
sudo journalctl -u pe-be-close-stale-open-workouts.service -n 50 --no-pager
```

## Overlap Check

The job uses Postgres advisory locking. A second overlapping run should log `status=skipped`.

To verify on the VPS:

1. Start one manual run.
2. Start a second manual run before the first finishes.
3. Confirm the second run logs `Job skipped ... status=skipped`.

The repo also has unit coverage for this behavior in `backend/tests/test_jobs_shared.py`.

## Schedules

- `pe-be-chat-attachment-cleanup.timer`: hourly
- `pe-be-close-stale-open-workouts.timer`: daily at `03:00`
