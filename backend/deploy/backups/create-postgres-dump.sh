#!/usr/bin/env bash
set -euo pipefail

BACKUP_CONFIG_FILE="${BACKUP_CONFIG_FILE:-/root/.config/pe-be-backup.env}"

if [[ -f "$BACKUP_CONFIG_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$BACKUP_CONFIG_FILE"
  set +a
fi

APP_DIR="${APP_DIR:-/srv/pe-be}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$APP_DIR/backend/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/pe-be/postgres}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-3}"
ENCRYPTION_MODE="${ENCRYPTION_MODE:-gpg-passphrase}"
PASSPHRASE_FILE="${PASSPHRASE_FILE:-/root/.config/pe-be-backup-passphrase}"
GPG_RECIPIENT="${GPG_RECIPIENT:-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${POSTGRES_DB:?POSTGRES_DB is required in $ENV_FILE}"
: "${POSTGRES_USER:?POSTGRES_USER is required in $ENV_FILE}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
base_name="pe-be-postgres-${timestamp}.dump"
tmp_dir="$(mktemp -d)"
plain_dump="$tmp_dir/$base_name"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

cd "$APP_DIR"

docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --format custom \
    --no-owner \
    --file - \
  > "$plain_dump"

case "$ENCRYPTION_MODE" in
  gpg-passphrase)
    if [[ ! -f "$PASSPHRASE_FILE" ]]; then
      echo "Missing passphrase file: $PASSPHRASE_FILE" >&2
      exit 1
    fi

    output_file="$BACKUP_DIR/${base_name}.gpg"
    gpg \
      --batch \
      --yes \
      --pinentry-mode loopback \
      --passphrase-file "$PASSPHRASE_FILE" \
      --symmetric \
      --cipher-algo AES256 \
      --output "$output_file" \
      "$plain_dump"
    ;;
  gpg-recipient)
    if [[ -z "$GPG_RECIPIENT" ]]; then
      echo "GPG_RECIPIENT is required when ENCRYPTION_MODE=gpg-recipient" >&2
      exit 1
    fi

    output_file="$BACKUP_DIR/${base_name}.gpg"
    gpg \
      --batch \
      --yes \
      --trust-model always \
      --recipient "$GPG_RECIPIENT" \
      --encrypt \
      --output "$output_file" \
      "$plain_dump"
    ;;
  none)
    output_file="$BACKUP_DIR/$base_name"
    mv "$plain_dump" "$output_file"
    ;;
  *)
    echo "Unsupported ENCRYPTION_MODE: $ENCRYPTION_MODE" >&2
    exit 1
    ;;
esac

chmod 600 "$output_file"

if [[ "$LOCAL_RETENTION_DAYS" =~ ^[0-9]+$ ]] && (( LOCAL_RETENTION_DAYS > 0 )); then
  find "$BACKUP_DIR" \
    -type f \
    -name 'pe-be-postgres-*.dump*' \
    -mtime +"$LOCAL_RETENTION_DAYS" \
    -delete
fi

echo "Created backup: $output_file"
