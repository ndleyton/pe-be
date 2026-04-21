# RFC 0005: Caching High-Traffic GET Requests on the VPS

- Status: Done
- Date: 2026-04-07
- Owners: Backend / Platform

## Summary

This RFC proposes a pragmatic caching strategy for high-traffic read endpoints on the current Hetzner single-VPS deployment, starting with catalog-style GETs such as:

- `/api/v1/exercises/exercise-types/`
- `/api/v1/exercises/muscle-groups/`
- `/api/v1/exercises/intensity-units/`
- `/api/v1/workouts/workout-types/`

The recommendation is:

1. Add explicit HTTP caching semantics on cache-safe GET responses.
2. Add a small route-scoped FastAPI cache for public or release-only catalog responses.
3. Do not introduce Redis on day one.
4. Revisit Redis only if we outgrow a single app process or need shared cache state across multiple backend replicas or workers.

This is the best fit for the current production shape:

- one small Hetzner CPX11-class VPS
- Caddy on the edge
- one FastAPI backend container
- one PostgreSQL container
- no existing Redis dependency or worker fleet

## Context

### Current production shape

The current deployment RFC and production Compose stack establish a simple single-node runtime:

- [`docker-compose.prod.yml`](../../../docker-compose.prod.yml) runs `caddy`, `backend`, and `db`
- [`backend/run.sh`](../../run.sh) starts a single `uvicorn` process
- [`Caddyfile`](../../../Caddyfile) currently handles TLS, headers, rate limiting, and reverse proxying
- scheduled jobs run via host `systemd`, not from inside the FastAPI process

This matters because process-local caching is materially more attractive when there is only one backend process serving traffic.

### Existing read behavior

The current backend already does some important things correctly:

- `/exercise-types` uses indexed sort paths in [`backend/src/exercises/models.py`](../../src/exercises/models.py)
- the list query is explicit and reasonably optimized in [`backend/src/exercises/crud.py`](../../src/exercises/crud.py)
- the frontend already uses TanStack Query with a 5 minute default `staleTime` in [`pe-be-tracker-frontend/src/app/providers/AppProviders.tsx`](../../../pe-be-tracker-frontend/src/app/providers/AppProviders.tsx)

So this is not an RFC about fixing a catastrophic query. It is about reducing repeated backend and database work across users and across page loads on a small VPS.

### Why `/exercise-types` is a special case

`GET /api/v1/exercises/exercise-types/` is not a perfectly static taxonomy endpoint.

Important details from the current code:

- the route allows optional auth in [`backend/src/exercises/router.py`](../../src/exercises/router.py)
- visibility depends on whether the caller is anonymous, authenticated, or admin in [`backend/src/exercises/crud.py`](../../src/exercises/crud.py)
- `times_used` is incremented whenever a new exercise is created in [`backend/src/exercises/crud.py`](../../src/exercises/crud.py)
- the default frontend sort is `order_by=usage` in [`pe-be-tracker-frontend/src/features/exercises/pages/ExerciseTypesPage.tsx`](../../../pe-be-tracker-frontend/src/features/exercises/pages/ExerciseTypesPage.tsx)

That means:

- some variants are safely cacheable
- some variants are user-specific
- usage-sorted lists naturally become a little stale almost immediately under write activity

The caching strategy must therefore be selective and explicit.

## Goals

- Reduce repeated DB and serialization work for hot GET endpoints.
- Improve p95 and p99 response times for catalog-style reads.
- Keep the solution operationally appropriate for a single small VPS.
- Preserve current public routing through `app.example.com/api/...`.
- Avoid caching user-specific responses incorrectly.
- Keep a clean upgrade path if the backend later runs multiple processes or replicas.

## Non-Goals

- Caching every GET endpoint in the API
- Introducing a distributed task or event architecture
- Solving all database performance issues through caching
- Building a general-purpose cache framework before we know the hot routes
- Changing product behavior around draft or unreleased exercise types without an explicit product decision

## Decision

Adopt a phased strategy.

### Phase 1

Use two layers together:

1. HTTP cache semantics on safe responses
2. a small FastAPI process-local cache for the highest-traffic catalog GETs

Do this first for:

- anonymous or `released_only=true` variants of `/api/v1/exercises/exercise-types/`
- `/api/v1/exercises/muscle-groups/`
- `/api/v1/exercises/intensity-units/`
- `/api/v1/workouts/workout-types/`

### Phase 2

Introduce Redis only if at least one of these becomes true:

- the backend runs more than one worker or more than one instance
- process restarts cause unacceptable cache cold-start pain
- we need shared invalidation across processes
- we want Redis for multiple concerns at once, such as cache plus queue or shared rate-limit state

## Why This Is The Best Fit

### 1. The backend currently runs as one app process

[`backend/run.sh`](../../run.sh) starts a single `uvicorn` server. On that topology, an in-process cache is a real shared cache for all incoming requests, not just a per-worker fragment.

That sharply improves the cost-benefit ratio of a FastAPI-side cache.

