# RFC 0002: Align Exercise Types Page Fetching With Modal Search Behavior

- Status: Proposed
- Date: 2026-04-11
- Owner: Engineering

## Summary

Update `/exercise-types` to use the same server-backed browse/search pattern already established in [`ExerciseTypeModal.tsx`](../../pe-be-tracker-frontend/src/features/exercises/components/ExerciseTypeModal/ExerciseTypeModal.tsx).

The page should stop filtering only the currently loaded infinite-scroll pages and instead:

- keep paginated browsing for the default list
- run a separate paginated server search when a search term is active
- fetch muscle-group filter options from the dedicated muscle-groups endpoint instead of deriving them from partially loaded exercise pages

## Context

Today [`ExerciseTypesPage.tsx`](../../pe-be-tracker-frontend/src/features/exercises/pages/ExerciseTypesPage.tsx) uses the generic [`useInfiniteScroll`](../../pe-be-tracker-frontend/src/shared/hooks/useInfiniteScroll.ts) hook with a page size of `100`.

That creates two user-visible problems:

1. The page only has the first loaded pages in memory until the user scrolls.
2. Search is performed locally with `useMemo(...)` over that partial in-memory list.

The result is that `/exercise-types` appears to be "capped" by pagination:

- a matching exercise type might exist on the server but not appear in search yet
- the page only discovers more results after the user scrolls near the bottom
- the muscle-group dropdown can also be incomplete because it is derived from whichever exercise types have already been loaded

By contrast, [`ExerciseTypeModal.tsx`](../../pe-be-tracker-frontend/src/features/exercises/components/ExerciseTypeModal/ExerciseTypeModal.tsx) already separates:

- browse results
- search results
- active infinite-scroll fetch state

and uses `getExerciseTypes(...)` with a `name` parameter when search is active, so search is not limited to the initially loaded browse pages.

## Goals

- Make `/exercise-types` search across the full server dataset without requiring prior scrolling.
- Preserve infinite scroll for the browse experience.
- Keep the current `usage` / `name` sort controls.
- Keep muscle-group filtering available immediately and consistently.
- Reuse an established pattern already present in the frontend codebase.

## Non-goals

- Removing pagination from the backend or frontend.
- Changing the public `/exercises/exercise-types/` API contract.
- Introducing fuzzy search, full-text ranking, or search suggestions.
- Redesigning the exercise-types page UI.

## Decision

`ExerciseTypesPage` should move away from client-side filtering on top of a partially loaded browse cache and adopt a page-specific dual-query model:

1. A browse infinite query for the default page state.
2. A search infinite query for active search terms.
3. A dedicated muscle-groups query for filter options.

This mirrors the behavior already used by `ExerciseTypeModal`, while preserving the page-specific layout and controls.

## Proposed Design

### 1. Replace page-level `useInfiniteScroll` usage with explicit `useInfiniteQuery` flows

The page should own two query modes:

- Browse query:
  - enabled when `searchTerm.trim()` is empty
  - key includes `orderBy` and `selectedMuscleGroupId`
  - calls `getExerciseTypes(orderBy, pageParam, 100, activeMuscleGroupId)`
- Search query:
  - enabled when `searchTerm.trim()` is non-empty
  - key includes `orderBy`, `selectedMuscleGroupId`, and the normalized search term
  - calls `getExerciseTypes(orderBy, pageParam, 100, activeMuscleGroupId, searchTerm)`

The rendered grid should come from the active query, not from a client-side filter over the browse cache.

### 2. Keep infinite scroll, but drive it from the active query

The page should still fetch the next page when the user nears the bottom. The difference is that the next page must belong to the currently active mode:

- browsing fetches the next browse page
- searching fetches the next search page

This preserves the current progressive-loading behavior without making search depend on previously browsed pages.

### 3. Fetch muscle groups from the dedicated endpoint

The page already has `getMuscleGroups()` available in [`exercises.ts`](../../pe-be-tracker-frontend/src/features/exercises/api/exercises.ts), but it does not use it.

Instead of building selector options from loaded exercise types, the page should query muscle groups directly. That prevents missing options when the first exercise-type page does not happen to contain every group.

### 4. Preserve current UX expectations

The page should keep:

- the existing grid and controls
- route-level progressive rendering
- the authenticated "Create" affordance
- current sort semantics

To avoid search flicker during typing, the implementation may also reuse the modal's `useDeferredValue(...)` and "last settled results" pattern, but that is an implementation detail rather than a requirement of the RFC.

## Why This Approach

### It fixes the real bug instead of masking it

Increasing the initial page size would only delay the failure mode. Search would still be incomplete once the dataset grows past that limit.

### It matches an existing successful pattern

The modal already solved the same class of problem in this codebase:

- separate browse and search queries
- server-backed search
- infinite pagination per active mode

Using the same model reduces design risk and lowers the amount of new behavior the team needs to reason about.

### It keeps pagination where pagination belongs

Pagination should control transport cost, not search correctness. The page should remain paginated while still giving users search results from the full server-side dataset.

## Alternatives Considered

### 1. Increase the page size

Rejected.

This only makes the cap less obvious. It does not eliminate the mismatch between client-side search and server-side pagination.

### 2. Prefetch all pages in the background

Rejected.

This increases request volume and time-to-complete on page load, especially for users who never need the full dataset. It also duplicates work the backend search endpoint already supports.

### 3. Keep the generic `useInfiniteScroll` hook and bolt search onto it

Rejected.

The page now needs dual-query behavior, active-mode loading/error state, and a dedicated muscle-group query. That is page-specific logic. For this screen, a generic hook is a worse fit than explicit `useInfiniteQuery` composition.

## Impact

### User impact

- Search results on `/exercise-types` become complete without requiring manual scroll discovery first.
- Muscle-group filter options become stable and complete from initial load.
- Browse behavior remains infinite and progressive.

### Frontend impact

- `ExerciseTypesPage.tsx` becomes responsible for its own browse/search query orchestration.
- The shared `useInfiniteScroll` hook can remain in place for other screens; this RFC does not require removing it globally.

### Backend impact

None expected. The page will use existing query parameters already supported by `getExerciseTypes(...)` and the existing muscle-groups endpoint.

## Implementation Plan

1. Replace the page's `useInfiniteScroll` usage with explicit `useInfiniteQuery` browse/search queries.
2. Add a `getMuscleGroups()` query for the filter dropdown.
3. Update empty-state, loading, and "load more" indicators so they reflect the active query mode.
4. Preserve the existing create flow for authenticated users.
5. Keep the public route and endpoint usage unchanged.

## Testing Plan

Add or update frontend tests to cover:

- initial browse fetch for `/exercise-types`
- search issuing `getExerciseTypes(...)` with the `name` parameter instead of filtering only loaded pages
- search pagination continuing within the search query
- browse pagination continuing within the browse query
- muscle-group selector being populated from `getMuscleGroups()` rather than from loaded exercise pages
- authenticated create behavior remaining unchanged when search has zero matches

Manual verification should include:

- searching for an exercise known to be outside the first browse page
- switching between `Popular` and `A-Z`
- applying a muscle-group filter before scrolling
- scrolling during both browse mode and search mode

## Risks

- Server-backed search can increase request volume while the user types.
- The page will have more explicit query-state branches than it does today.

These risks are acceptable because:

- React Query caching already reduces duplicate work for repeated terms
- deferred search input can limit churn if needed
- correctness of search results is more important here than preserving a simpler but incorrect client-only filter

## Open Question

Search should continue to respect the currently selected `orderBy` value unless product wants a separate ranking model. This RFC recommends preserving the current sort control semantics to avoid surprising users during the migration.
