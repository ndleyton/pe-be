## Local‑first Guest Store modernization plan

### Objectives
- Build a resilient, scalable, and testable offline‑first architecture.
- Preserve instant, optimistic UX; prevent data loss/duplication.
- Centralize and simplify sync; remove legacy duplication.

## Phase 0 — Consolidation and cleanup
- Remove `GuestDataContext` and migrate usages to `useGuestStore`.
  - Move shared types to `src/shared/types/guest.ts`.
  - Update `syncGuestData.ts` to import types from the new module.
- Standardize API routes via `src/shared/api/endpoints.ts` only.
- Replace `alert` in `syncGuestData.ts` with app toast/notification system.
- Reduce seed payload size in `useGuestStore` to a minimal starter set; remove hardcoded non‑UUID IDs (e.g., `'8'`).

## Phase 1 — Schema versioning and validation
- Introduce `schemaVersion` and `zod` validation for persisted state.
- Write explicit migrations (v1 → v2 → …) for structural changes (e.g., adding `recipes`, splitting slices, normalizing).
- On load: validate, migrate, and only then hydrate the store.

## Phase 2 — Normalize state
- Replace denormalized arrays with entity slices:
  - `workouts: { byId, allIds }`
  - `exercises: { byId, allIds }`
  - `exerciseSets: { byId, allIds }`
  - `exerciseTypes: { byId, allIds }`
  - `workoutTypes: { byId, allIds }`
- Reference by ID only; create selectors to recompose views for UI.
- Move “derived” fields (e.g., `times_used`) to selectors or maintain via hooks, not persisted.

## Phase 3 — IndexedDB persistence
- Replace localStorage with IndexedDB:
  - Use `zustand` `persist` with a custom IDB adapter (Dexie or `idb-keyval`).
  - Persist per-slice to reduce write amplification.
  - Add write debouncing (e.g., 100–300 ms) to avoid hot loops on rapid edits.
- Implement safe load/hydrate path with schema validation + migrations.

## Phase 4 — Outbox and idempotent sync
- Add `guestOutbox` for all offline mutations:
  - Each op: `{ id, operation, entity, payload, createdAt, dependsOn?, idempotencyKey }`
  - Use `uuidv7` or `ulid` for sortable, collision‑safe IDs.
- Sync flow:
  - Single orchestrator drains the outbox FIFO with backoff + jitter.
  - Use idempotency keys (`X-Idempotency-Key` or `client_generated_id`) on POSTs.
  - On success: store server IDs in a mapping table (`clientId -> serverId`) and remove only acked ops.
  - On partial failure: keep failed ops, continue with others; never clear the entire guest store.
- Conflict policy:
  - Creates are idempotent via client IDs.
  - Updates/deletes use last‑write‑wins or version preconditions if available; surface conflicts with a small UI badge and allow user to retry.

### Optimistic updates (crucial)
- Apply UI changes immediately on mutation:
  - Update local entities first, then enqueue an outbox op for the same mutation.
  - Annotate entities with `syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted'`.
  - In UI, show subtle pending indicators and a “retry” affordance on failed items.
- ID mapping:
  - Use client IDs for local references; when the server returns a server ID, update the mapping and migrate references lazily via selectors (selectors resolve to server IDs if available).
- Reconciliation:
  - If server rejects a mutation with a resolvable change, update local state accordingly and mark `synced`.
  - If irreconcilable, mark `conflicted` and prompt the user to resolve.

## Phase 5 — Single sync orchestrator
- Introduce `src/sync/SyncManager.ts`:
  - The only component that drains the outbox and coordinates sync.
  - Triggers: app start, auth ready, `online` event, `visibilitychange` (visible), manual “Sync now”.
  - Concurrency limits (e.g., 2–4 inflight ops), backoff strategy, and cancellation on `offline`.
- Update `StoreInitializer` to initialize the manager and remove direct sync calls.
- Remove duplication in `OAuthCallbackPage`; delegate to the manager.

## Phase 6 — Multi‑tab coordination
- Use `BroadcastChannel` to ensure a single active sync leader (or `navigator.locks` where supported).
- Share “outbox changed” and “sync status” events.
- Avoid duplicate drainers across tabs.

## Phase 7 — Background sync and caching
- Add a service worker (Workbox):
  - Precache static assets; runtime cache API GETs with stale‑while‑revalidate.
  - Use Background Sync API to flush the outbox when network returns (progressive enhancement).
- Respect user data limits; cap queue size with a clear UX to manage large backlogs.

## Phase 8 — API contract hardening
- Ensure endpoints accept idempotency keys or client‑generated IDs for creates; return server IDs.
- Return 409/412 for precondition failures where possible.
- Standardize all routes via `endpoints.*` (remove manual `'/workouts/'` with inconsistent slashes).

