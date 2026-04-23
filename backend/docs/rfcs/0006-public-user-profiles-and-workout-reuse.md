# RFC 0006: Public User Profiles and Workout-to-Routine Reuse

- Status: Proposed
- Date: 2026-04-23
- Owners: Backend / Frontend

## Summary

This RFC proposes a first-class public profile and activity model that lets users:

1. publish a public profile
2. let other users browse their completed public workouts
3. let authenticated viewers save a public workout as one of their own routines

The recommended shape is:

- keep the current private/self `/profile` experience for account and personal stats
- add a new public profile domain with stable public usernames
- make workout sharing an explicit opt-in at both the user and workout level
- expose public activity through dedicated read schemas and routes, not through the existing owner-only workout APIs
- implement "save workout as routine" as a server-side clone flow that creates a new private routine for the viewer

This fits the current product and codebase better than trying to force social behavior into the auth `users` routes or by treating public workouts as if they were already routines.

## Context

### What exists today

The repository already has solid routine reuse primitives:

- routines are a first-class backend domain in [`backend/src/routines`](../../src/routines)
- routines can already be `public` or `link_only` in [`backend/src/routines/models.py`](../../src/routines/models.py)
- public and link-only routines are readable without authentication in [`backend/src/routines/router.py`](../../src/routines/router.py)
- authenticated users can already start a workout from a public routine through [`RoutineService.create_workout_from_routine`](../../src/routines/service.py)

The frontend also already supports saving the current user's workout into a routine:

- the current workout detail page opens [`SaveRoutineModal`](../../../pe-be-tracker-frontend/src/features/routines/components/SaveRoutineModal/SaveRoutineModal.tsx)
- that modal transforms the current workout's exercises and sets into a routine create payload and posts it to `/routines/`

So the product already has:

- reusable routines
- routine sharing
- local workflow for turning a finished workout into a routine

### What does not exist yet

The current codebase does not have a public social/profile domain.

Important gaps:

- the current `/profile` page is a self-only account/stats page built from the current user's own workouts or guest storage in [`ProfilePage.tsx`](../../../pe-be-tracker-frontend/src/features/profile/pages/ProfilePage.tsx)
- the backend `users` domain is auth-oriented, not profile-oriented, in [`backend/src/users/router.py`](../../src/users/router.py)
- the `User` model has only a nullable `name` beyond the base auth fields in [`backend/src/users/models.py`](../../src/users/models.py)
- `UserRead` does not currently expose additional profile fields in [`backend/src/users/schemas.py`](../../src/users/schemas.py)
- workouts are strictly owner-scoped today in [`backend/src/workouts/router.py`](../../src/workouts/router.py) and [`backend/src/workouts/crud.py`](../../src/workouts/crud.py)
- there is no stable public identifier such as `username`
- there is no visibility model on workouts
- there is no public activity schema that safely omits sensitive workout fields

### Why routines alone are not enough

An activity feed and a routine catalog are not the same thing.

Routines are prescriptive templates. Workouts are observed activity logs.

If we only expand routines, users still cannot:

- see what another user actually did on a given day
- browse recent public activity from a user profile
- turn a completed public workout into their own routine without the source user having explicitly authored a routine

The new feature therefore needs a public workout activity layer, not just more routine discovery.

## Goals

- Let a user opt into a public profile with a stable public URL.
- Let viewers browse a public user's recent completed workout activity.
- Let viewers open a public workout detail page with enough structure to understand the workout.
- Let authenticated viewers save a public completed workout as a private routine in their own library.
- Reuse the existing routine system instead of introducing a second template system.
- Preserve privacy by default and avoid exposing sensitive workout data accidentally.
- Fit the existing feature-slice architecture on both backend and frontend.

## Non-Goals

- Following, likes, comments, reactions, or notifications
- A global feed or recommendation engine
- Exposing in-progress workouts publicly
- Making guest users able to save another user's workout without signing in
- Replacing the current `/profile` page with a public profile page
- Making public workouts directly editable or startable without first saving them as a routine

