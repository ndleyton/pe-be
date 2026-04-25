# Postgres Backup Runbook

This backup flow is intentionally small:

1. The VPS creates an encrypted `pg_dump --format=custom` file every night.
2. A personal computer periodically pulls any missing dump files with `rsync`.
3. The personal computer prunes old files with daily, weekly, and monthly retention.

The personal computer is the off-VPS disaster recovery copy. It does not need to be highly available; it only needs to pull often enough for the recovery point you can tolerate.

## VPS Setup

Install host dependencies:

```bash
sudo apt-get update
sudo apt-get install -y gnupg rsync
```

Create the backup secret files:

```bash
sudo install -d -m 700 /root/.config
sudo sh -c 'openssl rand -base64 48 > /root/.config/pe-be-backup-passphrase'
sudo chmod 600 /root/.config/pe-be-backup-passphrase
sudo tee /root/.config/pe-be-backup.env >/dev/null <<'EOF'
APP_DIR=/srv/pe-be
COMPOSE_FILE=docker-compose.prod.yml
BACKUP_DIR=/var/backups/pe-be/postgres
ENCRYPTION_MODE=gpg-passphrase
PASSPHRASE_FILE=/root/.config/pe-be-backup-passphrase
LOCAL_RETENTION_DAYS=3
EOF
sudo chmod 600 /root/.config/pe-be-backup.env
```

Install the systemd timer:

```bash
cd /srv/pe-be
sudo cp backend/deploy/systemd/pe-be-postgres-backup.service /etc/systemd/system/
sudo cp backend/deploy/systemd/pe-be-postgres-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pe-be-postgres-backup.timer
```

Run one backup manually:

```bash
sudo systemctl start pe-be-postgres-backup.service
sudo journalctl -u pe-be-postgres-backup.service -n 50 --no-pager
sudo ls -lh /var/backups/pe-be/postgres
```

Keep `/root/.config/pe-be-backup-passphrase` somewhere recoverable outside the VPS, such as a password manager. Without it, the `.gpg` dump files cannot be decrypted.

## Personal Computer Pull

From this repo checkout on the personal computer:

```bash
REMOTE=root@origin-api.example.com \
LOCAL_BACKUP_DIR="$HOME/backups/pe-be/postgres" \
backend/deploy/backups/pull-postgres-backups.sh
```

`REMOTE` can be any SSH user that can read `/var/backups/pe-be/postgres/`. If root SSH is disabled, create a dedicated pull user and grant that user read-only access to the backup directory with ACLs or a restricted sudo/rsync setup.

The pull script keeps:

- 14 daily restore points
- 8 weekly restore points
- 12 monthly restore points

Override those with `RETENTION_DAILY`, `RETENTION_WEEKLY`, and `RETENTION_MONTHLY`.

Schedule the pull with launchd, cron, or any local scheduler. Pulling is preferred over pushing because the personal computer can be offline; the next run catches up by syncing missing files.

## Restore Check

Decrypt a backup:

```bash
gpg \
  --batch \
  --pinentry-mode loopback \
  --passphrase-file /path/to/pe-be-backup-passphrase \
  --decrypt \
  "$HOME/backups/pe-be/postgres/pe-be-postgres-YYYYMMDDTHHMMSSZ.dump.gpg" \
  > /tmp/pe-be-postgres.dump
```

Restore into a temporary local database:

```bash
createdb pe_be_restore_check
pg_restore --dbname pe_be_restore_check --no-owner --clean --if-exists /tmp/pe-be-postgres.dump
psql pe_be_restore_check -c 'select count(*) from users;'
dropdb pe_be_restore_check
rm -f /tmp/pe-be-postgres.dump
```

Run this monthly. If the restore command fails, the backup process is not healthy even if files are being copied.