## Phase 9 — UX polish
- Replace `alert` with toasts and inline banners.
- Add unobtrusive indicators for `pending/failed/conflicted` items and a global “Syncing…” status with counts.
- Add a manual “Sync now” and “View sync log” for power users.

## Phase 10 — Testing and observability
- Unit tests:
  - Migrations, schema validation, outbox enqueue/dequeue, ID mapping, conflict handling.
- Integration tests:
  - Offline/online transitions, OAuth callback path, multi‑tab leader election, background sync.
- E2E:
  - Guest flow with large edits offline, sign‑in, sync, reconciliation.
- Telemetry (PostHog):
  - Track outbox depth, success/failure rates, sync durations, conflicts.

## Migration plan
- v1: Introduce schemaVersion + zod; keep localStorage; deprecate context; unify endpoints and toasts.
- v2: Add outbox + single orchestrator; stop clearing guest data; enable optimistic statuses.
- v3: Migrate storage to IndexedDB; normalize slices; write migration to transform existing blob to IDB.
- v4: Multi‑tab + background sync; expand tests; trim seed data.

## Acceptance criteria
- Edits reflect instantly while offline; items show `pending` state.
- After sign‑in, data syncs once via the orchestrator; no duplicates on retries.
- Killing the tab mid‑sync resumes cleanly; partial successes persist.
- Multi‑tab sessions don’t double‑sync; only one tab drains the outbox.
- No main‑thread jank on large datasets; persistence happens via IDB.

## File‑level changes (high level)
- `src/stores/useGuestStore.ts`: normalize slices, add `syncStatus` flags, enqueue outbox ops; remove localStorage writes.
- `src/sync/SyncManager.ts`: new orchestrator; hooks for triggers, backoff, progress.
- `src/shared/api/client.ts`: add idempotency header support.
- `src/utils/syncGuestData.ts`: convert to op‑driven sync; no full‑clear; use `endpoints.*`.
- `src/stores/StoreInitializer.tsx` and `features/auth/pages/OAuthCallbackPage.tsx`: delegate sync to `SyncManager`, remove direct calls.
- New: `src/shared/persistence/indexedDb.ts`, `src/shared/types/guest.ts`, `src/shared/migrations/guest/*`.

### Minimal API example (idempotency key)
```ts
await api.post(endpoints.workouts, payload, {
  headers: { 'X-Idempotency-Key': op.idempotencyKey },
});
```

### Minimal outbox op shape
```ts
type OutboxOp = {
  id: string; // uuidv7/ulid
  operation: 'create' | 'update' | 'delete';
  entity: 'workout' | 'exercise' | 'exerciseSet' | 'exerciseType' | 'workoutType';
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string; // ISO
  dependsOn?: string; // e.g., exercise depends on workout create
};
```

- Optimistic application: update store immediately, enqueue `OutboxOp`, mark entity `syncStatus='pending'`. Reconcile or mark `failed` based on server result.

- Conflict display: if server rejects, set `syncStatus='conflicted'` and surface a small “Resolve” banner on the item.

- Mapping table: `{ clientId: string, serverId: number }` used by selectors to resolve references seamlessly.

- Multi‑tab guard: `BroadcastChannel('sync')` + simple leader election to ensure single drain.

- Background sync: register a tag to retry flush when the network is restored.

- Storage: implement a custom `persist` storage interface for IDB to persist each slice and the outbox independently.

- Seed trimming: keep only a few high‑value defaults; lazy‑load extended examples on demand.

- Performance: debounce persistence writes; avoid serializing entire graphs; avoid deep cloning in reducers.

- Security: avoid storing secrets; PII minimal; timestamps are UTC ISO only.

- Observability: PostHog events for `sync_start`, `sync_op_success`, `sync_op_failed`, `sync_complete` with counts and durations.

- Documentation: README section on offline behavior, sync guarantees, and conflict resolution.

- Rollout: behind a feature flag for a subset of users; log metrics; then remove legacy code.

- Checklist for done:
  - One sync path (no OAuth page duplicate).
  - No full clear on sync.
  - IndexedDB in use.
  - Outbox drains idempotently.
  - Tests for offline/online and conflicts are green.

- Risks:
  - API must support idempotency. Mitigate by adding `client_generated_id` fields if headers aren’t available.
  - Migration correctness. Mitigate with snapshot/backups and reversible migrations.

- Timeline (suggested):
  - Weeks 1–2: Phases 0–2.
  - Weeks 3–4: Phases 3–4.
  - Week 5: Phases 5–6.
  - Week 6: Phase 7–10, rollout and hardening.


- Consolidated a phased plan to modernize `useGuestStore` to a robust local‑first model.
- Key changes: normalize state, move to IndexedDB, add an outbox with idempotent sync, single orchestrator, multi‑tab safety, background sync, schema migrations, and optimistic UI with status flags.