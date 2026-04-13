# RFC 0002: Standardize Google OAuth Sign-In Around a Backend-Owned Flow

- Status: Proposed
- Date: 2026-04-13
- Owner: Engineering

## Summary

Standardize Google sign-in on a single OAuth model:

- Google redirects only to the backend callback at `/api/v1/auth/google/callback`
- the backend performs the authorization-code exchange, user lookup/creation, and session cookie issuance
- after successful login, the backend redirects the browser to a frontend completion route
- the frontend completion route performs client-side post-login work only:
  - refresh auth state
  - run guest-data sync
  - consume the stored post-login destination
  - navigate to the final in-app page

This RFC intentionally removes the current split-brain behavior where the backend is configured for a backend-owned callback while the frontend also tries to act like the OAuth code receiver.

## Context

The current implementation mixes two mutually exclusive OAuth completion strategies.

### Current backend behavior

The backend mounts FastAPI Users' generated Google OAuth router in [`backend/src/users/router.py`](../../backend/src/users/router.py) and passes `redirect_url=settings.GOOGLE_REDIRECT_URI`.

The configured default redirect URI in [`backend/src/core/config.py`](../../backend/src/core/config.py) is:

- `http://localhost:8000/api/v1/auth/google/callback`

The production deployment RFC in [`backend/docs/rfcs/0002-single-vps-hetzner-deployment.md`](../../backend/docs/rfcs/0002-single-vps-hetzner-deployment.md) likewise documents the public Google callback as:

- `https://app.example.com/api/v1/auth/google/callback`

FastAPI Users' generated `/auth/google/callback` route is a `GET` handler that:

- receives Google's `code`
- exchanges it for tokens
- finds or creates the user
- calls the auth backend login transport
- returns the auth backend's response

In this repository, the auth transport in [`backend/src/core/security.py`](../../backend/src/core/security.py) is `CookieTransportWithRedirect`, which sets the session cookie and returns a `302` redirect to the frontend.

### Current frontend behavior

The frontend also defines a route at `/oauth/callback` in [`pe-be-tracker-frontend/src/routes.tsx`](../../pe-be-tracker-frontend/src/routes.tsx) and a page component in [`pe-be-tracker-frontend/src/features/auth/pages/OAuthCallbackPage.tsx`](../../pe-be-tracker-frontend/src/features/auth/pages/OAuthCallbackPage.tsx).

That page currently expects to:

- receive Google's `code` in the browser URL
- `POST` `{ code }` to `/auth/google/callback`
- rely on that request to complete login

That is not compatible with the backend-owned flow above:

- the backend callback route is generated as `GET`, not a JSON `POST`
- the documented callback URI points Google to the backend, not the SPA
- the backend already redirects to the frontend after login

### Product impact today

Under the documented configuration, the frontend callback page is effectively dead code for OAuth completion.

That mismatch has at least one live user-facing consequence:

- the stored post-login destination is currently consumed in the frontend callback page, but that page is bypassed by the backend-owned flow, so users do not reliably return to the intended `next` destination after Google sign-in

Guest sync is less severe because the app also has a store-level authenticated sync path in [`pe-be-tracker-frontend/src/stores/StoreInitializer.tsx`](../../pe-be-tracker-frontend/src/stores/StoreInitializer.tsx), but the current design is still confusing and error-prone.

## Goals

- Use one idiomatic OAuth ownership model for Google sign-in.
- Preserve the current public deployment contract:
  - frontend on `app.example.com`
  - browser-visible API on `app.example.com/api/...`
  - Google callback at `app.example.com/api/v1/auth/google/callback`
- Keep session creation on the backend, using the existing cookie transport.
- Restore reliable post-login destination handling.
- Keep guest-data sync after login.
- Remove misleading code, comments, and endpoint usage from the frontend.

## Non-goals

- Replacing FastAPI Users with a custom OAuth stack.
- Moving auth to a token-in-localStorage model.
- Changing the public browser-visible API host away from `app.example.com/api/...`.
- Adding provider-agnostic SSO abstractions beyond what is needed for Google.
- Reworking general session management outside the Google sign-in flow.

## Decision

Adopt a backend-owned OAuth code flow and make the frontend route a post-login completion page, not an OAuth callback.