## Decision

Add a new public profile/activity domain centered on explicit visibility and server-side cloning.

### Product decision

The product surface will have two distinct profile concepts:

1. `My Profile` at `/profile`
2. `Public Profile` at `/u/:username`

This avoids overloading the current self page and keeps navigation clear.

### Data model decision

Add a stable public identity and explicit sharing controls:

- extend `users` with:
  - `username` unique
  - reuse existing `name` as display name
  - `bio` nullable text
  - `avatar_url` nullable text
  - `is_profile_public` boolean, default `false`
- extend `workouts` with:
  - `visibility` enum with `private` and `public`, default `private`
- optionally extend `recipes` with routine provenance fields:
  - `source_workout_id`
  - `source_user_id`
  - `source_username_snapshot`
  - `source_display_name_snapshot`

The provenance fields are strongly recommended for v1 because they let the app show "Saved from @username" without overloading the existing freeform `author` field.

### API decision

Expose public profiles and public activities through a dedicated `profiles` slice:

- `GET /api/v1/profiles/me`
- `PATCH /api/v1/profiles/me`
- `GET /api/v1/profiles/{username}`
- `GET /api/v1/profiles/{username}/activities`
- `GET /api/v1/profiles/{username}/activities/{workout_id}`
- `POST /api/v1/profiles/{username}/activities/{workout_id}/save-as-routine`

Do not make the existing `/workouts/{id}` route public.

### Reuse decision

Saving a public workout as a routine will be handled server-side.

That clone flow will:

- verify the source workout is still public and belongs to the named public user
- map workout exercises and sets into routine templates
- create a new routine owned by the current authenticated viewer
- default the new routine visibility to `private`
- exclude fields that are not appropriate for a reusable template

## Why This Is The Best Fit

### 1. It preserves the current privacy model

The current workout API is safely owner-only. Making it conditionally public would increase leakage risk across many call sites.

Dedicated public schemas and routes create a much cleaner boundary.

### 2. It reuses the existing routine primitive

The app already knows how to:

- create routines
- display routines
- start workouts from routines

That means the new feature only needs a source-to-routine translation step, not a new template runtime.

### 3. It keeps self profile and public profile separate

The current frontend `ProfilePage` is really a settings/statistics page. Replacing that route with a public page would create ambiguous behavior and a poor mental model.

### 4. It is safer than copying the current client-side modal pattern

The existing `SaveRoutineModal` works for the current user's own workout because the client already has full private exercise/set data. That pattern is wrong for public reuse because:

- the viewer should not need raw private workout APIs
- privacy stripping must happen server-side
- authorization must be enforced against the latest visibility state, not stale client data

## Current-State Constraints

### User identity is not public-ready yet

The current `User` model stores only `name` beyond base auth fields, and `UserRead` does not expose profile-specific properties. This means the app does not yet have a durable public identity model.

### Workout reads are owner-only

The current workout router and CRUD layer always filter by `owner_id`. That is correct for private data, but it means a public activity feature must add new read paths rather than piggyback on existing ones.

### The current save-as-routine flow copies too much for public reuse

The current modal copies exercise notes and set notes from the active workout. For another user's public activity, that would likely expose commentary that is useful in a private training log but not appropriate in a public reusable template.

## Proposed Design

### Backend Domain Shape

Create a new feature slice:

- [`backend/src/profiles/router.py`](../../src/profiles/router.py)
- [`backend/src/profiles/service.py`](../../src/profiles/service.py)
- [`backend/src/profiles/crud.py`](../../src/profiles/crud.py)
- [`backend/src/profiles/schemas.py`](../../src/profiles/schemas.py)

This slice should own:

- public profile reads
- self profile reads/updates
- public activity reads
- workout-to-routine save flow

It should not replace the auth responsibilities of [`backend/src/users`](../../src/users).

