# RFC 0002: Static Frontend with VPS Backend

- Status: Proposed
- Date: 2026-03-26
- Owners: Platform / Full Stack

## Summary

Deploy the backend and PostgreSQL database on a single VPS while keeping the frontend on a static host.

Public routing remains anchored on the existing frontend hostname:

- `https://frontend.example.com` serves the frontend
- `https://frontend.example.com/api/...` remains the browser-visible API path
- the static host rewrites `/api/:path*` to `https://api-origin.example.com/api/:path*`
- `https://api-origin.example.com` terminates TLS on the VPS and proxies to the backend container

This preserves the current auth model and browser contract while moving the stateful workload off the frontend host.

## Context

This repo already has most of the application packaging needed for a VPS deployment:

- backend Docker image in [`backend/Dockerfile`](../../Dockerfile)
- a local-oriented Compose file in [`docker-compose.yml`](../../../docker-compose.yml)
- production deployment files in [`docker-compose.prod.yml`](../../../docker-compose.prod.yml), [`Caddyfile`](../../../Caddyfile), and [`backend/.env.production.template`](../../.env.production.template)

The current app auth flow is designed around a same-host public callback:

- the backend sets a session cookie on login in [`backend/src/core/security.py`](../../src/core/security.py)
- the configured Google callback is currently `https://frontend.example.com/api/v1/auth/google/callback`
- the frontend uses cookie-based authenticated requests with `withCredentials: true` in [`pe-be-tracker-frontend/src/shared/api/client.ts`](../../../pe-be-tracker-frontend/src/shared/api/client.ts)

That means the safest migration path is not "move the browser to `api.example.com`". The safest path is:

- keep the browser-visible API under `frontend.example.com/api/...`
- move only the backend origin behind the host rewrite

## Goals

- Keep the deployment simple for a single operator.
- Keep latency materially lower than a distant single-region deployment.
- Preserve the current browser-visible auth and API contract.
- Move the stateful services off the frontend host.
- Keep infrastructure straightforward and reproducible.

## Non-Goals

- Hosting the frontend on the VPS in this phase
- Kubernetes
- Multi-region failover
- Managed PostgreSQL
- Zero-downtime deploys for every release

## Decision

Use this topology:

- Static frontend at `https://frontend.example.com`
- Static host rewrite:
  - `/api/:path* -> https://api-origin.example.com/api/:path*`
- Single VPS in the target region
- Ubuntu LTS on the VPS
- Caddy on the VPS for TLS and proxying
- FastAPI backend container on the VPS
- PostgreSQL container on the VPS

The VPS runs only:

- `caddy`
- `backend`
- `db`

It does not run the frontend container in the recommended production shape.

## Why a Single VPS

This decision follows from a few practical constraints:

1. A single node keeps operations simple.
2. Co-locating backend and PostgreSQL is a reasonable fit for this project size.
3. The frontend does not need the same runtime resources as the backend.

The VPS should provide enough RAM headroom for:

- FastAPI
- PostgreSQL
- Docker and host overhead
- occasional startup or migration spikes

while still staying small enough to be a low-cost single-node deployment.

## Why the Frontend Stays Separate

The earlier RFC assumed the frontend should move to the VPS. That is no longer the recommendation.

Reasons:

- the frontend is a static site and already works well on a static host
- static hosting reduces VPS memory and operational pressure
- putting the static frontend on the VPS does not create a meaningful browser-latency advantage by itself
- the important latency improvement comes from moving the API and database closer to the target region

The frontend only needs to preserve the current public `/api/...` contract.

## Auth and Routing Implications

The main thing learned during deployment planning is that auth correctness is driven by the public callback and cookie path, not just by CORS.

### Recommended public URLs

- frontend: `https://frontend.example.com`
- browser-visible API: `https://frontend.example.com/api/v1/...`
- backend origin: `https://api-origin.example.com`
- Google callback: `https://frontend.example.com/api/v1/auth/google/callback`

### Why not switch the browser to `api.example.com`

If the browser directly calls `https://api.example.com`, then:

- requests become cross-origin from `frontend.example.com`
- cookie and redirect behavior become riskier
- the migration departs from the current host-based contract

Keeping `/api/...` on `frontend.example.com` is the safer option because it preserves the existing public behavior.

### Cookie guidance

For the first production rollout:

- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=lax`
- leave `COOKIE_DOMAIN` unset

Leaving `COOKIE_DOMAIN` unset keeps cookie scope narrow and matches the current public callback model more closely.

## Proposed Architecture

```text
Browser
  -> Static frontend host
  -> /api/* rewrite
  -> VPS Caddy
  -> Backend container
  -> PostgreSQL container
```

The frontend host only serves static assets and rewrites API requests to the VPS origin.

## Migration Checklist

1. Update DNS for `frontend.example.com` and `api-origin.example.com`.
2. Deploy the backend container and PostgreSQL container on the VPS.
3. Configure Caddy to terminate TLS and proxy `/api/*` to the backend container.
4. Verify login, session cookies, and API requests from the public frontend URL.
5. Confirm the health endpoint responds through the public browser-facing path.

## Risks

- Cookie scope or callback mismatch can break login if the public callback and origin are not aligned.
- A static host rewrite must preserve the browser-visible `/api/...` contract.
- A single VPS keeps the system simple but creates a single point of failure.

## Status

This document captures the deployment shape that the repo should target for a simple public deployment.
