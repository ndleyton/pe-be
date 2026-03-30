# RFC 0004: Guest Store Value Without Offline Support

- Status: Proposed
- Date: 2026-03-30
- Owners: Frontend, Product

## Summary

The current guest store is delivering real product value, but that value is mostly about **reducing signup friction** and **preserving local trial data on one device**. It is not delivering a complete offline or PWA experience.

This RFC recommends that we treat the guest store as a **guest trial mode**, not as offline infrastructure.

Concretely:

1. Keep guest mode only if we still believe "try before signup" is important to acquisition and conversion.
2. Stop using "offline/PWA" as the justification for keeping the current implementation.
3. If we keep it, simplify and harden it around its real job: local unauthenticated usage plus safe account conversion.
4. If acquisition data does not justify the ongoing complexity, remove it entirely instead of carrying a half-offline architecture.

## Context

The frontend has a large, explicit guest-mode implementation:

- `useGuestStore` persists workouts, exercise types, workout types, and routines locally in IndexedDB with localStorage fallback.
- Guest mode seeds starter workout types, exercise types, and routines on first use.
- Multiple pages branch between guest-local state and authenticated server state.
- OAuth callback and post-login initialization attempt to synchronize guest data into an authenticated account.

At the same time, the app does not currently implement the rest of what users usually mean by "offline app":

- there is a web manifest in `pe-be-tracker-frontend/public/manifest.json`
- there is no evident service-worker registration or workbox/vite-pwa integration in the frontend package setup
- app startup still depends on auth initialization against `/users/me`
- authenticated mode remains directly network-backed through Axios and React Query

So the guest store should be evaluated on the value it actually provides today, not on the offline value it was originally meant to support.

## What The Guest Store Clearly Brings

### 1. Lower signup friction

The landing page explicitly offers `Try as Guest`, which makes the app usable before auth and creates a cleaner top-of-funnel than "sign in first."

This is real value if the product strategy is:

- let users feel progress before asking for commitment
- convert local progress into a reason to create an account
- reduce abandonment from first-session auth friction

Relevant code:

- `pe-be-tracker-frontend/src/App.tsx`
- `pe-be-tracker-frontend/src/shared/components/feedback/GuestModeBanner/GuestModeBanner.tsx`

### 2. Same-device persistence without an account

Guest data is persisted locally through IndexedDB, with localStorage fallback. That means a user can refresh the tab, close the browser, and return later on the same device without losing their guest workouts and routines.

This is the strongest technical value the guest store currently provides.

Relevant code:

- `pe-be-tracker-frontend/src/stores/useGuestStore.ts`
- `pe-be-tracker-frontend/src/stores/indexedDBStorage.ts`

### 3. Immediate time-to-value with seeded data

Guest mode does not start empty. It seeds exercise types, workout types, and starter routines, so an unauthenticated user can begin interacting with the product without waiting for server data or creating a setup baseline manually.

That reduces blank-screen energy in the first session.

Relevant code:

- `pe-be-tracker-frontend/src/stores/useGuestStore.ts`
- `pe-be-tracker-frontend/src/stores/seeds/exerciseTypes.ts`
- `pe-be-tracker-frontend/src/stores/seeds/workoutTypes.ts`
- `pe-be-tracker-frontend/src/stores/seeds/routines.ts`
- `pe-be-tracker-frontend/src/features/routines/components/RoutinesSection/RoutinesSection.tsx`

### 4. A working guest-only workout and routine flow

The guest store is not just a small cache. It supports meaningful unauthenticated CRUD:

- create and edit workouts
- add exercises and sets
- create exercise types
- create, edit, and start routines
- render profile/workout summaries from local data

That means the guest experience is substantial enough to function as a real product trial, not just a fake demo.

Relevant code:

- `pe-be-tracker-frontend/src/features/workouts/components/WorkoutForm/WorkoutForm.tsx`
- `pe-be-tracker-frontend/src/features/workouts/pages/WorkoutPage.tsx`
- `pe-be-tracker-frontend/src/features/exercises/components/ExerciseTypeModal/ExerciseTypeModal.tsx`
- `pe-be-tracker-frontend/src/features/routines/hooks/useRoutineDetailsActions.ts`
- `pe-be-tracker-frontend/src/features/profile/pages/ProfilePage.tsx`

### 5. An upsell path that turns local progress into account creation pressure

The product copy is already using guest mode as an upsell:

- local-only storage is made visible
- workout count is surfaced
- the user is reminded that sign-in syncs data across devices and makes it permanent

This matches your current observation: the feature has become an account-conversion mechanism, even if it started as an offline idea.

Relevant code:

- `pe-be-tracker-frontend/src/App.tsx`
- `pe-be-tracker-frontend/src/shared/components/feedback/GuestModeBanner/GuestModeBanner.tsx`
- `pe-be-tracker-frontend/src/features/profile/pages/ProfilePage.tsx`

## What The Guest Store Does Not Bring

### 1. It does not make the app a true offline app

The repo currently shows a manifest, but not the infrastructure that would make offline a product guarantee:

- no service-worker registration
- no cached API or route shell strategy
- no offline mutation queue for authenticated data
- no explicit reconnect/replay model

This means the guest store should not be treated as equivalent to offline support.

Relevant code:

- `pe-be-tracker-frontend/public/manifest.json`
- `pe-be-tracker-frontend/package.json`

### 2. It does not make startup fully offline-first

The landing experience waits for auth initialization before rendering the home screen, and auth initialization calls `/users/me`.

That means even the pre-login experience still assumes networked auth probing during startup.

Relevant code:

- `pe-be-tracker-frontend/src/App.tsx`
- `pe-be-tracker-frontend/src/stores/useAuthStore.ts`
- `pe-be-tracker-frontend/src/stores/StoreInitializer.tsx`