### Data Model

### `users`

Recommended additions:

- `username: String, unique, indexed, nullable during backfill only`
- `bio: Text, nullable`
- `avatar_url: Text, nullable`
- `is_profile_public: Boolean, default false, nullable false`

Recommended rules:

- `username` is lowercased, URL-safe, and unique
- existing `name` becomes the display name used in profile UI
- if `avatar_url` is unavailable, frontend falls back to initials

### `workouts`

Recommended additions:

- `visibility: Enum(private, public), default private, nullable false`

Recommended rules:

- only completed workouts (`end_time IS NOT NULL`) are eligible for public listing
- a workout can only be served publicly if:
  - `user.is_profile_public == true`
  - `workout.visibility == public`
  - `workout.end_time IS NOT NULL`

Open workouts should never be visible publicly even if a client tries to set them public.

### `recipes` / routines provenance

Recommended additions:

- `source_workout_id: Integer, nullable`
- `source_user_id: Integer, nullable`
- `source_username_snapshot: String, nullable`
- `source_display_name_snapshot: String, nullable`

Why snapshots matter:

- the source user can later rename themselves
- the source workout can later be deleted or made private
- the saved routine should still show where it came from at creation time

If scope needs to stay smaller, these can be deferred, but that weakens attribution and product analytics.

### Public Read Models

Do not reuse `UserRead`, `WorkoutRead`, or `ExerciseRead` for public responses.

Add dedicated schemas such as:

- `ProfileMeRead`
- `ProfileMeUpdate`
- `PublicProfileRead`
- `PublicWorkoutActivitySummary`
- `PublicWorkoutActivityRead`
- `SavePublicWorkoutAsRoutineRequest`

### `PublicProfileRead`

Suggested shape:

- `username`
- `display_name`
- `bio`
- `avatar_url`
- aggregate stats for public workouts only:
  - `public_workout_count`
  - `last_public_activity_at`
  - optional `week_activity` summary for the existing `WeekTracking` UI

Do not expose:

- email
- internal auth flags
- OAuth metadata

### `PublicWorkoutActivitySummary`

Suggested shape:

- `id`
- `name`
- `workout_type`
- `start_time`
- `end_time`
- `duration_seconds`
- `exercise_count`
- `set_count`
- `exercise_names_preview`

### `PublicWorkoutActivityRead`

Suggested shape:

- summary fields above
- `exercises`
  - `exercise_type`
  - `notes` omitted in v1
  - `sets`
    - `reps`
    - `duration_seconds`
    - `intensity`
    - `rpe`
    - `rir`
    - `intensity_unit`
    - `type`

Do not expose in v1:

- workout notes
- AI recap
- exercise notes
- set notes
- `done`
- `rest_time_seconds`
- internal owner identifiers

This keeps the public detail page useful while sharply reducing privacy risk.

### API Design

### `GET /api/v1/profiles/me`

Purpose:

- return the authenticated user's editable public-profile settings plus self-facing stats used by `/profile`

Why:

- the current frontend self page is assembling profile context from workouts and auth state instead of a dedicated profile model

### `PATCH /api/v1/profiles/me`

Purpose:

- edit `username`, `name`, `bio`, `avatar_url`, `is_profile_public`

Validation:

- `username` unique
- username collision returns `409`
- toggling `is_profile_public` to `false` immediately hides public profile and public activities

### `GET /api/v1/profiles/{username}`

Purpose:

- return a public profile shell and aggregate stats

Behavior:

- `404` if username does not exist
- `404` if the user exists but `is_profile_public == false`

Returning `404` for private profiles avoids distinguishing "not found" from "exists but private."

### `GET /api/v1/profiles/{username}/activities`

Purpose:

- keyset-paginated list of the user's public completed workouts

Suggested params:

- `cursor`
- `limit`

Suggested default order:

- `end_time DESC, id DESC`

