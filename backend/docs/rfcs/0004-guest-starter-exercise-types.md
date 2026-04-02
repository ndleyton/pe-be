# RFC 0004: Guest "Starter" Exercise Types

- Status: Proposed
- Date: 2026-04-02
- Owners: Frontend

## Summary

The frontend currently seeds 22 guest-only exercise types into the local guest store. This RFC refers to that list as the "Starter" exercise types.

Those seeded types still provide one clear benefit: a guest can open `Add Exercise` and select a familiar movement immediately, without typing or creating anything first.

They also create a product mismatch:

- their IDs are local-only and do not map to the server exercise type details route
- their metadata is materially thinner than server exercise types
- they increase guest-specific surface area that we have to maintain and test

This RFC recommends:

1. Hide exercise type detail links for guest exercises immediately.
2. Treat the Starter set as low strategic value and plan to remove it in a follow-up, unless product explicitly wants a curated zero-input guest picker.

## Context

Today the guest store is initialized with seeded exercise types in `pe-be-tracker-frontend/src/stores/seeds/exerciseTypes.ts`, wired through `pe-be-tracker-frontend/src/stores/guestStoreSeedData.ts` and `pe-be-tracker-frontend/src/stores/useGuestStore.ts`.

Guest exercise rows reuse the same UI as authenticated rows. In `pe-be-tracker-frontend/src/features/exercises/components/ExerciseRow/ExerciseRowHeader.tsx`, the header always renders a link to `/exercise-types/:id`.

That is safe for authenticated exercise types, whose IDs exist on the backend. It is not safe for guest-seeded types, whose IDs are generated locally and persisted in the browser. Navigating to that route causes the details page to query the backend for an ID that does not exist there.

Separately, the guest exercise type picker already supports create-on-search behavior in `pe-be-tracker-frontend/src/features/exercises/components/ExerciseTypeModal/ExerciseTypeModal.tsx`. That means the seeded Starter list is no longer the only way for a guest to add exercises.

## Problem

We currently have a mismatch between what the guest model can represent and what the shared exercise details UI assumes:

- guest exercise types behave like full exercise types in the workout UI
- guest exercise types do not have server-backed detail pages
- the workout UI exposes a detail affordance anyway

That creates a crash path for guest testers and is a signal that the Starter set is only partially integrated into the product.

## Goals

- Remove the guest crash path quickly.
- Decide whether the Starter set still earns its maintenance cost.
- Keep the guest first-run flow simple.

## Non-Goals

- Building a full guest exercise type details page
- Solving all guest/authenticated data model differences in this RFC

## Current Value Of The Starter Set

### Benefits

- Faster first-use flow for guests: the picker is immediately useful with no typing.
- Lower cognitive load for casual testers: common lifts are available by default.
- Better than an empty catalog for users who just want to try logging a workout quickly.

### Costs

- Broken route assumption: the workout row exposes detail navigation for entities that do not have a valid details page.
- Thin metadata: the seeded types only carry name, description, intensity unit, and usage count. They do not provide the richer muscles, images, or stats that make the details page valuable.
- Duplicate curation surface: the guest list is its own manually maintained catalog, separate from the server-backed exercise type catalog.
- Persisted-state complexity: because guest data is stored locally, removing or changing the Starter set affects migrations and existing browsers, not just fresh sessions.

## Assessment

The Starter set still has some UX value, but that value is now narrow:

- it helps guests start faster
- it does not unlock any unique capability

The create-on-search guest flow already covers the functional need to add an exercise type. Because of that, the Starter set is now primarily a convenience feature, not a foundational one.

That convenience may still be worth keeping if the product goal is "zero-input demo experience." If the product goal is instead to reduce guest-specific complexity and edge cases, the Starter set is a reasonable thing to retire.

My assessment is that the current value is low to moderate, while the maintenance and product-consistency cost is moderate.

## Options

### Option A: Keep the Starter set and hide guest detail links

What changes:

- keep the seeded guest types
- do not render the exercise detail link for guest exercise rows

Pros:

- fixes the crash path quickly
- preserves the current fast guest onboarding flow
- minimal code and product risk

Cons:

- keeps the duplicate guest catalog
- guest exercise rows still look slightly less capable than authenticated rows
- does not reduce long-term maintenance

### Option B: Remove the Starter set and rely on create-on-search

What changes:

- stop seeding default guest exercise types
- guests create a type when they search for one that does not exist
- update empty-state copy to match that behavior

Pros:

- removes duplicate curated data
- reduces guest-specific surface area
- removes the strongest source of invalid guest exercise type detail links

Cons:

- worsens the zero-input guest demo experience
- requires migration thinking for existing persisted guest stores
- likely needs more UX copy refinement than the quick fix

### Option C: Keep a much smaller curated starter list

What changes:

- reduce the seed list to a few highly common movements
- still hide guest detail links

Pros:

- preserves some first-run convenience
- reduces catalog maintenance a bit

Cons:

- still keeps the same architectural mismatch
- adds product decision overhead without removing the core guest/server split

## Recommendation

Adopt Option A now and plan toward Option B unless product explicitly wants to preserve a curated guest demo catalog.

Reasoning:

- The crash path should be fixed immediately because it is a clear correctness issue.
- Hiding the link is cheap, isolated, and does not commit us to keeping or deleting the Starter set.
- The remaining product value of the Starter set is convenience, not capability.
- If we no longer believe that convenience is important enough, the better long-term move is to remove the Starter set rather than invest more in guest-only exercise type behavior.

## Effort To Hide Exercise Type Links In WorkoutPage

Estimated effort: small, roughly 2 to 4 engineer-hours including tests.

Expected implementation shape:

- update `pe-be-tracker-frontend/src/features/exercises/components/ExerciseRow/ExerciseRowHeader.tsx` to render the external-link button only when the exercise type is server-backed
- choose one of two guards:
  - explicit prop passed down from the workout page / exercise list path
  - local guard based on the ID shape, where guest IDs are strings and server IDs are numbers
- add or update tests in `pe-be-tracker-frontend/src/features/exercises/components/ExerciseRow/ExerciseRow.test.tsx`

Notes:

- Even though the request is framed as a `WorkoutPage` change, the actual link is rendered lower in the tree, in the exercise row header component used by that page.
- A local guard in the row header is probably the lowest-effort fix.

## Effort To Remove The Starter Set

Estimated effort: medium, roughly 1 to 2 engineer-days depending on migration scope.

Likely work items:

- remove or reduce the seed list in `pe-be-tracker-frontend/src/stores/seeds/exerciseTypes.ts`
- update guest initialization expectations in store tests
- update guest empty-state copy in `pe-be-tracker-frontend/src/features/exercises/components/ExerciseTypeModal/ExerciseTypeModal.tsx`
- decide how to handle existing persisted guest stores:
  - leave existing seeded types in already-hydrated browsers
  - or add a new guest-store migration version to prune unused seeded entries

The migration decision is the main factor that moves this from "small" to "medium." Removing the seed array for fresh installs is easy; removing it cleanly for existing guest users requires deliberate migration behavior.

## Rollout

1. Ship the link-hiding fix first.
2. Review whether guest conversion/testing still depends on the curated Starter list.
3. If not, remove the Starter set in a follow-up with an explicit migration decision.

## Decision Needed

Product and engineering should decide whether guest mode still needs a curated, zero-input exercise picker.

If the answer is no, the Starter set should be deprecated and removed after the immediate link fix.