### End-state flow

1. The user starts sign-in from the frontend.
2. The frontend calls `GET /auth/google/authorize`.
3. The backend returns the Google authorization URL.
4. The browser navigates to Google.
5. Google redirects to the backend callback:
   - `/api/v1/auth/google/callback`
6. The backend exchanges the code, authenticates the user, and sets the session cookie.
7. The backend redirects the browser to a frontend completion route:
   - recommended final route: `/auth/complete`
8. The frontend completion page:
   - refreshes auth state via `/auth/session`
   - syncs guest data if needed
   - consumes the persisted post-login destination
   - navigates to that destination or the default app landing page

### Naming decision

The frontend route should not be called `callback` in the end state, because it is not the OAuth callback. It is the page the app lands on after the backend has already completed authentication.

Recommended naming:

- backend callback: `/api/v1/auth/google/callback`
- frontend completion route: `/auth/complete`

If the team wants the smallest possible first step, the existing `/oauth/callback` route can be reused temporarily as the frontend completion page. Even in that transitional state, it must stop reading `code` from the URL and must stop posting to `/auth/google/callback`.

## Why this approach

### 1. It matches the current auth architecture

This app already uses backend-issued session cookies with `withCredentials: true`. In that architecture, the backend is the right place to:

- hold OAuth client credentials
- exchange the authorization code
- create the session
- set the auth cookie

Trying to make the SPA also behave like the OAuth code receiver adds an unnecessary second completion mechanism.

### 2. It matches the current deployment model

The existing deployment guidance already assumes the Google callback lives under:

- `https://app.example.com/api/v1/auth/google/callback`

That is the right public callback for the current same-host browser contract and rewrite-based deployment. This RFC preserves that shape.

### 3. It restores a clear separation of concerns

After this change:

- backend callback responsibilities are security- and identity-related
- frontend completion responsibilities are UI- and client-state-related

That separation is easier to reason about, test, and document.

### 4. It fixes the current `next` redirect gap without overcomplicating OAuth state

The repository already has a frontend helper for persisting post-login destination in session storage via [`pe-be-tracker-frontend/src/features/auth/lib/postLoginRedirect.ts`](../../pe-be-tracker-frontend/src/features/auth/lib/postLoginRedirect.ts).

That is sufficient for the current product need:

- persist `next` before leaving for Google
- consume it on the frontend completion page after login

This avoids unnecessary customizations to FastAPI Users' OAuth state handling in the first pass.

## Rejected alternatives

### Alternative A: Make the SPA own the callback and code exchange

Rejected.

This would require the frontend to receive Google's `code` directly and then send it to a custom backend endpoint for completion. That is a reasonable pattern in some architectures, but it is the wrong fit here because:

- the app already uses backend-managed session cookies
- FastAPI Users already provides a backend-owned callback route
- it would force custom backend work for little product benefit
- it would diverge from the deployment RFC and current public callback configuration

### Alternative B: Keep the backend-owned callback and redirect directly to the final page

Partially rejected.

Redirecting straight from the backend callback to `/workouts` works for basic authentication, but it leaves no explicit frontend place to:

- show sign-in completion state
- consume the stored post-login destination
- run guest sync in a user-visible way

The app could rely only on background store initialization, but that makes the post-login experience less explicit and keeps destination handling scattered. A dedicated frontend completion route is clearer.

### Alternative C: Encode the final destination into OAuth state in the backend

Deferred.

This is a valid future enhancement, but it is not required to fix the current inconsistency. The repo already has client-side persistence for `next`, and using that first keeps the migration small.

If the team later needs server-validated destination handling for more complex entry points, that can be a follow-up RFC or implementation task.

## Proposed implementation

### Frontend

1. Replace the current `OAuthCallbackPage` behavior.

The frontend completion page should:

- stop reading `code` and `error` as if it were the Google callback receiver
- stop calling `POST /auth/google/callback`
- refresh auth state through the existing auth store
- wait for the authenticated session to be visible
- trigger guest sync if applicable
- consume the persisted post-login destination
- navigate to the destination or fallback route

2. Rename or repurpose the route.

Recommended end state:

- route path: `/auth/complete`
- component name: `AuthCompletionPage` or `PostLoginPage`

