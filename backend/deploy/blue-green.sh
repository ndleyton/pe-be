#!/usr/bin/env bash
# Blue-green helper for the production backend (RFC 0011).
#
#   blue-green.sh active          print the active color (exit 3 if none is recorded yet)
#   blue-green.sh idle            print the color a deploy should start
#   blue-green.sh switch COLOR    record COLOR as active and reload Caddy onto it
#   blue-green.sh run ARGS...     docker compose run --rm -T <active color> ARGS...
#
# State lives in config/active-backend.env (ACTIVE_BACKEND=backend-blue|backend-green).
# Caddy rereads it on every start via `caddy run --envfile`; a switch also passes the
# validated value to `caddy reload` explicitly, since a running container's env is fixed.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."
state_file=config/active-backend.env
previous_file=config/previous-backend.env
compose=(docker compose -f docker-compose.prod.yml)

validate() {
  case "$1" in
    backend-blue|backend-green) ;;
    *) echo "Invalid backend color: '$1'" >&2; exit 1 ;;
  esac
}

read_color() {
  [[ -f "$1" ]] || return 3
  local color
  color=$(sed -n 's/^ACTIVE_BACKEND=//p' "$1")
  validate "$color"
  printf '%s\n' "$color"
}

cmd=${1:-}
shift || true
case "$cmd" in
  active)
    read_color "$state_file"
    ;;
  idle)
    # No state yet is the first run, when only the legacy `backend` container exists.
    active=none
    [[ -f "$state_file" ]] && active=$(read_color "$state_file")
    [[ "$active" == backend-blue ]] && echo backend-green || echo backend-blue
    ;;
  switch)
    target=${1:-}
    validate "$target"
    mkdir -p config
    if current=$(read_color "$state_file" 2>/dev/null) && [[ "$current" != "$target" ]]; then
      printf 'ACTIVE_BACKEND=%s\n' "$current" > "$previous_file"
    fi
    # Write in place: Caddy bind-mounts this single file, and a rename would hide the update.
    printf 'ACTIVE_BACKEND=%s\n' "$target" > "$state_file"
    ACTIVE_BACKEND=$(read_color "$state_file")
    # Creates or recreates Caddy only when its image or compose config changed (e.g. first run).
    "${compose[@]}" up -d --no-deps caddy
    # Retry while a just-recreated Caddy brings up its admin API.
    for attempt in 1 2 3 4 5 6 7 8 9 10; do
      if "${compose[@]}" exec -T -e ACTIVE_BACKEND="$ACTIVE_BACKEND" caddy \
        caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
        break
      fi
      (( attempt < 10 )) || { echo "caddy reload failed" >&2; exit 1; }
      sleep 2
    done
    echo "Caddy now proxies to ${ACTIVE_BACKEND}"
    ;;
  run)
    active=$(read_color "$state_file") || { echo "No valid active backend in $state_file" >&2; exit 1; }
    exec "${compose[@]}" run --rm -T "$active" "$@"
    ;;
  *)
    sed -n '2,7p' "${BASH_SOURCE[0]}" >&2
    exit 2
    ;;
esac
