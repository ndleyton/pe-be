# RFC 0004: High-Performance Exercise Type Thumbnails

- Status: Proposed
- Date: 2026-04-03
- Owners: Frontend, Backend

## Summary

We want exercise types to have thumbnails in dense list surfaces such as [`ExerciseTypesPage.tsx`](../../../pe-be-tracker-frontend/src/features/exercises/pages/ExerciseTypesPage.tsx) and [`ExerciseTypeModal.tsx`](../../../pe-be-tracker-frontend/src/features/exercises/components/ExerciseTypeModal/ExerciseTypeModal.tsx).

Those surfaces already fetch and render exercise types in large batches:

- the page loads paginated results 100 at a time and can render hundreds
- the modal currently fetches a large list up front and filters client-side

This RFC recommends a **finite thumbnail system** built around **muscle-group-based keys**, not per-exercise uploaded images.

The core decision is:

1. Add a small, canonical `thumbnail_key` for each exercise type.
2. Return that key on collection/list responses.
3. Render thumbnails from a shared, versioned frontend SVG sprite or equivalent static asset set.
4. Stop using the detail-oriented exercise-type schema for list surfaces, so list responses do not carry full image arrays and other detail-only fields.

This keeps the visual improvement cheap in network, cheap in rendering, and deterministic across clients.

## Context

### Current list behavior

The current exercise-type list surfaces are hot paths:

- [`ExerciseTypesPage.tsx`](../../../pe-be-tracker-frontend/src/features/exercises/pages/ExerciseTypesPage.tsx) uses `useInfiniteScroll(...)` with `limit: 100`
- [`ExerciseTypeModal.tsx`](../../../pe-be-tracker-frontend/src/features/exercises/components/ExerciseTypeModal/ExerciseTypeModal.tsx) calls `getExerciseTypes("usage")` and then filters client-side

Both surfaces render compact cards where a thumbnail would help scanning, but neither needs the full detail-page media model.

### Current API shape

The backend currently serializes list items through the detail-oriented [`ExerciseTypeRead`](../../src/exercises/schemas.py) schema, which includes:

- nested `muscles`
- `images` derived from `images_url`
- `reference_images`
- `instructions`
- `equipment`
- `category`
- review metadata

That is acceptable for details, but it is a poor contract for a list surface that can return hundreds of rows.

### Why naive image thumbnails are a bad fit

If thumbnails are implemented as per-exercise image URLs on list responses, we create avoidable cost:

- repeated media URL strings in large payloads
- one or more network fetches per visible item
- weaker cache reuse across many exercise types
- slower decode and layout work on dense grids and pickers
- ambiguity between "list thumbnail" media and detail-page instructional images

The repo already has richer per-exercise images on the detail surface. List thumbnails should solve a different problem: fast visual categorization.

## Goals

- Add a visual thumbnail to exercise-type list surfaces without materially increasing time-to-render.
- Keep the thumbnail set finite, reusable, and strongly cacheable.
- Make thumbnail selection deterministic for both backend and frontend consumers.
- Avoid per-item thumbnail media fetches on list surfaces.
- Preserve richer per-exercise image support on the detail page.
- Support sensible fallback behavior for guest-created or incomplete exercise types.

## Non-Goals

- User-uploaded thumbnails for exercise-type lists
- AI-generated thumbnail artwork
- Replacing the detail-page image carousel
- Perfect anatomical specificity for every individual exercise
- Solving all exercise-type list performance problems in this RFC
- Virtualizing the page or modal in the same change

## Decision

Use a **canonical `thumbnail_key`** plus a **shared frontend static asset set**.

### Canonical data model

Each exercise type gets a small `thumbnail_key` string drawn from a finite enum-like set. The initial set should stay intentionally small:

- `chest`
- `back`
- `shoulders`
- `arms`
- `core`
- `glutes`
- `quadriceps`
- `hamstrings`
- `calves`
- `full_body`
- `cardio`
- `other`

This key represents the list thumbnail identity. It is not a free-form image URL.

### Source of truth

The backend should own the canonical key for server-backed exercise types.

For guest/local-only exercise types that do not exist on the backend yet, the frontend can derive a temporary key from selected muscles or fall back to `other`. Once those types are synced or created on the server, the backend-owned key becomes authoritative.

Recommended model:

- add a persisted `thumbnail_key` field on `exercise_types`
- backfill existing rows from current muscle-group data
- allow explicit override for cases where muscle relationships do not produce a good thumbnail