### 2. Redis adds real operational and memory cost on a small VPS

The current production node already carries:

- Caddy
- FastAPI
- PostgreSQL
- Docker and host overhead

Postgres is also explicitly tuned in [`docker-compose.prod.yml`](../../../docker-compose.prod.yml) with fixed memory-related settings. Adding Redis means another always-on process competing for the same limited RAM and page cache headroom.

That is reasonable when Redis solves a real coordination problem. It is harder to justify when we only need a small amount of caching for a single app process.

### 3. HTTP semantics help even when server-side cache misses happen

Even with a server-side cache, correct `Cache-Control` and `ETag` or equivalent validators are still useful:

- browsers can avoid unnecessary refetches
- the frontend host or a future edge layer can honor those semantics
- we create a better path to later CDN or proxy caching

### 4. `/exercise-types` needs selective caching, not blanket caching

Because the route can include user-owned non-released exercise types, it is unsafe to treat every response as a public shared cache entry.

The safest first boundary is:

- cache public or `released_only=true` variants
- bypass or carefully scope user-specific variants

## Options Considered

## Option A: HTTP semantics only

Description:

- return `Cache-Control`
- optionally return `ETag` or `Last-Modified`
- let browsers and any future edge layer re-use responses

Pros:

- lowest complexity
- no new runtime service
- no server memory usage
- future-proofs the API for proxy or CDN caching

Cons:

- does not reduce the cost of first-hit requests
- does not help much when many users hit the same route from cold sessions
- current Caddy setup is not acting as a response cache

Decision:

- accept as necessary, but insufficient by itself

## Option B: FastAPI process-local cache

Description:

- add a small route-scoped TTL cache inside the backend process
- key entries by normalized query params and visibility scope
- keep invalidation explicit and narrow

Pros:

- strong fit for the current single-process backend
- no new infrastructure service
- lowest latency after warm-up
- removes repeated DB and serialization work across users
- easy to roll out incrementally route by route

Cons:

- cache is lost on deploy or restart
- cache is not shared if we later add more workers or instances
- invalidation logic lives in application code
- bad cache boundaries can leak personalized responses if implemented carelessly

Decision:

- accepted as the primary recommendation

## Option C: Redis on the VPS

Description:

- add Redis as a Compose service or host service
- store shared cache entries outside the FastAPI process

Pros:

- shared across restarts, workers, and replicas
- enables centralized invalidation
- can later support other patterns such as distributed locks, queues, or shared counters

Cons:

- more RAM pressure on a small VPS
- more operator surface area: health, persistence stance, security, backups, upgrades
- more moving parts in deploy and incident handling
- marginal benefit over in-process caching while we still run one backend process

Decision:

- rejected for the first rollout
- keep as the next step if scaling signals justify it

## Option D: Reverse-proxy cache on the VPS

Description:

- cache responses at the proxy layer rather than in FastAPI

Pros:

- can offload traffic before it reaches Python
- keeps cache concerns away from app code for purely public responses

Cons:

- current [`Caddyfile`](../../../Caddyfile) does not include response caching
- introducing proxy caching here would require extra Caddy customization or a different edge component
- user-specific visibility still makes `/exercise-types` tricky
- less natural place for app-aware invalidation

Decision:

- not recommended as the first move

Reason:

- the current stack is better served by app-aware caching plus correct HTTP headers

## Recommended Design

### 1. Define cacheable scopes explicitly

Cache only responses whose payload is independent of the caller's identity.

Phase 1 safe candidates:

- `GET /api/v1/exercises/exercise-types/` when `released_only=true`
- `GET /api/v1/exercises/exercise-types/` for anonymous callers
- `GET /api/v1/exercises/muscle-groups/`
- `GET /api/v1/exercises/intensity-units/`
- `GET /api/v1/workouts/workout-types/`

Phase 1 non-goals:

- authenticated `/exercise-types` responses that include owned draft or in-review exercise types
- endpoints with highly user-specific payloads

If the product wants aggressive caching for exercise-type browsing, the cleanest future improvement is to make the public released catalog an explicitly cacheable path or an explicitly cacheable frontend call shape.

### 2. Keep cache keys small and deterministic

For `/exercise-types`, key by:

- visibility scope: `public_released` vs `user_scoped_bypass`
- `order_by`
- `offset`
- `limit`
- `muscle_group_id`
- `name` when search caching is enabled

Initial guidance:

- cache non-search list pages first
- do not cache free-text search in the first rollout unless metrics show repeated hot queries

Reason:

- free-text search has higher key cardinality
- current fuzzy matching work is real CPU, but cache explosion is also real

### 3. Use short TTLs where writes are frequent

Suggested starting TTLs:

- `/exercise-types` with `order_by=usage`: 30 to 60 seconds
- `/exercise-types` with `order_by=name`: 5 to 15 minutes
- muscle groups, intensity units, workout types: 1 to 24 hours depending on change frequency

Important nuance:

