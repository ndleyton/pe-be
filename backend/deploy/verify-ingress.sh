#!/usr/bin/env bash
# Verify readiness through origin TLS and the public frontend proxy.
# Runs on the deploy runner: API_ORIGIN_DOMAIN=... FRONTEND_URL=https://... verify-ingress.sh
set -euo pipefail
: "${API_ORIGIN_DOMAIN:?API_ORIGIN_DOMAIN is required}"
: "${FRONTEND_URL:?FRONTEND_URL is required}"
[[ "$FRONTEND_URL" == https://* ]] || { echo "FRONTEND_URL must use HTTPS" >&2; exit 1; }

response_file=$(mktemp)
trap 'rm -f -- "$response_file"' EXIT
for endpoint in "https://${API_ORIGIN_DOMAIN}/health/ready" "${FRONTEND_URL%/}/api/v1/health/ready"; do
  # Reject redirects and static-host SPA fallback pages.
  status=$(curl --silent --show-error --fail --retry 5 --retry-connrefused \
    --retry-delay 3 --connect-timeout 5 --max-time 10 \
    --proto '=https' --output "$response_file" --write-out '%{http_code}' "$endpoint")
  [[ "$status" == 200 ]] || { echo "Ingress returned HTTP $status" >&2; exit 1; }
  python3 - "$response_file" <<'PYTHON'
import json
import sys
with open(sys.argv[1]) as response:
    if json.load(response) != {"status": "ok"}:
        raise SystemExit("Ingress readiness check failed")
PYTHON
done
echo "Verified through origin TLS and public API proxy."
