# RFC 0001: Navigation Tab, Back, and Logo Semantics

- Status: Proposed
- Date: 2026-04-09
- Owners: Frontend / Product / Design

## Summary

This RFC defines a single UX model for top-level navigation in the frontend:

1. Tabs represent sections.
2. Back represents history.
3. The app logo represents home.

The proposal is:

- switching to a different tab restores the last meaningful screen in that section
- pressing the currently active tab while deep in that section resets to the section root
- pressing the currently active tab while already at the section root scrolls to the top
- in-app back affordances use history first, with a section-root fallback for direct entry
- pressing the logo always goes to the app home (`/workouts`), never to a deep remembered screen

This creates a predictable model across mobile bottom nav, mobile drawer, desktop sidebar, detail-page back buttons, and the header logo.

## Context

The current frontend already has part of this behavior:

- bottom nav restores per-tab deep links through [`src/shared/components/layout/BottomNav/BottomNav.tsx`](../../src/shared/components/layout/BottomNav/BottomNav.tsx), [`src/shared/hooks/useNavigation.ts`](../../src/shared/hooks/useNavigation.ts), and [`src/stores/useNavigationStore.ts`](../../src/stores/useNavigationStore.ts)
- desktop sidebar does the same in [`src/shared/components/layout/DesktopSidebar/DesktopSidebar.tsx`](../../src/shared/components/layout/DesktopSidebar/DesktopSidebar.tsx)
- the mobile drawer does not; it always links to tab roots in [`src/shared/components/layout/SideDrawer/SideDrawer.tsx`](../../src/shared/components/layout/SideDrawer/SideDrawer.tsx)
- the logo currently goes to workouts root in [`src/shared/components/layout/AppBar/AppBar.tsx`](../../src/shared/components/layout/AppBar/AppBar.tsx) and [`src/shared/components/layout/DesktopSidebar/DesktopSidebar.tsx`](../../src/shared/components/layout/DesktopSidebar/DesktopSidebar.tsx)
- detail pages mostly use hardcoded back links instead of history-aware navigation, for example:
  - [`src/features/workouts/pages/WorkoutPage.tsx`](../../src/features/workouts/pages/WorkoutPage.tsx)
  - [`src/features/exercises/pages/ExerciseTypeDetailsPage.tsx`](../../src/features/exercises/pages/ExerciseTypeDetailsPage.tsx)
  - [`src/features/routines/pages/RoutineDetailsPage.tsx`](../../src/features/routines/pages/RoutineDetailsPage.tsx)

This means the app already remembers deep section state in some places, but not in all places, and it does not yet define what should happen when the user re-presses the active tab or uses an in-app back icon after entering on a deep link.

## Problem

Today the same user intent can produce different results depending on which navigation surface they touch.

Examples:

- From a deep exercise page, the bottom nav returns to that deep page when switching back to Exercises, but the mobile drawer goes to `/exercise-types`.
- The logo always goes to `/workouts`, but the Workouts tab may reopen a deep workout.
- Detail-page back buttons discard history and list state because they are hardcoded links.
- There is no explicit behavior for pressing the already-active tab when the user is deep inside a section.
- The current workouts tab memory only tracks `/workouts...` paths, not `/routines...`, even though routines are part of the broader workout flow.

The result is that users have to guess whether a control means:

- “take me back one step”
- “take me to the root of this section”
- “take me to where I last was in this section”
- “take me home”

Those meanings need to be distinct.

## Goals

- Make navigation behavior predictable across mobile and desktop.
- Preserve useful context when switching between top-level sections.
- Give users a fast escape hatch from deep screens without relying only on browser back.
- Keep browser/system back behavior understandable and history-based.
- Distinguish home navigation from section navigation.
- Reduce accidental loss of list context, search context, and scroll position.

## Non-Goals

- Redesigning the information architecture
- Adding new top-level tabs
- Replacing browser history with a fully native-style stack manager
- Solving every filter/search state issue in this RFC
- Changing special blocking flows such as workout-in-progress confirmation beyond aligning them with the new semantics

## Decision

Adopt a section-based navigation model with explicit semantics for tabs, back affordances, and the logo.

## Section Model

Top-level tabs should map to sections, not just single routes.

### Sections

- Workouts
  - root: `/workouts`
  - included routes: `/workouts`, `/workouts/:workoutId`, `/routines`, `/routines/:routineId`
- Exercises
  - root: `/exercise-types`
  - included routes: `/exercise-types`, `/exercise-types/:exerciseTypeId`, `/exercise-types/:exerciseTypeId/admin-images`
- Chat
  - root: `/chat`
- Profile
  - root: `/profile`

This matters because navigation state and active tab styling should follow the user’s current section, not just exact root prefixes.

## Proposed UX Semantics

### 1. Pressing a different top-level tab

When the user presses a different tab:

- navigate to the last meaningful route visited in that target section
- if no valid remembered route exists, navigate to the section root
- push a normal history entry

Examples:

- From `/chat`, pressing `Exercises` returns to the user’s last exercise screen, such as `/exercise-types/42`, if it is still valid.
- From `/profile`, pressing `Workouts` may return to `/workouts/123` if that was the last meaningful screen in the workouts section.

This preserves context and matches the current bottom-nav and desktop-sidebar intent.

### 2. Pressing the currently active tab

When the user presses the active tab:

- if they are on a descendant route inside that section, reset to the section root
- if they are already on the section root, scroll the primary content container to the top
- do not trigger a data-destructive reset

Examples:

- From `/exercise-types/42`, pressing `Exercises` goes to `/exercise-types`
- From `/routines/9`, pressing `Workouts` goes to `/workouts`
- From `/workouts`, pressing `Workouts` scrolls to top

