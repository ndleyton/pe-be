# RFC 0002: North America Deployment with Render Frontend and Hetzner Backend

- Status: Proposed
- Date: 2026-03-26
- Owners: Platform / Full Stack

## Summary

Deploy the backend and PostgreSQL database on a single Hetzner Cloud `CPX11` instance in Ashburn, Virginia, while keeping the frontend on Render.

Public routing remains anchored on the existing frontend hostname:

- `https://app.personalbestie.com` serves the frontend from Render
- `https://app.personalbestie.com/api/...` remains the browser-visible API path
- Render rewrites `/api/:path*` to `https://origin-api.personalbestie.com/api/:path*`
- `https://origin-api.personalbestie.com` terminates TLS on the Hetzner VPS and proxies to the backend container

This preserves the current auth model and browser contract while moving the stateful workload off Render.

## Context

This repo already has most of the application packaging needed for a VPS deployment:

- backend Docker image in [`backend/Dockerfile`](../../Dockerfile)
- a local-oriented Compose file in [`docker-compose.yml`](../../../docker-compose.yml)
- new production deployment files in [`docker-compose.prod.yml`](../../../docker-compose.prod.yml), [`Caddyfile`](../../../Caddyfile), and [`backend/.env.production.template`](../../.env.production.template)

The current app auth flow is designed around a same-host public callback:

- the backend sets a session cookie on login in [`backend/src/core/security.py`](../../src/core/security.py)
- the configured Google callback is currently `https://app.personalbestie.com/api/v1/auth/google/callback`
- the frontend uses cookie-based authenticated requests with `withCredentials: true` in [`pe-be-tracker-frontend/src/shared/api/client.ts`](../../../pe-be-tracker-frontend/src/shared/api/client.ts)

That means the safest migration path is not "move the browser to `api.personalbestie.com`". The safest path is:

- keep the browser-visible API under `app.personalbestie.com/api/...`
- move only the backend origin behind the Render rewrite

## Goals

- Prefer North America hosting over Europe.
- Keep latency materially lower than an EU-only deployment.
- Preserve the current browser-visible auth and API contract.
- Move the stateful services off Render.
- Keep infrastructure simple enough for one-person operation.

## Non-Goals

- Hosting the frontend on the VPS in this phase
- Kubernetes
- Multi-region failover
- Managed PostgreSQL
- Zero-downtime deploys for every release

## Decision

Use this topology:

- Render static frontend at `https://app.personalbestie.com`
- Render rewrite:
  - `/api/:path* -> https://origin-api.personalbestie.com/api/:path*`
- Hetzner `CPX11` in Ashburn, Virginia
- Ubuntu 24.04 LTS on the VPS
- Caddy on the VPS for TLS and proxying
- FastAPI backend container on the VPS
- PostgreSQL container on the VPS

The VPS runs only:

- `caddy`
- `backend`
- `db`

It does not run the frontend container in the recommended production shape.

## Why `CPX11` in Ashburn

This decision changed from the earlier `CX23` idea for three reasons:

1. `CX23` is not the right North America choice. In practice, the Hetzner console exposes `CX23` only in Helsinki and Nuremberg, while the North America path uses the `CPX` line instead.
2. North America locality is preferred for this deployment.
3. For this repo, backend plus PostgreSQL is a better use of the VPS than full-stack hosting on a tighter budget.

`CPX11` is the right fit here because it gives more credible RAM headroom for:

- FastAPI
- PostgreSQL
- Docker and host overhead
- occasional startup or migration spikes

while still staying small enough to be a low-cost single-node deployment.

## Why the Frontend Stays on Render

The earlier RFC assumed the frontend should move to the VPS. That is no longer the recommendation.

Reasons:

- the frontend is a static site and already works on Render
- Render static hosting reduces VPS memory and operational pressure
- putting the static frontend on the VPS does not create a meaningful browser-latency advantage by itself
- the important latency improvement comes from moving the API and database closer to the target region

The frontend only needs to preserve the current public `/api/...` contract.

## Auth and Routing Implications

The main thing learned during deployment planning is that auth correctness is driven by the public callback and cookie path, not just by CORS.

### Recommended public URLs

- frontend: `https://app.personalbestie.com`
- browser-visible API: `https://app.personalbestie.com/api/v1/...`
- backend origin: `https://origin-api.personalbestie.com`
- Google callback: `https://app.personalbestie.com/api/v1/auth/google/callback`

### Why not switch the browser to `api.personalbestie.com`

If the browser directly calls `https://api.personalbestie.com`, then:

- requests become cross-origin from `app.personalbestie.com`
- cookie and redirect behavior become riskier
- the migration departs from the current Render-based contract

Keeping `/api/...` on `app.personalbestie.com` is the safer option because it preserves the existing public behavior.

### Cookie guidance

For the first production rollout:

- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=lax`
- leave `COOKIE_DOMAIN` unset

Leaving `COOKIE_DOMAIN` unset keeps cookie scope narrow and matches the current public callback model more closely.

## Proposed Architecture

```text
Browser
  |
  v
Render (app.personalbestie.com)
  |-- /*       -> frontend static site
  `-- /api/*   -> rewrite/proxy to origin-api.personalbestie.com

origin-api.personalbestie.com
  |
  v
Caddy on Hetzner
  |
  v
backend container
  |
  v
PostgreSQL container
```

## Server-Side Topology

The production files added in this repo implement the VPS side as:

- Caddy listening on `80` and `443`
- backend exposed only on the Docker network
- PostgreSQL exposed only on the Docker network

See:

- [`docker-compose.prod.yml`](../../../docker-compose.prod.yml)
- [`Caddyfile`](../../../Caddyfile)
- [`backend/.env.production.template`](../../.env.production.template)

## Resource Expectations

With the frontend kept off-box, the VPS needs to carry only:

- backend
- PostgreSQL
- Caddy
- Docker / OS overhead

Expected RAM shape for this repo:

- roughly `500-850 MB` under light steady-state conditions
- roughly `700 MB - 1.1 GB` as a more realistic operating range

That makes:

- `1 GB` a fragile floor
- `2 GB` the recommended minimum

This is another reason to prefer `CPX11` over ultra-cheap `1 GB` alternatives.

## Host Baseline

- Ubuntu 24.04 LTS
- SSH key auth only
- non-root `deploy` user with sudo
- host firewall allowing only `22`, `80`, and `443`
- Docker Engine and Compose plugin installed

## Required Environment Values

The production template should be copied to `backend/.env.production` and populated.

The critical values are:

- `FRONTEND_URL=https://app.personalbestie.com`
- `FRONTEND_POST_LOGIN_PATH=/workouts`
- `API_ORIGIN_DOMAIN=origin-api.personalbestie.com`
- `GOOGLE_REDIRECT_URI=https://app.personalbestie.com/api/v1/auth/google/callback`
- `ENVIRONMENT=production`
- `COOKIE_SECURE=true`
- `DATABASE_URL=postgresql+asyncpg://...@db:5432/...`

## DNS

Create or maintain:

- `app.personalbestie.com` -> Render
- `origin-api.personalbestie.com` -> Hetzner VPS public IPv4

There is no need to expose a public `api.personalbestie.com` hostname for the first rollout.

## Deploy Flow

1. Copy [`backend/.env.production.template`](../../.env.production.template) to `backend/.env.production` and populate secrets.
2. Point `origin-api.personalbestie.com` at the Hetzner VPS.
3. Run:
   - `docker compose -f docker-compose.prod.yml up -d --build`
4. Update the Render rewrite:
   - `/api/:path* -> https://origin-api.personalbestie.com/api/:path*`
5. Verify:
   - `https://app.personalbestie.com/api/v1/health`
   - Google login initiation
   - Google callback
   - post-login redirect
   - `GET /api/v1/auth/session`

## Risks

### Render rewrite assumptions

This design assumes the Render rewrite preserves the current browser-visible `/api/...` behavior. That should be verified in production after cutover.

### Single-node risk

The backend and database remain single-host services. Host failure still causes downtime.

### Memory ceiling

`CPX11` is a small server. It is the right small baseline, not a large safety margin.

### OAuth drift

If `FRONTEND_URL`, `GOOGLE_REDIRECT_URI`, or the Render rewrite drift apart, sign-in will fail.

## Rollout Plan

1. Deploy the VPS-side stack from [`docker-compose.prod.yml`](../../../docker-compose.prod.yml).
2. Validate `origin-api.personalbestie.com` directly.
3. Switch the Render `/api` rewrite to the new Hetzner origin.
4. Validate end-to-end login and session behavior on `app.personalbestie.com`.
5. Monitor memory, restart behavior, and database health during the first week.

## Sources

- Hetzner Cloud pricing: [hetzner.com/cloud/pricing](https://www.hetzner.com/cloud/pricing/)
- Hetzner locations: [docs.hetzner.com/cloud/general/locations](https://docs.hetzner.com/cloud/general/locations/)
- Hetzner price adjustment: [docs.hetzner.com/general/infrastructure-and-availability/price-adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