Recommended implementation:

- query workouts scoped to the resolved user
- filter `visibility == public`
- filter `end_time IS NOT NULL`
- aggregate exercise and set counts without loading full trees for list rows

### `GET /api/v1/profiles/{username}/activities/{workout_id}`

Purpose:

- public-safe detail view for a single public completed workout

Recommended implementation:

- verify the username maps to the workout owner
- eager-load exercises, exercise types, sets, and intensity units
- exclude deleted exercises and deleted sets

### `POST /api/v1/profiles/{username}/activities/{workout_id}/save-as-routine`

Purpose:

- save a public workout as a new private routine for the current authenticated viewer

Suggested request:

```json
{
  "name": "Push Day From @jane",
  "description": null
}
```

Suggested behavior:

1. resolve the public source workout
2. map it to routine templates
3. create a new private routine owned by the viewer
4. return `RoutineRead`

Suggested default mapping:

- routine name:
  - request name if provided
  - else source workout name
  - else `Workout from @username`
- include:
  - `workout_type_id`
  - exercise types
  - set counts and set prescription values
  - set `type`
- exclude:
  - workout notes
  - recap
  - exercise notes
  - set notes
  - `done`
  - `rest_time_seconds`

This is the safest v1 default because logged comments are often personal and retrospective rather than reusable instructions.

### Workout Visibility UX Rules

Recommended v1 rules:

- all existing workouts backfill to `private`
- new workouts default to `private`
- visibility can only be toggled once a workout is completed
- if a user's profile is private, the UI should prevent setting workouts to public or silently coerce them to private

This keeps privacy opt-in explicit and avoids accidental broadcasting of ongoing sessions.

### Frontend Design

### Routes

Keep:

- `/profile` for self page

Add:

- `/u/:username` for public profile
- `/u/:username/activities/:workoutId` for public workout detail

### Frontend feature shape

Recommended additions:

- `src/features/profile/api/` can own self-profile and public-profile requests
- `src/features/profile/pages/MyProfilePage.tsx`
- `src/features/profile/pages/PublicProfilePage.tsx`
- `src/features/profile/pages/PublicActivityPage.tsx`

The existing [`ProfilePage.tsx`](../../../pe-be-tracker-frontend/src/features/profile/pages/ProfilePage.tsx) can either be refactored into `MyProfilePage` or kept as the implementation behind `/profile`.

### Public profile page

Suggested sections:

- profile header
- public stats
- recent activity list

The existing [`WeekTracking`](../../../pe-be-tracker-frontend/src/shared/components/WeekTracking/WeekTracking.tsx) is a good candidate for reuse if fed only public workouts.

### Public activity detail page

Suggested sections:

- workout header and summary
- exercise list
- `Save as routine` CTA

If the viewer is not authenticated, the CTA should route them through sign-in and then return them to the public activity page.

### Self profile page evolution

The self page should stop pretending that "profile" equals "my workout list plus auth session."

It should instead read from `/profiles/me` for:

- username
- display name
- bio
- avatar
- public/private status

and combine that with the user's own workout data only where needed for stats.

## Query and Performance Notes

The new activity list and detail endpoints are read-heavy and can become high-traffic if profiles are shared externally.

Recommended DB/index additions:

- unique index on `users.username`
- composite index on public workouts by owner and recency, for example:
  - `(owner_id, visibility, end_time DESC, id DESC)`
- if Postgres partial indexes are preferred:
  - public completed workouts only

For activity detail endpoints, prefer joined or select-in loading deliberately:

- list endpoints should not load full exercise/set graphs
- detail endpoints should eager-load the small fixed graph required for one workout

## Security and Privacy

### Public API boundary

Public routes must use dedicated serializers so the response shape is safe by construction.

Do not create public behavior by:

- weakening the owner filter inside existing workout CRUD helpers
- reusing `WorkoutRead`
- returning raw ORM models and relying on the frontend to ignore fields

