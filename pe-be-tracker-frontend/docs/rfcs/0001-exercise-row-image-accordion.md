# RFC 0001: ExerciseRow Image Accordion

- Status: Proposed
- Date: 2026-04-06
- Owners: Frontend

## Summary

Add an inline, collapsible image section to the workout `ExerciseRow` so users can preview the current exercise type's image carousel without leaving the workout screen.

The recommended implementation is:

1. Keep the existing `ExerciseRow` card and set table as the primary workflow.
2. Add a chevron-style accordion trigger in the row header for exercise media.
3. Render the exercise type image carousel inside the accordion content, above the set table.
4. Reuse the existing exercise payload's `exercise.exercise_type.images` field and the shared carousel primitive instead of introducing a new API request path.

## Context

The current workout UI already exposes two ways to learn more about an exercise:

- the row title in [`pe-be-tracker-frontend/src/features/exercises/components/ExerciseRow/ExerciseRow.tsx`](../../src/features/exercises/components/ExerciseRow/ExerciseRow.tsx)
- the details-page link in [`pe-be-tracker-frontend/src/features/exercises/components/ExerciseRow/ExerciseRowHeader.tsx`](../../src/features/exercises/components/ExerciseRow/ExerciseRowHeader.tsx)

That details page already has a production carousel implementation in [`pe-be-tracker-frontend/src/features/exercises/pages/ExerciseTypeDetailsPage.tsx`](../../src/features/exercises/pages/ExerciseTypeDetailsPage.tsx), backed by the shared carousel components in [`pe-be-tracker-frontend/src/shared/components/ui/carousel.tsx`](../../src/shared/components/ui/carousel.tsx).

The workout row itself does not currently surface images, so the user has to either:

- leave the workout flow to open the exercise details page, or
- complete the set from memory

This is a poor fit for image-driven exercises where a quick movement reminder is enough and full-page navigation is unnecessary.

The data is already present in the workout exercise response. The frontend test for `getExercisesInWorkout(...)` shows that workout exercises can include `exercise_type.images` directly in the row payload, so this feature does not need a second fetch in the normal case.

## Goals

- Let users preview exercise images inline during a workout.
- Preserve the current fast path for logging sets.
- Avoid extra network requests when the workout exercise payload already includes images.
- Reuse existing carousel behavior and styling patterns.
- Keep the row accessible on keyboard and screen readers.

## Non-Goals

- Replacing the dedicated exercise details page
- Adding video playback or rich coaching content
- Expanding every exercise row by default
- Reworking the set-entry table layout in the same change
- Making the entire header a click target if that creates nested-button or accidental-toggle problems

## Decision

Use a single-item accordion inside each `ExerciseRow`, with a chevron-style trigger in the header and an inline carousel panel rendered between the header and the set table.

In the first version, multiple rows may remain expanded at once. The implementation should still track the most recently opened `exercise_row` so the UI can later switch to a single-open policy without reworking the event model.

### Why this approach

#### 1. It keeps the workout flow intact

The user can inspect the movement and continue logging sets in the same card. There is no route transition and no loss of local editing context.

#### 2. It matches the existing component inventory

The repo already ships:

- an accordion primitive in [`pe-be-tracker-frontend/src/shared/components/ui/accordion.tsx`](../../src/shared/components/ui/accordion.tsx)
- a carousel primitive in [`pe-be-tracker-frontend/src/shared/components/ui/carousel.tsx`](../../src/shared/components/ui/carousel.tsx)
- a working exercise image carousel pattern in [`pe-be-tracker-frontend/src/features/exercises/pages/ExerciseTypeDetailsPage.tsx`](../../src/features/exercises/pages/ExerciseTypeDetailsPage.tsx)

This makes the feature mostly a composition task, not a greenfield UI build.

#### 3. It avoids unnecessary fetching complexity

Because `exercise.exercise_type.images` is already available in workout exercise data, the accordion can render from existing query results. That keeps the proposal aligned with the current "no extra fetches" expectation around [`getExercisesInWorkout(...)`](../../src/features/exercises/api/exercises.ts).

## Proposed UX

Each row header gains a small chevron-style expand/collapse affordance near the exercise title and existing header actions.

When collapsed:

- the row looks close to the current design
- no carousel DOM is mounted for rows without images unless the team decides the shared carousel cost is acceptable
- the current details-page external-link action remains available
- the media trigger is shown only when the exercise type is `released` and has at least one image

When expanded:

- the row reveals a media panel directly under the header
- the carousel uses the exercise type name in `alt` text
- if multiple images exist, previous and next controls are shown
- if no images exist, the trigger is hidden instead of opening an empty panel

The set table remains visible below the media panel so the expansion feels additive rather than modal.

## Interaction Design

The accordion trigger should live in the header, but it should still be a distinct control rather than turning the entire header into one large click target.

Reasons:

- the header already contains interactive children: notes dialog trigger, details link, and settings trigger
- making the entire header clickable would create event-propagation edge cases and likely invalid nested interactive semantics
- a distinct chevron trigger makes keyboard behavior, motion, and analytics clearer

