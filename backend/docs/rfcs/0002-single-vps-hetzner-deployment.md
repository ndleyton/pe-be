# RFC 0002: Single-VPS Deployment on Hetzner Cloud

- Status: Proposed
- Date: 2026-03-17
- Owners: Platform / Full Stack

## Summary

Deploy the application on a single Hetzner Cloud VPS in an EU region using Docker Compose, with one public reverse proxy and three private services:

- Caddy for TLS termination and routing
- frontend container for static assets
- backend container for FastAPI
- PostgreSQL container with a persistent volume

The recommended baseline is a Hetzner `CX23` instance, not because it is the absolute cheapest option, but because it is the cheapest option that is still credible for this repo's current architecture.

For a hard `$5/month` ceiling, there are alternatives, but they are materially tighter on RAM and operational headroom.

## Context

This repo already has most of the application packaging needed for a VPS deployment:

- backend Docker image in [`backend/Dockerfile`](/Users/ndleyton/.codex/worktrees/bc2c/pe-be/backend/Dockerfile)
- frontend Docker image in [`pe-be-tracker-frontend/Dockerfile`](/Users/ndleyton/.codex/worktrees/bc2c/pe-be/pe-be-tracker-frontend/Dockerfile)
- a starting Compose file in [`docker-compose.yml`](/Users/ndleyton/.codex/worktrees/bc2c/pe-be/docker-compose.yml)

However, the current Compose setup should not be treated as production-ready. There are several concrete issues:

1. `VITE_API_BASE_URL` is currently set as a runtime environment variable on the frontend container, but Vite reads it at build time, not at nginx runtime.
2. The Compose value points the browser at `http://backend:8000`, which is a Docker-internal hostname and is not resolvable from a user browser.
3. The frontend app expects an API base that includes `/api/v1`, but the current Compose value omits that.
4. The frontend nginx config proxies `/api/` with a trailing slash in `proxy_pass`, which strips the `/api/` prefix and would break versioned backend routes such as `/api/v1/...`.
5. PostgreSQL is published on `5432`, which is unnecessary and increases attack surface on a public VPS.

The RFC therefore covers both:

- where to deploy
- what production deployment shape should replace the current local-oriented Compose setup

## Goals

- Keep infrastructure simple enough for one-person operation.
- Stay near the low-cost VPS tier.
- Preserve the current container-based app packaging.
- Support HTTPS, Google OAuth redirects, cookies, and a persistent PostgreSQL database.
- Avoid introducing managed services unless the budget or reliability target forces it.

## Non-Goals

- High availability across multiple hosts
- Multi-region failover
- Kubernetes
- Managed PostgreSQL
- Zero-downtime deploys for every release

## Decision

Use a single Hetzner Cloud VPS in Germany or Finland with this topology:

- `caddy` on ports `80` and `443`
- `frontend` on a private Docker network
- `backend` on a private Docker network
- `db` on a private Docker network with a named volume

Recommend Hetzner `CX23` as the baseline production instance.

## Why Hetzner `CX23`

As of 2026-03-17, Hetzner's public cloud pricing page lists `CX23` at `$4.09/month` max with `2 vCPU`, `4 GB RAM`, `40 GB` SSD, and `20 TB` traffic in EU regions. Hetzner's price-adjustment notice says that on `2026-04-01`, `CX23` increases from `$3.49` to `$4.99` per month in Germany and Finland. Hetzner also charges `$0.60/month` for a Cloud Primary IPv4 address.

That leads to two practical readings:

- before `2026-04-01`, `CX23 + IPv4` is roughly `$4.69/month`
- from `2026-04-01`, `CX23 + IPv4` is roughly `$5.59/month`

This is slightly above a strict `$5` cap once IPv4 is included, but still materially better provisioned than most competitors at the same budget band.

`CX23` is preferred over `CAX11` for this repo because:

- the pricing page currently lists the same `2 vCPU / 4 GB / 40 GB / 20 TB` class for both
- `CX23` is cheaper than `CAX11` today
- `CX23` avoids ARM compatibility surprises in Python wheels, Docker images, or future dependencies

`CAX11` is still viable, but it only makes sense if the team intentionally wants ARM.

## Alternatives Around $5/Month

Prices below are from official pricing pages and are included here only as a decision aid. They can change.

| Provider | Plan | Current published price | Effective change noted | Published entry-level spec | Evaluation |
| --- | --- | --- | --- | --- | --- |
| Hetzner | `CX23` | `$4.09/mo` | `$4.99/mo` from 2026-04-01, plus `$0.60/mo` IPv4 | `2 vCPU`, `4 GB`, `40 GB`, `20 TB` | Best fit for this repo if the budget can stretch slightly above `$5` once IPv4 is included. |
| Hetzner | `CAX11` | `$4.59/mo` | `$5.49/mo` from 2026-04-01, plus `$0.60/mo` IPv4 | `2 vCPU`, `4 GB`, `40 GB`, `20 TB` | Good value, but ARM-only and now worse than `CX23` on price. |
| AWS Lightsail | Linux instance bundle | `$5/mo` | no price increase found in the official page during this RFC | `1 GB`, `1 core`, `40 GB`, `2 TB` | Fits the strict budget and includes public IPv4. Operationally simpler than some providers, but 1 GB is a thin margin for frontend + backend + Postgres on one node. |
| Akamai / Linode | `Nanode 1GB` | `$5/mo` | no price change found during this RFC | `1 vCPU`, `1 GB`, `25 GB`, `1 TB` | Similar problem to Lightsail: workable for a tiny hobby install, but little safety margin for Postgres and Python app bursts. |
| Vultr | Regular Performance `1 GB` | `$5/mo` | no price change found during this RFC | `1 vCPU`, `1 GB`, `25 GB`, `1 TB` | Same RAM constraint as Linode. Usable for very light traffic, but not the safest baseline. |
| DigitalOcean | Basic Droplet `512 MiB` / `1 GiB` | `$4/mo` or `$6/mo` | changed to per-second billing effective 2026-01-01 | `512 MiB` or `1 GiB` | The `$4` plan is too small. The first realistic plan is `$6`, which is already above the target budget. |

