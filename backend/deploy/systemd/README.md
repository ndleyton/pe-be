# Systemd Timer Deployment

This directory contains the first VPS scheduler assets for backend jobs.

Files:

- `pe-be-chat-attachment-cleanup.service`
- `pe-be-chat-attachment-cleanup.timer`

These units are intended for a Docker Compose deployment rooted at `/srv/pe-be`.

## Install

Copy both files to `/etc/systemd/system/` on the VPS:

```bash
sudo cp backend/deploy/systemd/pe-be-chat-attachment-cleanup.service /etc/systemd/system/
sudo cp backend/deploy/systemd/pe-be-chat-attachment-cleanup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pe-be-chat-attachment-cleanup.timer
```

If your checkout path is not `/srv/pe-be`, update `WorkingDirectory=` and `EnvironmentFile=` in the service unit before enabling it.

## Operator Controls

The service reads `/srv/pe-be/.env` via `EnvironmentFile=`. The backend container receives:

```bash
JOB_CHAT_ATTACHMENT_CLEANUP_ENABLED=true
```

To disable the job without masking the timer:

```bash
JOB_CHAT_ATTACHMENT_CLEANUP_ENABLED=false
```

Because the service uses `docker compose run`, Compose re-reads `.env` on each invocation. No timer restart is required for the next scheduled run to pick up the new value.

## Verify

Check the timer:

```bash
sudo systemctl status pe-be-chat-attachment-cleanup.timer
sudo systemctl list-timers --all | grep pe-be-chat-attachment-cleanup
```

Run the job manually through the same container path used by the service:

```bash
cd /srv/pe-be
docker compose run --rm backend python -m src.jobs.chat_attachment_cleanup
```

Inspect service logs:

```bash
sudo journalctl -u pe-be-chat-attachment-cleanup.service -n 50 --no-pager
```

## Overlap Check

The job uses Postgres advisory locking. A second overlapping run should log `status=skipped`.

To verify on the VPS:

1. Start one manual run.
2. Start a second manual run before the first finishes.
3. Confirm the second run logs `Job skipped ... status=skipped`.

The repo also has unit coverage for this behavior in `backend/tests/test_jobs_shared.py`.