The reset-to-root action should use `replace`, not `push`, so browser back does not bounce users back into a detail page they explicitly reset out of.

This is the missing “escape hatch” behavior for deep navigation.

### 3. Pressing an in-app back button

In-app back affordances should mean “go to the previous screen in this flow,” not “always go to a hardcoded list page.”

Rule:

- if there is meaningful in-app history, navigate back one entry
- if the page was opened directly or there is no safe in-app history entry, navigate to the current section’s root or immediate collection page fallback

Examples:

- If the user goes `Exercise list -> Exercise detail`, the back icon returns to the list with its previous state.
- If the user opens `/exercise-types/42` directly in a new tab, the back icon goes to `/exercise-types`.
- If the user opens `/routines/9` directly, the back icon goes to `/routines`.

Important distinction:

- browser/system back remains history-based and may leave the app on direct entry
- the app’s own back icon should still provide a safe in-app fallback

### 4. Pressing the app logo

The logo is a home action, not a history action and not a section-memory action.

Rule:

- pressing the logo always navigates to `/workouts`
- pressing the logo while already on `/workouts` scrolls to top
- it never restores a remembered deep child route

Examples:

- From `/workouts/123`, logo goes to `/workouts`
- From `/exercise-types/42`, logo goes to `/workouts`
- From `/workouts`, logo scrolls to top

This keeps the logo behavior simple and distinct from tabs.

## Why This Model

### Tabs should restore context, not behave like back

Switching sections is not the same action as undoing navigation history. The user is choosing a section, so restoring the last meaningful screen in that section is useful and efficient.

### Active-tab re-press should provide a reliable reset

When users are deep in a tab, they need a deterministic way to get out quickly. Re-pressing the active tab is a strong pattern for this and is more discoverable than expecting repeated browser-back use.

### Back should preserve list context

Hardcoded links lose search terms, filters, pagination position, and sometimes scroll context. A history-first back action preserves more user work and better matches user expectation.

### The logo should stay simple

Home affordances work best when they are stable. If the logo sometimes opens a remembered deep screen, users have to remember hidden state. That is not appropriate for the app icon.

## Current Gaps Relative To This RFC

### Inconsistent tab behavior across surfaces

- bottom nav and desktop sidebar use remembered deep links
- side drawer uses fixed roots

These should be unified.

### Detail pages use hardcoded back links

Current detail-page headers mostly link directly to collection routes. That should be replaced with a shared back helper that prefers history and falls back safely.

### Section matching is too narrow for workouts

`useNavigation` currently treats the workouts section as `/workouts...` only. It should include routines so the Workouts tab and memory model remain coherent across the broader planning and workout flow.

## Implementation Direction

This RFC is about behavior, but the implementation should likely follow these steps.

### 1. Replace route-prefix logic with a section registry

Introduce a single shared definition for each section:

- section key
- root path
- route matcher
- remembered-path sanitizer
- active-state matcher

That registry should drive:

- bottom nav
- desktop sidebar
- mobile drawer
- logo/home behavior where relevant

### 2. Add a shared tab-navigation helper

Create a helper or hook that answers:

- what section is active for the current pathname
- where a tab press should go
- whether the press is cross-section, same-section-deep, or same-section-root
- whether navigation should `push`, `replace`, or just scroll to top

### 3. Add a shared history-aware back helper

Create a helper or hook for in-app back buttons:

- use `navigate(-1)` when there is safe in-app history
- otherwise go to the configured fallback path

Pages that currently hardcode collection links should use this helper instead.

### 4. Keep workout-in-progress blocking semantics

[`src/features/workouts/pages/WorkoutPage.tsx`](../../src/features/workouts/pages/WorkoutPage.tsx) already intercepts back behavior because leaving an in-progress workout is special. That flow should remain protected, but its behavior should still fit the “back means history, cancel means stay put” rule.

### 5. Add tests for the behavior, not just rendering

Minimum coverage should include:

- cross-tab restore to remembered route
- active-tab press from detail route resets to root with `replace`
- active-tab press at root scrolls to top
- drawer behavior matches bottom nav and desktop sidebar
- back icon uses history when present
- back icon falls back on direct entry
- logo always goes to `/workouts`

## Open Questions

### Should root pages restore scroll position or only reset scroll?

This RFC recommends:

- re-pressing an active root tab scrolls to top
- cross-section tab switching can preserve scroll implicitly through normal browser behavior or future section memory work

Explicit cross-section scroll restoration can be handled later if it proves valuable.

### Which pages count as “meaningful remembered routes”?

The default should be yes for stable detail pages and no for transient overlays or flows that are incomplete, destructive, or not resumable. The section registry should be able to sanitize invalid remembered paths back to section roots.

### Should routines be promoted to an explicit tab later?

Not in this RFC. For now, routines should behave as part of the Workouts section.

## Rollout Recommendation

Implement this in one focused frontend change:

1. introduce the section registry and shared tab/back helpers
2. update bottom nav, desktop sidebar, side drawer, and logo behavior
3. convert detail-page back buttons to history-aware fallbacks
4. add interaction tests covering mobile and desktop navigation surfaces

Keeping this as one cohesive change is preferable to partial rollout because the main problem today is inconsistency.

## Success Criteria

- Users can explain the difference between tab, back, and logo behavior after brief use.
- Mobile drawer, bottom nav, and desktop sidebar behave the same for top-level navigation.
- Re-pressing an active tab reliably gets users out of deep screens.
- In-app back buttons stop discarding list context in ordinary flows.
- Direct deep links still provide a safe in-app escape path.