Migration-friendly interim state:

- keep `/oauth/callback` wired temporarily
- change its behavior to completion-only
- add `/auth/complete`
- switch the backend redirect target to `/auth/complete`
- remove `/oauth/callback` after the frontend rollout settles

3. Remove frontend references to the backend callback as an API endpoint.

Specifically:

- remove `endpoints.auth.googleCallback` from [`pe-be-tracker-frontend/src/shared/api/endpoints.ts`](../../pe-be-tracker-frontend/src/shared/api/endpoints.ts) unless another real frontend call still needs it
- update misleading comments in the Google sign-in hook and button
- update tests that assume Google returns to the SPA callback route

### Backend

1. Keep the Google redirect URI pointed at the backend callback.

The desired callback remains:

- local: `http://localhost:8000/api/v1/auth/google/callback`
- production: `https://app.example.com/api/v1/auth/google/callback`

2. Change the post-login frontend redirect target.

Update `FRONTEND_POST_LOGIN_PATH` so successful login redirects to the frontend completion route instead of directly to `/workouts`.

Recommended value:

- `FRONTEND_POST_LOGIN_PATH=/auth/complete`

3. Do not add a second custom code-exchange endpoint.

There should be one OAuth completion path for Google sign-in:

- the generated backend callback route

## Rollout plan

### Phase 1: Align code with the chosen flow

- add the frontend completion route
- update the completion page to use session refresh instead of code exchange
- point `FRONTEND_POST_LOGIN_PATH` at the completion route
- remove frontend API usage of `/auth/google/callback`

### Phase 2: Update tests and docs

- update frontend unit tests for the completion page
- update Playwright coverage for the Google sign-in intent flow
- update code comments that currently say Google returns to `/oauth/callback`
- update deployment and environment docs if they mention the frontend callback as the OAuth receiver

### Phase 3: Clean up transitional aliases

If `/oauth/callback` is kept as a temporary alias:

- remove it after the new completion route is stable
- remove any remaining naming that implies the SPA receives Google's callback

## Testing strategy

### Frontend unit and integration coverage

- completion page redirects to login or error state if auth session does not materialize
- completion page consumes stored destination and navigates correctly
- completion page triggers guest sync after authenticated session is available
- login flow persists the `next` destination before starting Google sign-in

### Frontend end-to-end coverage

- starting from `/login?auth_intent=google&next=/about` persists the intended destination
- after the backend-managed login completes, the app lands on the frontend completion route
- the completion route sends the user to `/about`

### Backend validation

- verify the Google callback route remains `GET`-based and backend-owned
- verify successful OAuth login returns a redirect response that sets the session cookie
- verify `FRONTEND_POST_LOGIN_PATH` is honored by the login transport

## Risks and mitigations

### Risk: Temporary confusion during migration

If the team changes the backend redirect before updating the frontend route, users may land on a missing or incomplete completion page.

Mitigation:

- ship the frontend completion route before or alongside the backend redirect-path change

### Risk: Login appears successful before auth state refresh completes

The backend sets the cookie during the redirect response, but the frontend still needs to refresh `/auth/session` before assuming the app is authenticated.

Mitigation:

- make the completion page explicitly wait for auth refresh before navigating away

### Risk: Guest sync duplicates or races with store-level sync

The app already has store-level sync on authenticated user initialization.

Mitigation:

- consolidate on one clear completion-page-triggered path or make the page use the existing store action rather than duplicating sync logic
- ensure sync remains idempotent and guarded by `hasAttemptedSync`

## Open questions

- Should the completion page reuse the existing store-driven sync path exclusively, or keep its own explicit sync UX?
- Should `/oauth/callback` remain as a temporary alias for one release cycle, or should the team cut directly to `/auth/complete`?
- Does the product want a visible "Signing you in" completion screen, or is a fast redirect with background sync sufficient once the flow is consistent?

## Decision summary

The path forward is to standardize on the backend-owned OAuth callback that the repository already documents and mostly implements.

The frontend should not exchange Google's code. It should land on a separate post-login completion page after the backend has already authenticated the user. That yields a cleaner, more idiomatic Google sign-in flow for this cookie-based app and fixes the current mismatch between runtime behavior, configuration, and code.