### Sensitive fields to withhold in v1

- email
- workout notes
- recap text
- exercise notes
- set notes
- unfinished workouts
- auth/session state

### Ownership and authorization rules

- `PATCH /profiles/me` requires auth
- `POST /profiles/{username}/activities/{workout_id}/save-as-routine` requires auth
- public GET routes do not require auth
- save-as-routine re-checks source visibility server-side on every request

## Migration Plan

Use defensive Alembic migrations, consistent with repository guidance.

### Migration 1: user profile columns

- add `username`, `bio`, `avatar_url`, `is_profile_public`
- backfill `username` from a deterministic slug strategy
- leave `username` nullable only during migration if necessary, then enforce uniqueness and non-null once backfill is complete

### Migration 2: workout visibility

- add workout visibility enum and column
- backfill existing workouts to `private`
- add public-recency index

### Migration 3: optional routine provenance

- add source fields to `recipes`

All migrations should guard column existence and use inspector-based checks where drift is plausible.

## Rollout Plan

### Phase 1: backend primitives

- schema changes
- profile router/service/crud
- public profile/activity read APIs
- save-as-routine API
- backend tests for authorization, visibility, and clone behavior

### Phase 2: self profile settings

- refactor `/profile` to use `/profiles/me`
- add profile editing UI
- add public/private toggle

### Phase 3: public viewing

- public profile page
- public activity detail page
- save-as-routine CTA

### Phase 4: attribution and polish

- show source attribution on routines cloned from public workouts
- add profile sharing links
- consider caching public profile/activity GETs if traffic warrants it

## Testing Strategy

### Backend

Add focused tests for:

- username uniqueness and validation
- `GET /profiles/{username}` for public vs private users
- public activity list only returning completed public workouts
- public activity detail hiding sensitive fields
- save-as-routine from a public workout
- save-as-routine rejecting private, missing, or mismatched source workouts
- visibility transitions from public to private immediately hiding content

### Frontend

Add tests for:

- self profile settings/data loading
- public profile loading states and unavailable states
- public activity detail rendering
- save-as-routine CTA for authenticated and signed-out viewers
- post-login resume behavior if implemented in v1

## Alternatives Considered

## Option A: Reuse the existing `users` routes for public profiles

Rejected.

Reason:

- the current `users` slice is auth-oriented
- public profile concerns are materially different from auth/session concerns
- mixing them would make privacy boundaries harder to reason about

## Option B: Make `/workouts/{id}` public when a workout is public

Rejected.

Reason:

- current workout routes and schemas are private by design
- too much risk of leaking fields like notes or recap
- complicates authorization logic across existing owners-only code paths

## Option C: Only support public routines, not public workouts

Rejected.

Reason:

- routines already exist and do not solve the "see what this user actually did" use case
- it forces source users to explicitly author templates for every shareable activity

## Option D: Clone public workouts on the client

Rejected.

Reason:

- requires exposing more workout detail than we should
- puts privacy filtering in the wrong place
- makes auth and visibility races more likely

## Open Questions

### 1. Should public workouts ever expose exercise notes or set notes?

Recommendation:

- no for v1
- revisit only with an explicit opt-in setting such as "include notes when shared publicly"

### 2. Should profile-public users default new completed workouts to public?

Recommendation:

- no for v1
- keep workout visibility explicit per workout

### 3. Should a cloned routine show source attribution in the routine UI?

Recommendation:

- yes if provenance fields ship in v1
- otherwise defer the UI but keep the server-side fields if possible

### 4. Should public activities be crawlable or indexable?

Recommendation:

- no product commitment in v1
- keep the response and frontend compatible with later SEO work, but do not optimize for indexing yet

## Recommended Next Step

Build this as a new `profiles` feature slice with explicit public serializers and a server-side workout-to-routine clone path.

That gives the product the requested user-facing behavior while preserving the current private workout model and reusing the routine system the app already has.