### 3. It does not provide cross-device safety until conversion succeeds

Guest data is device-local by design. If the user changes devices, clears browser storage, or uses private browsing with ephemeral storage, the data is gone unless account sync has already succeeded.

This is not backup. It is local persistence.

### 4. It does not currently provide a fully reliable guest-to-account migration

The sync path has real limitations:

- post-login sync is gated on `workouts.length > 0`, so routines-only guest data can be skipped during OAuth callback
- background sync in `useGuestStore.syncWithServer` also exits early when there are no workouts
- sync clears guest data at the end even though workout/exercise/set/routine failures are handled by logging and continuing
- routine sync fabricates a default `"Strength"` workout type because guest routines do not retain enough server-compatible typing information

So the current implementation is better described as "best-effort import" than "robust account migration."

Relevant code:

- `pe-be-tracker-frontend/src/features/auth/pages/OAuthCallbackPage.tsx`
- `pe-be-tracker-frontend/src/stores/useGuestStore.ts`
- `pe-be-tracker-frontend/src/utils/syncGuestData.ts`

### 5. It does not reduce frontend complexity

Guest mode now cuts across a large part of the frontend. In current source, there are roughly 150+ non-test references to guest-store types, hooks, or sync helpers.

That complexity shows up as:

- duplicate authenticated vs guest branches
- separate data models and ID shapes
- extra hydration concerns
- guest-specific test fixtures and tests
- extra migration and sync code

This is the main cost of keeping the feature.

## Benefits Versus Costs

### Benefits

- Better first-session onboarding
- Local persistence on the same device
- No-account product trial
- A credible upsell path into account creation

### Costs

- Large branching surface in the frontend
- Ongoing sync correctness risk
- Two mental models for data: server and guest
- User expectations risk if "guest mode" is interpreted as "offline-safe"
- Engineering effort spent on a partial offline architecture instead of either full offline support or a simpler auth-first product

## Options Considered

### Option A: Keep the current guest store as-is

Pros:

- no migration work
- preserves current onboarding flow
- keeps local trial experience

Cons:

- continues carrying complexity without a clean product framing
- continues overstating offline implications
- leaves sync reliability issues in place

Decision:

- reject

### Option B: Keep guest mode, but explicitly redefine it as local trial mode

Description:

- keep the ability to use the app before signup
- keep local persistence on one device
- stop positioning this as offline/PWA architecture
- harden sync correctness
- narrow scope where possible

Pros:

- preserves the likely acquisition benefit
- aligns product language with actual behavior
- gives engineering permission to simplify instead of pretending we are building offline-first

Cons:

- still carries a meaningful maintenance burden
- still requires ongoing dual-path testing

Decision:

- recommended if guest conversion matters

### Option C: Remove guest mode and require auth

Pros:

- simplest architecture
- single source of truth
- less branching, less sync risk, fewer edge cases

Cons:

- higher first-session friction
- loses the current try-before-signup motion
- may reduce conversion if guest trial is actually helping

Decision:

- recommended only if product data shows guest mode is not materially helping acquisition or activation

### Option D: Build real offline support

Description:

- add service worker
- cache route shell and critical assets
- define offline read/write behavior explicitly
- introduce mutation queue/replay/reconciliation
- decide what authenticated offline means

Pros:

- fulfills the original architectural goal
- creates a coherent offline-first story

Cons:

- much more engineering work
- harder correctness problems
- probably not justified unless offline is a strategic differentiator

Decision:

- reject for now

## Recommendation

Adopt **Option B** by default:

1. Keep guest mode only as a product-led onboarding and conversion feature.
2. Reframe it internally and externally as **local guest mode**, not offline mode.
3. Fix the current migration risks before investing further in guest features.
4. Re-evaluate removal only after looking at funnel data for:
   - guest entry rate
   - guest-to-signup conversion
   - retained usage among guests
   - failure rate during guest sync

If product analytics show weak conversion value, the right move is probably not to improve offline support. It is to remove guest mode and simplify the app.

## Near-Term Follow-Up

If we keep guest mode, the next engineering steps should be:

1. Fix routines-only sync so guest data sync does not depend on workouts existing.
2. Do not clear guest data after partial sync failures.
3. Decide the exact product language:
   - "stored on this device"
   - "not backed up until you sign in"
   - avoid implying true offline support
4. Measure the funnel before doing more guest-mode expansion.
5. Consider narrowing guest scope if we want less maintenance:
   - keep workout logging
   - keep routine quick-start
   - drop lower-value guest customization paths if they do not improve conversion

## Open Questions

- What percentage of first-time users choose `Try as Guest`?
- What percentage of guest users later create an account?
- How many users are creating meaningful guest data and never converting?
- Are we seeing support issues caused by users assuming guest mode is backed up or available offline?
- Is the product strategy actually auth-first now, with guest mode only as a fallback?

## Appendix: Codebase Signals Behind This RFC

- Guest persistence and hydration live in `pe-be-tracker-frontend/src/stores/useGuestStore.ts` and `pe-be-tracker-frontend/src/stores/indexedDBStorage.ts`.
- Guest mode seeds starter data in `pe-be-tracker-frontend/src/stores/seeds/`.
- The guest CTA and conversion language live in `pe-be-tracker-frontend/src/App.tsx`, `pe-be-tracker-frontend/src/shared/components/feedback/GuestModeBanner/GuestModeBanner.tsx`, and `pe-be-tracker-frontend/src/features/profile/pages/ProfilePage.tsx`.
- Guest-mode branching appears across workouts, exercises, routines, and profile flows.
- The repo currently includes a manifest in `pe-be-tracker-frontend/public/manifest.json`, but the frontend package setup does not show service-worker/PWA tooling.