## Recommendation by Budget

### If the budget is a hard cap at `$5`

Use one of these only if "must stay at or under `$5`" is more important than operational headroom:

- AWS Lightsail `$5`
- Linode `Nanode 1GB` `$5`
- Vultr `1 GB` `$5`

This should be treated as a hobby or early staging posture, not the preferred production posture for this repo.

### If the budget can stretch to roughly `$5.50` to `$6.00`

Use Hetzner `CX23` with one public IPv4.

That is the recommended baseline for this project.

## Proposed Architecture

```text
Internet
  |
  v
Caddy (80/443, TLS, redirects, gzip)
  |-- /api/*, /health  -> backend:8000
  `-- /*               -> frontend:80

backend -> PostgreSQL
frontend -> same-origin API calls
```

### Routing

- `https://app.example.com/` serves the frontend
- `https://app.example.com/api/v1/*` routes to FastAPI
- `https://app.example.com/health` may route to backend health for external checks

### Why same-origin routing

Same-origin routing keeps cookies, OAuth redirects, and browser networking simpler:

- `VITE_API_BASE_URL` can be set to `/api/v1`
- no browser-visible `backend:8000`
- fewer CORS edge cases
- cleaner OAuth callback configuration

## Required Application-Level Changes Before Deployment

These are not large architecture changes, but they do need to happen before calling the deployment production-ready:

1. Add a production-specific Compose file rather than reusing the current local default unchanged.
2. Put the reverse proxy at the edge and stop publishing backend and database ports directly.
3. Build the frontend with `VITE_API_BASE_URL=/api/v1`.
4. Remove API proxying from the frontend nginx container, or correct it so it does not rewrite `/api/v1` incorrectly.
5. Set backend production env vars correctly:
   - `ENVIRONMENT=production`
   - `COOKIE_SECURE=true`
   - `FRONTEND_URL=https://app.example.com`
   - `GOOGLE_REDIRECT_URI=https://app.example.com/api/v1/auth/google/callback`
   - `DATABASE_URL=postgresql+asyncpg://...`
6. Keep PostgreSQL private to the Docker network.

## Operational Baseline

### Host OS

- Ubuntu 24.04 LTS
- automatic security updates enabled
- SSH key auth only
- password login disabled
- basic host firewall allowing only `22`, `80`, and `443`

### Data

- Docker named volume for PostgreSQL data
- Hetzner server backups enabled if the budget allows it
- regular logical `pg_dump` backups copied off-host if the environment is production

### Deploy Flow

1. Build new frontend and backend images.
2. Pull or copy the updated app to the VPS.
3. Run `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
4. Let the backend container run Alembic on startup.
5. Verify `/health`, auth session checks, and a manual login flow.

## Risks

### Single-node risk

This design has no host redundancy. A host failure or operator error can still cause downtime.

### Memory pressure on sub-1-GB alternatives

The current app is not just a static site. It includes:

- a Python API
- PostgreSQL
- analytics configuration in the frontend
- optional AI integrations in the backend

That is why 1 GB plans are budget-compatible but not the preferred production recommendation.

### OAuth misconfiguration

If `FRONTEND_URL`, `GOOGLE_REDIRECT_URI`, cookie security, or the Google console callback URL drift, sign-in will fail.

### ARM drift if choosing `CAX11`

This repo likely runs on ARM because the major base images are multi-arch, but that should be treated as an inference, not as a validated guarantee.

## Rollout Plan

1. Prepare `docker-compose.prod.yml` and a `Caddyfile`.
2. Make frontend production builds use a same-origin API base.
3. Stand up a staging host or temporary VPS and validate:
   - health endpoint
   - Google OAuth
   - login redirect
   - cookie persistence
   - basic CRUD flows
4. Create production DNS and Google OAuth settings.
5. Deploy to the Hetzner VPS.
6. Add backup verification and a restore drill.

## Sources

- Hetzner Cloud pricing: [hetzner.com/cloud/pricing](https://www.hetzner.com/cloud/pricing/)
- Hetzner price adjustment, created 2026-02-19 and last changed 2026-02-25: [docs.hetzner.com/general/infrastructure-and-availability/price-adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- Hetzner IPv4 pricing: [docs.hetzner.com/general/infrastructure-and-availability/ipv4-pricing](https://docs.hetzner.com/general/infrastructure-and-availability/ipv4-pricing/)
- DigitalOcean Droplet pricing: [digitalocean.com/pricing/droplets](https://www.digitalocean.com/pricing/droplets)
- AWS Lightsail pricing: [aws.amazon.com/lightsail/pricing](https://aws.amazon.com/lightsail/pricing/)
- Akamai / Linode shared CPU pricing: [linode.com/pricing](https://www.linode.com/pricing/)
- Akamai shared CPU instance docs: [techdocs.akamai.com/cloud-computing/docs/shared-cpu-compute-instances](https://techdocs.akamai.com/cloud-computing/docs/shared-cpu-compute-instances)
- Vultr pricing: [vultr.com/pricing](https://www.vultr.com/pricing/)