- `times_used` changes on exercise creation, so usage-sorted results should prefer short TTL over expensive write-through invalidation on every workout action

### 4. Add HTTP response headers alongside the app cache

Suggested starting semantics:

- public catalog pages: `Cache-Control: public, max-age=60, stale-while-revalidate=120`
- slow-changing taxonomies: `Cache-Control: public, max-age=3600`
- user-scoped responses: `Cache-Control: private, no-store` unless a safer variant is explicitly defined

For validators:

- add `ETag` or `Last-Modified` where the implementation is straightforward
- do not delay rollout if validator generation becomes the long pole

The point of phase 1 is to reduce backend load safely, not to build a perfect HTTP caching system before shipping.

### 5. Invalidate where content actually changes

Explicit invalidation should happen on mutations that change catalog content, such as:

- create exercise type
- update exercise type
- request evaluation
- release exercise type from admin flows
- any future mutation of muscle groups, intensity units, or workout types

For usage-sorted exercise-type lists:

- do not invalidate on every exercise creation in phase 1
- rely on the short TTL

This keeps the write path simple and avoids turning every exercise write into cache coordination work.

### 6. Instrument the cache from day one

Track at minimum:

- cache hit count
- cache miss count
- cache bypass count
- per-route latency before and after rollout
- DB query duration for hot routes
- serialization duration for hot routes
- key count and approximate cache size

This repo already uses OpenTelemetry and request logging, so cache instrumentation should feed the same observability path rather than inventing a separate monitoring island.

## Implementation Notes

### FastAPI-side approach

Prefer a small internal cache abstraction over a broad magic decorator rollout.

Reasons:

- cacheability depends on auth scope and query shape
- invalidation needs to be explicit
- only a few routes are in scope initially

A thin cache service can provide:

- `get(key)`
- `set(key, value, ttl_seconds)`
- `delete_many(prefix or tag)`
- optional per-key request coalescing to avoid dogpiles on misses

This can be implemented without introducing Redis first.

### Avoid relying on transitive dependencies

If we use an in-process cache helper library, add it explicitly to the backend dependencies. Do not quietly rely on packages that happen to appear transitively in `uv.lock`.

### Caddy remains complementary

[`Caddyfile`](../../../Caddyfile) already rate-limits public reads. Caching should complement that edge behavior, not replace it.

This RFC does not require Caddy response caching in the first rollout.

## Rollout Plan

1. Instrument the current hot GET routes with route-local timing so we know the baseline.
2. Add HTTP cache headers for the clearly safe catalog endpoints.
3. Add a small FastAPI cache for:
   - anonymous or release-only `/exercise-types`
   - muscle groups
   - intensity units
   - workout types
4. Verify no authenticated draft-inclusive responses are entering the shared cache path.
5. Measure hit rate, latency, DB load, and memory impact on the VPS.
6. Revisit Redis only if the measurements justify the extra service.

## Phase 1 Verification

After deploy, operators should be able to verify phase 1 behavior with repeated requests against the public origin.

Examples:

```bash
curl -I "https://app.example.com/api/v1/exercises/exercise-types/?released_only=true&order_by=usage&offset=0&limit=100"
curl -I "https://app.example.com/api/v1/exercises/muscle-groups/"
curl -I "https://app.example.com/api/v1/exercises/intensity-units/"
curl -I "https://app.example.com/api/v1/workouts/workout-types/"
```

Expected signals:

- first request should normally return `X-Cache-Status: MISS`
- repeated request inside the TTL should return `X-Cache-Status: HIT`
- cacheable responses should include `Cache-Control`
- cacheable responses should include `ETag`
- repeating a request with `If-None-Match` should return `304 Not Modified`
- authenticated default `/exercise-types/` should stay `X-Cache-Status: BYPASS` with `Cache-Control: private, no-store`

## Consequences

### Positive

- lower read load on PostgreSQL
- lower Python serialization overhead on repeated list requests
- better response times for hot catalog pages
- minimal infrastructure change
- a clean migration path to Redis later

### Negative

- some cached data will be intentionally a little stale
- cache invalidation logic becomes part of application behavior
- an eventual move to multiple workers or replicas will weaken the value of process-local caching

## When To Move To Redis

Move from process-local cache to Redis when one or more of these are true:

- we run multiple backend workers or multiple backend containers
- we need cache entries to survive routine restarts
- we need cross-process cache invalidation
- cache hit rates are good enough that a shared cache would produce meaningful additional savings
- Redis is already justified by another production need

Until then, Redis is more architecture than benefit for this repo's current deployment model.

## Final Recommendation

Ship phase 1 first:

- correct HTTP cache headers
- a small FastAPI process-local cache
- narrow cacheability rules focused on public or release-only catalog GETs
- short TTLs for usage-sorted exercise types
- explicit invalidation for catalog mutations

Do not add Redis yet.

On the current single-VPS, single-backend-process deployment, that gives the highest return for the lowest operational cost while keeping a clean upgrade path if traffic or topology later justifies shared cache infrastructure.
