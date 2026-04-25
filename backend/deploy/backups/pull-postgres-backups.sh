#!/usr/bin/env bash
set -euo pipefail

REMOTE="${REMOTE:?Set REMOTE to the VPS SSH target, for example deploy@app.example.com}"
REMOTE_BACKUP_DIR="${REMOTE_BACKUP_DIR:-/var/backups/pe-be/postgres/}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-$HOME/backups/pe-be/postgres}"
RETENTION_DAILY="${RETENTION_DAILY:-14}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-8}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-12}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$LOCAL_BACKUP_DIR"
chmod 700 "$LOCAL_BACKUP_DIR"

rsync \
  --archive \
  --compress \
  --partial \
  --prune-empty-dirs \
  --include 'pe-be-postgres-*.dump' \
  --include 'pe-be-postgres-*.dump.gpg' \
  --exclude '*' \
  "$REMOTE:$REMOTE_BACKUP_DIR" \
  "$LOCAL_BACKUP_DIR/"

python3 "$SCRIPT_DIR/prune-postgres-backups.py" \
  "$LOCAL_BACKUP_DIR" \
  --keep-daily "$RETENTION_DAILY" \
  --keep-weekly "$RETENTION_WEEKLY" \
  --keep-monthly "$RETENTION_MONTHLY"

echo "Backups synced to: $LOCAL_BACKUP_DIR"