Recommended trigger copy:

- collapsed: `Show Images`
- expanded: `Hide Images`

Recommended trigger treatment:

- reuse the existing title-adjacent affordance area for a chevron such as `>`
- animate the chevron rotation on open and close
- give the trigger an explicit accessible name even if the visible affordance is icon-first

The prior idea of using an `Image` icon is not recommended. A chevron communicates disclosure state more directly, which is the real interaction here.

## Component Shape

Recommended extraction:

1. Keep `ExerciseRow` as the composition root.
2. Add accordion state to `ExerciseRow` or a focused child hook only if the state starts growing beyond a simple boolean. Even in the first version, record the latest opened `exercise_row` identifier so the workout screen can later enforce a single-open policy if needed.
3. Extend `ExerciseRowHeader` with accordion-trigger props rather than embedding accordion internals into unrelated note/settings logic.
4. Extract a focused presentational child such as `ExerciseRowImagePanel` to render:
   - image filtering
   - fallback state
   - shared carousel markup
   - aspect-ratio handling

This follows the repo guidance to split rendering-heavy behavior away from already busy components instead of continuing to grow a single file.

## Carousel Behavior

The inline carousel should reuse the details-page behavior selectively, but not copy the whole page implementation blindly.

Recommended first version:

- use the shared `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, and `CarouselNext`
- preserve image `object-contain`
- keep a stable container aspect ratio to avoid layout jumps when the panel opens
- prefer the first valid image's intrinsic ratio when practical, matching the details page pattern

The inline version should be visually smaller than the details page:

- cap height on mobile so the expanded row does not dominate the viewport
- keep controls inside the media frame
- use a muted card background and rounded corners consistent with the existing `ExerciseRow`

## Data and Performance

### Default data path

Render from `exercise.exercise_type.images`.

This is the correct default because:

- it is already available in the row payload
- it avoids N+1 requests while rendering a workout with many exercises
- it keeps accordion open/close latency local to the browser

### If image data is missing

If the team later finds that some workout exercise payloads omit `images`, the fallback should be deliberate:

1. confirm whether the backend contract should include `images` consistently for workout exercises
2. prefer fixing the existing payload over adding per-row client fetches
3. only add lazy fetch-on-expand if payload size becomes a proven issue

This RFC does not recommend starting with client-side fetch-on-expand.

## Accessibility

The accordion implementation should preserve:

- keyboard toggle support via the trigger button
- `aria-expanded` and content association from the accordion primitive
- meaningful `alt` text for each image
- a trigger label that works without depending on icon-only affordances

The carousel controls should remain reachable by keyboard after expansion.

## Testing

Add focused tests around the row behavior rather than relying only on existing details-page tests.

Recommended coverage:

1. `ExerciseRow` renders the media trigger only when the exercise type is `released` and has one or more images.
2. Toggling the trigger expands and collapses the image panel.
3. Carousel controls appear only when multiple images exist.
4. Multiple rows can remain open at the same time in the first version.
5. The latest opened `exercise_row` is tracked when a row is expanded.
6. The existing notes, details link, and settings actions do not toggle the accordion accidentally.
7. Rows without images do not render empty media chrome.

If a new `ExerciseRowImagePanel` component is extracted, test its fallback and image-error behavior directly.

## Rollout Plan

1. Extract a reusable inline image-panel component from the existing details-page carousel pattern.
2. Wire the chevron accordion trigger into `ExerciseRowHeader`.
3. Render the panel in `ExerciseRow` above `ExerciseSetTable`.
4. Add unit tests for row expansion behavior.
5. Manually verify the workout screen on mobile and desktop with:
   - no images
   - one image
   - multiple images

## Risks

### 1. Expanded rows can become too tall

If the media panel is too large, the user loses the quick-scanning benefit of the workout list. The mitigation is to cap the panel height and keep the feature opt-in via accordion expansion.

### 2. Header interactions can conflict

The row header already has multiple controls. A dedicated media trigger avoids most of this risk, but tests should explicitly confirm that notes/settings/details actions do not also toggle the accordion.

### 3. Repeated carousel instances can add render cost

Only one or two rows are likely to be expanded during a workout, but the implementation should still avoid eager heavy work for every row if it is not needed.

## Alternatives Considered

### Option A: Navigate users to the exercise details page only

Rejected because it interrupts the workout flow for a lightweight reference task.

### Option B: Show a static thumbnail instead of an accordion

Rejected for the first version because the requirement is specifically to surface the exercise type image carousel, and a single thumbnail does not cover multi-angle image sets well.

### Option C: Auto-expand the first row with images

Rejected because it adds noise to the default workout layout and makes the screen less scannable.

## Open Questions

1. When instructions are added later, should they always render below the carousel or only when present and explicitly expanded further?

## Recommendation

Ship this as a small frontend-only enhancement that reuses the existing workout payload and shared carousel primitives. Keep the first version deliberately narrow: dedicated trigger, inline image panel, no new API calls, support for multiple open rows, tracking for the latest opened `exercise_row`, and tests focused on interaction safety inside the dense `ExerciseRow` header.
