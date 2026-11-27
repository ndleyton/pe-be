#!/usr/bin/env bash
# Blue-green helper for the production backend (RFC 0011).
#
#   blue-green.sh active          print the active color (exit 3 if none is recorded yet)
#   blue-green.sh idle            print the color a deploy should start
#   blue-green.sh switch COLOR    record COLOR as active and reload Caddy onto it
#   blue-green.sh rollback        start the previous color, switch to it, stop the other
#   blue-green.sh stop-inactive   stop whichever color is not active
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

reload_caddy() {
  # Creates or recreates Caddy only when its image or compose config changed (e.g. first run).
  "${compose[@]}" up -d --no-deps caddy || return 1
  # Retry while a just-recreated Caddy brings up its admin API.
  local attempt
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    "${compose[@]}" exec -T -e ACTIVE_BACKEND="$1" caddy \
      caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile && return 0
    (( attempt < 10 )) && sleep 2
  done
  return 1
}

switch_to() {
  local target=$1 current=""
  validate "$target"
  mkdir -p config
  [[ -f "$state_file" ]] && current=$(read_color "$state_file")
  # Write in place: Caddy bind-mounts this single file, and a rename would hide the update.
  printf 'ACTIVE_BACKEND=%s\n' "$target" > "$state_file"
  if ! reload_caddy "$(read_color "$state_file")"; then
    # Keep the state matching what Caddy still serves, so the next deploy's idle color
    # is not the live one. shortcut: a Caddy recreated mid-switch already reads $target.
    [[ -n "$current" ]] && printf 'ACTIVE_BACKEND=%s\n' "$current" > "$state_file"
    echo "Caddy switch to ${target} failed; state left at '${current:-none}'" >&2
    exit 1
  fi
  if [[ -n "$current" && "$current" != "$target" ]]; then
    printf 'ACTIVE_BACKEND=%s\n' "$current" > "$previous_file"
  fi
  echo "Caddy now proxies to ${target}"
}

stop_inactive() {
  local active color
  active=$(read_color "$state_file")
  for color in backend-blue backend-green; do
    if [[ "$color" != "$active" ]]; then
      "${compose[@]}" stop "$color"
    fi
  done
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
    switch_to "${1:-}"
    ;;
  rollback)
    if [[ ! -f "$previous_file" ]]; then
      # First blue-green deploy: the legacy pe-be-backend container is still running.
      echo "::error::No previous color recorded; restore the legacy backend manually"
      exit 1
    fi
    previous=$(read_color "$previous_file")
    "${compose[@]}" start "$previous"
    switch_to "$previous"
    stop_inactive
    ;;
  stop-inactive)
    stop_inactive
    ;;
  run)
    active=$(read_color "$state_file") || { echo "No valid active backend in $state_file" >&2; exit 1; }
    exec "${compose[@]}" run --rm -T "$active" "$@"
    ;;
  *)
    sed -n '2,9p' "${BASH_SOURCE[0]}" >&2
    exit 2
    ;;
esac