Why persist instead of deriving in every client:

- it prevents drift between web, mobile, scripts, and future clients
- it avoids baking arbitrary "first muscle wins" rules into the UI
- it keeps the list contract stable even if muscle ordering or import logic changes

### Collection API contract

Collection/list responses should return a lighter list schema with `thumbnail_key`.

Recommended list shape:

```json
{
  "data": [
    {
      "id": 42,
      "name": "Incline Dumbbell Press",
      "description": "Upper chest pressing variation",
      "times_used": 187,
      "muscles": [
        {
          "id": 1,
          "name": "pectoralis major"
        }
      ],
      "thumbnail_key": "chest"
    }
  ],
  "next_cursor": 100
}
```

List responses should not include:

- `images`
- `reference_images`
- `images_url`
- `reference_images_url`
- `instructions`
- `equipment`
- other detail-only fields not used by the list surfaces

The existing detail endpoint can continue returning richer media fields.

### Frontend delivery

The frontend should render thumbnails from one shared static asset set, preferably a single SVG sprite or equivalent hashed static file emitted by Vite.

Recommended frontend behavior:

- create a small `ExerciseThumbnail` component
- accept `thumbnailKey`
- render a fixed-size box with no layout shift
- load artwork from one sprite or one small manifest-backed asset set
- treat the thumbnail as decorative where the exercise name is already visible

This yields:

- at most one additional thumbnail asset fetch per app version
- no per-exercise thumbnail API requests
- excellent browser cache reuse
- consistent visuals across page and modal

## Why This Is The Best Fit

### 1. It matches how the UI actually uses exercise types

The page and modal need fast recognition, not photorealistic media.

In both places, the user is scanning a dense list of names, descriptions, and muscles. A small muscle-group thumbnail is enough to improve recognition. A full custom image per exercise is unnecessary cost.

### 2. It separates list thumbnails from detail media

The current `images` field is detail-oriented and may grow over time.

Using the same field for list thumbnails would couple two different concerns:

- lightweight list scanning
- richer instructional or admin-managed detail media

Keeping `thumbnail_key` separate prevents this contract from getting muddled.

### 3. It minimizes payload and request overhead

A short enum-like key adds only a few bytes per row.

A shared static asset set means:

- thumbnail artwork is downloaded once
- repeated exercise types reuse the same cached asset
- there is no explosion in image requests as the list grows

That is materially better than returning unique thumbnail URLs across hundreds of rows.

### 4. It supports deterministic fallbacks

Some exercise types will have incomplete or ambiguous muscle mappings, especially custom or guest-created entries.

A finite key system makes fallback straightforward:

- mapped muscle group -> specific key
- cardio category -> `cardio`
- unclear multi-group exercise -> `full_body`
- missing data -> `other`

### 5. It creates room to slim the list endpoint

This RFC is not only about artwork. It is also a chance to correct an API shape mismatch.

Right now the list surface pays for detail-level serialization. Adding a compact list schema is the right place to attach `thumbnail_key` and avoid carrying `images` arrays into hot list views.

## Proposed Backend Changes

### 1. Add a persisted thumbnail field

Add `thumbnail_key` to the exercise-type model and schema.

Migration approach:

1. Add the column as nullable with a defensive migration.
2. Backfill values from current exercise-type muscle mappings.
3. Add a default of `other` for new rows.
4. Optionally tighten nullability after the backfill is validated.

### 2. Add a compact list schema

Introduce a list-specific response model, for example:

- `ExerciseTypeListItemRead`
- `PaginatedExerciseTypeListResponse`

This schema should include only fields used by list/picker surfaces.

### 3. Keep detail responses rich

Do not remove the existing richer detail schema from endpoints that actually need it.

The important split is:

- collection endpoints return a compact list item
- detail endpoints return the full detail item

### 4. Backfill and maintenance rules

Backfill should use existing muscle-group relationships plus a deterministic mapping table.

The backend should also set `thumbnail_key` when:

- importing exercise types
- creating exercise types from admin flows
- updating muscle relationships in ways that affect the thumbnail

An explicit override should win over inferred mapping.

## Proposed Frontend Changes

### 1. Add a shared thumbnail component

Create a small presentational component, for example `ExerciseThumbnail`, under the exercises feature or a shared media folder.

Responsibilities:

- map `thumbnail_key` to sprite symbol or asset reference
- render fixed dimensions
- expose a fallback appearance for unknown keys
- avoid runtime fetch logic per item

### 2. Use thumbnails in both hot surfaces

Apply the component to:

- [`ExerciseTypeCard.tsx`](../../../pe-be-tracker-frontend/src/features/exercises/components/ExerciseTypeCard/ExerciseTypeCard.tsx)
- [`ExerciseTypeModal.tsx`](../../../pe-be-tracker-frontend/src/features/exercises/components/ExerciseTypeModal/ExerciseTypeModal.tsx)

The modal should replace the current initial-letter badge with the thumbnail.

The page card should add the thumbnail near the title block without increasing layout instability.

### 3. Keep the render path cheap

Frontend implementation should prefer:

- one shared sprite asset
- fixed width/height
- decorative SVG with `aria-hidden="true"` when text labels already exist

Avoid:

- per-item lazy-image hooks
- signed URLs
- base64 data URIs embedded in the API response
- a unique image import per exercise type row

## Rollout Plan

### Phase 1: RFC acceptance and key set

- agree on the initial thumbnail key list
- agree on the fallback rules
- agree that collection and detail schemas should diverge

### Phase 2: Backend contract

- add `thumbnail_key`
- backfill existing exercise types
- expose a compact list schema with `thumbnail_key`

### Phase 3: Frontend asset and component

- ship the sprite or static asset set
- add `ExerciseThumbnail`
- update the page card and modal row

### Phase 4: Measure and tune

- compare list payload size before and after
- verify request count in browser devtools
- inspect render stability in the page and modal

## Success Metrics

The implementation should meet these practical targets:

- no thumbnail-related API round trips beyond the normal exercise-type list request
- no more than one shared thumbnail asset request per deployed frontend version
- no layout shift caused by thumbnail loading
- list response size should stay flat or decrease versus the current detail-oriented collection response
- thumbnails should be available for all released exercise types, with explicit fallback for incomplete data

## Options Considered

### Option A: Reuse existing `images` or `reference_images` for list thumbnails

Description:

- pick the first image from the existing detail media fields and show it in lists

Pros:

- no new thumbnail system
- makes use of existing media support

Cons:

- payload remains detail-heavy
- many exercise types may have no usable image
- image URLs are larger and less cache-friendly than a finite key
- list behavior becomes coupled to detail media curation
- per-item image fetches scale poorly in dense lists

Decision:

- rejected

### Option B: Derive the thumbnail entirely in the frontend from `muscles`

Description:

- do not persist a key
- let the UI infer a thumbnail from muscle relationships on every client

Pros:

- no schema migration
- quick to prototype

Cons:

- clients can drift in how they choose a "primary" muscle
- muscle ordering is a weak public contract
- guest and authenticated paths may diverge
- future clients repeat the same mapping logic

Decision:

- rejected as the long-term contract

Reason:

- a server-owned key is a better source of truth, even if frontend derivation is used temporarily during rollout

### Option C: Use unique remote thumbnails per exercise type

Description:

- store and return a thumbnail URL per exercise type

Pros:

- maximal visual specificity
- can support custom art later

Cons:

- expensive for large collections
- weak cache locality
- larger payloads
- more operational complexity for media management
- unnecessary for the current list-scanning use case

Decision:

- rejected

### Option D: Use a finite key plus shared static assets

Description:

- use a small backend key and a shared frontend sprite or asset set

Pros:

- lowest request overhead
- strong cache reuse
- deterministic across clients
- easy fallback behavior
- clean separation from detail media

Cons:

- less specific than custom art
- requires an initial backfill and mapping pass

Decision:

- accepted

## Risks And Open Questions

- We need to confirm the initial key taxonomy against the real exercise catalog before freezing it.
- Some multi-muscle or compound exercises will always be imperfect fits for a single thumbnail.
- If the modal later moves to server-side search instead of up-front fetching, the compact list schema still fits, but query behavior may change.
- If future clients need richer visuals, they should build on `thumbnail_key`, not replace it with ad hoc image fields in collection payloads.

## Recommendation

Proceed with a finite, backend-owned `thumbnail_key` and a shared frontend SVG asset strategy.

If we do only one thing beyond adding artwork, it should be splitting the exercise-type collection response from the detail response. That is the main architectural step that keeps thumbnails fast instead of turning them into one more heavy field on an already hot endpoint.
