# RFC 0013: Supersets and Exercise Duplication

- Status: Proposed
- Date: 2026-11-17
- Owners: Backend / Frontend
- Scope: Making it easy to alternate between exercise types within a workout and routine

## Summary and recommendation

Users who alternate between exercises (A1 → B1 → A2 → B2, or circuits of three or more) currently have to scroll between two exercise cards. There are two ways to fix this, and they solve different problems:

1. **Duplicate exercise** ("copy the table"): add a second card of the same exercise type, optionally pre-filled with the source card's sets. No schema change. Helps users split one exercise into blocks across the workout (A, B, A), but **does not make alternating easier**: the cards remain separate and unordered except by creation time.
2. **Superset groups**: mark adjacent exercises as one group, render them together, and guide the user through rounds. Needs two small nullable/integer columns on `exercises` and `exercise_templates`.

Recommendation:

- **Phase 1 (no migration):** ship "Duplicate exercise" in the card header menu. It is cheap, works for guests and signed-in users with existing APIs, and covers the "copy" request.
- **Phase 2 (small migration):** add `position` and nullable `superset_group` to `exercises` and `exercise_templates`. Render grouped exercises in one bordered block with a round-by-round "next set" cue. Sets stay on their own exercise; a round is "set N of every member".
- **Defer:** per-group rest timers, circuit/EMOM timing, drop-set semantics, and a separate `superset_groups` table.

These are proposed decisions, not implemented behavior.

## Current implementation and constraints

| Area | Current behavior | Consequence |
| --- | --- | --- |
| [Exercise model](../../src/exercises/models.py) | `Exercise` has `exercise_type_id`, `workout_id`, notes, timestamp; no position or grouping. Sets have `position` (RFC 0010). | No way to express order or grouping across exercises |
| [Workout exercises query](../../src/exercises/crud.py), `get_exercises_for_workout` | `ORDER BY exercises.id ASC` | Order is creation order; users cannot reorder, and a new member of a superset lands at the bottom |
| [Routine models](../../src/routines/models.py) | `Routine.exercise_templates` relationship has no `order_by`; the summary preview orders by `ExerciseTemplate.id` | Template order is implicit (PK/insert order). Grouping without an explicit position would be fragile |
| [Routine update](../../src/routines/crud.py) | Supplying `exercise_templates` deletes and recreates the tree | New columns must be in the write schema, or a full-tree save silently drops them |
| [Routine → workout](../../src/routines/service.py), `create_workout_from_routine` | Copies each template to an `Exercise` and its sets, in relationship order | Must copy `position` and `superset_group` |
| Workout → routine, `clone_public_workout_to_private_routine`; [program cloning](../../src/routine_programs/crud.py) `_clone_routine` | Manually reconstruct templates | Must copy the new fields explicitly |
| [Add exercise flow](../../../pe-be-tracker-frontend/src/features/workouts/hooks/useWorkoutExerciseActions.ts) | `handleSelectExerciseType` creates one exercise via API (optimistic) or guest store; no dedupe of exercise type | The same type can already appear twice; duplication is a new entry point, not a new capability |
| [ExerciseList](../../../pe-be-tracker-frontend/src/features/exercises/components/ExerciseList/ExerciseList.tsx) / [ExerciseRow](../../../pe-be-tracker-frontend/src/features/exercises/components/ExerciseRow/ExerciseRow.tsx) | Flat list of independent cards, each with its own `useExerciseSetActions` | Grouping can wrap existing rows; set logic does not need to change |
| [Workout recap](../../src/workouts/recap.py) | Groups current exercises by `exercise_type_id` before computing metrics | Duplicated cards already aggregate correctly in the recap |
| [Exercise stats](../../src/exercises/crud.py), `get_exercise_type_stats` | Metrics v1 (`metrics_version=1`): "last workout" uses the single latest `Exercise` row. Metrics v2 builds sessions keyed by `workout.id` and derives `lastWorkout` from the latest session | v1 with duplicate cards shows only one block's sets; the Phase 1 fix is scoped to v1. v2 already aggregates every exercise in the workout and needs no change |
| [Guest store](../../../pe-be-tracker-frontend/src/stores/useGuestStore.ts), [sync](../../../pe-be-tracker-frontend/src/utils/syncGuestData.ts) | `GuestExercise` fields are enumerated manually during sync | New fields must be added to the interface **and** the sync mapper |
| [MCP trainer tools](../../src/mcp/) and chat tools | Read and log workouts | Should expose grouping read-only; logging can ignore it initially |

## User experience

### Duplicate exercise (Phase 1)

Header menu on an exercise card: **Duplicate**. Options in one sheet:

- "Empty" — same exercise type, no sets.
- "Copy sets" (default) — copy reps/intensity/unit/side/duration/RPE/RIR of each set, `done = false`, notes cleared.

The copy is inserted at the end of the list (Phase 1 has no position). This is the cheap answer to "copy the table". It suits "do A, then B, then A again" but is not a superset UI.

### Superset (Phase 2)

- On a card: **Superset with…** opens the existing exercise picker (or lists the other exercises in the workout). Choosing an exercise groups the two; choosing a new type creates it directly below the source card.
- Grouped exercises render inside one container labeled "Superset" (two members) or "Circuit" (three or more), with a vertical accent bar. Each member keeps its existing card and set table.
- **Round cue**: after completing set N of member A, the cue moves to set N of the next member, then wraps to set N+1 of the first member. This is derived purely from `position` and `done`. It requires no new set fields.
- **Ungroup** from the group header menu clears `superset_group` on all members.
- Members with unequal set counts are allowed. Rounds beyond a member's last set skip it.
- Rest: Phase 2 shows the existing per-set `rest_time_seconds` only. A per-round rest timer is deferred.

Routines get the same grouping UI in the routine editor; starting a workout from a routine preserves groups.

## Domain semantics

- A superset is a **presentation and sequencing relationship among exercises**, not a property of sets or exercise types (consistent with RFC 0010, which ruled supersets out of exercise-type variations).
- `superset_group` is an opaque per-workout (or per-routine) label. Exercises that share a value are one group. `NULL` means not grouped. A group with one remaining member is treated as ungrouped. The server may clear it, but readers must tolerate it.
- Group members must be **contiguous by `position`**. The server normalizes on write: members are moved to sit right after the first member, keeping their relative order.
- Sets are never moved between exercises. Statistics, PRs, volume, and recap stay per exercise type. Supersets do not change any metric.

## Persistence alternatives

| Option | How | Benefits | Costs | Assessment |
| --- | --- | --- | --- | --- |
| A. Duplicate only | New exercise of same type via existing POST | Zero schema; ships fast | Doesn't group or order; alternation still means scrolling | Phase 1 |
| B. Encode in `notes` | e.g. `superset:abc` prefix | Zero schema | Notes are user text and get cleared on some copy paths (RFC 0010); unfilterable | Rejected |
| C. Columns on `exercises` / `exercise_templates` | `position INT NOT NULL`, `superset_group SMALLINT NULL` | One query, no joins, easy copy, guest-friendly | Migration + backfill; every copy path must copy two fields | **Recommended** |
| D. `superset_groups` table + FK | Group row with name, rest, type | Room for rest/circuit config | Extra lifecycle (orphans, deletes), join on every read, guest store needs a new entity | Defer until group-level settings are required |

### Recommended schema

On both `exercises` and `exercise_templates`:

```text
position        INTEGER NOT NULL  CHECK (position >= 0)
superset_group  SMALLINT NULL     CHECK (superset_group IS NULL OR superset_group >= 0)
```

- Backfill `position` with `ROW_NUMBER() OVER (PARTITION BY workout_id ORDER BY id) - 1` (and `PARTITION BY recipe_id` for templates).
- Index: replace the ordering use of `ix_exercises_workout_id_active_id` with a query that orders by `(position, id)`. The existing index still covers the filter. A unique active-position index, like the one on sets, is optional. Skip it at first, because guest sync and concurrent inserts make it a source of 409s for little benefit.
- `superset_group` is a small integer with no cross-workout meaning. **The server assigns labels; clients never invent persisted labels.**
  - Allocation: every write that creates or changes groups first takes `SELECT ... FOR UPDATE` on the parent `workouts` row (routines: the `recipes` row, which `update_routine` already locks). A new group gets `max(superset_group) + 1` read under that lock. Concurrent writers to the same workout are serialized by the row lock, so two new groups cannot receive the same label.
  - `ExerciseCreate` takes `superset_with_exercise_id` rather than a raw label: the server joins that exercise's group or allocates a new label for the pair.
  - The exercise-order endpoint treats submitted `superset_group` values as request-scoped keys. Under the lock it renumbers groups densely (`0..n-1` by first member's position), so labels are always derived server-side.
  - Guest sync creates exercises ungrouped, then sends one exercise-order request with the guest labels as request-scoped keys.
- Follow the defensive migration pattern in `AGENTS.md`: inspector-guarded `add_column`, add the column nullable, backfill, then set `NOT NULL` with a server default of `0` for old clients.

### API

- `ExerciseRead` / `ExerciseTemplateRead`: add `position`, `superset_group`.
- `ExerciseCreate`: optional `position` (default: append) and `superset_with_exercise_id` (see allocation above).
- `ExerciseUpdate`: allow `superset_group: null` only (leave group). Joining or reshaping groups goes through the exercise-order endpoint.
- New `PATCH /api/v1/workouts/{workout_id}/exercise-order` taking `[{exercise_id, position, superset_group}]`, applied in one transaction with normalization. It mirrors the existing `reorder_set_templates` pattern. Routines get the equivalent field in the template-tree schema, plus an optional reorder endpoint if the editor needs it.
- All read paths order exercises by `(position, id)`. Add `order_by="(ExerciseTemplate.position, ExerciseTemplate.id)"` to `Routine.exercise_templates`.

Compatibility for clients that omit the new fields:

- Workout exercises: new exercises append and `superset_group` stays `NULL`. Existing rows are untouched, because exercise writes are per row.
- Routine full-tree saves (`exercise_templates` supplied): templates are deleted and recreated, and the payload carries no template ids, so old values cannot be matched back. The server therefore:
  - sets `position` from array order when omitted (old clients already send templates in display order);
  - if **no** template in the payload sets `superset_group` (checked via `model_fields_set`) **and** the routine currently has any grouped template, rejects the save with `409 superset_groups_would_be_lost` and leaves the routine unchanged. The client must upgrade to edit that routine's templates.
- Old clients can still edit any ungrouped routine and any routine's non-tree fields (name, description, visibility). They cannot silently drop groups.

## Implementation plan

### Phase 1: Duplicate exercise (frontend + one backend fix)

1. `useWorkoutExerciseActions`: add `handleDuplicateExercise(exercise, { copySets })`. Signed-in: reuse `addExerciseMutation`, then create sets. Prefer one request: extend `ExerciseCreate` with optional `exercise_sets` if not already accepted; otherwise sequential set POSTs. Guest: `guestAddExercise` with cloned sets that get new IDs.
2. `ExerciseRowHeader`: add a "Duplicate" menu item next to delete.
3. Stats (metrics v1 only): make v1 "last workout" in `get_exercise_type_stats` aggregate all exercise instances of that type in the latest workout, not just the latest exercise row. Metrics v2 already groups by workout and is unchanged.
4. Tests: hook tests for both guest and signed-in branches (shared fixtures in `src/test/fixtures/`), plus a backend stats test with two same-type exercises in one workout for v1 (and a v2 regression assertion).

### Phase 2: Supersets

1. Migration plus model fields. Update `ExerciseRead`, `ExerciseCreate`, `ExerciseUpdate`, and the template schemas.
2. Order all exercise reads by `(position, id)`: `get_exercises_for_workout`, the routine relationship, the routine preview query, and history/MCP readers.
3. Copy `position` and `superset_group` in `create_workout_from_routine`, `clone_public_workout_to_private_routine`, `_clone_routine` / `clone_program`, and routine full-tree updates.
4. Exercise-order endpoint with normalization (contiguous groups, dense positions, drop singleton groups).
5. Guest store: add the fields to `GuestExercise`, set `position` on add, write a persisted-store migration that backfills positions from array order, and update `syncGuestData` to send `position` on create, then one exercise-order request carrying the guest group labels.
6. Frontend:
   - `lib/groupExercises.ts`: a pure helper that turns ordered exercises into `Array<Exercise | { group, members }>`.
   - `lib/nextSupersetSet.ts`: a pure helper for the round cue.
   - `ExerciseList` renders groups with a `SupersetGroup` wrapper around existing `ExerciseRow`s.
   - Header menu items "Superset with…" and "Ungroup".
   - Unit tests for both helpers.
7. Routine editor: same grouping UI and the same reorder.
8. Optional: a read-only `superset_group` in MCP/chat workout summaries.

### Rollout

Release the backend first; the fields are additive and old frontends ignore them. Then release the frontend, per the deployment notes in `AGENTS.md`. No feature flag is needed. Ungrouped workouts look and behave the same as today.

## Open questions

1. Should drag-to-reorder exercises ship with Phase 2? `position` enables it, but it is a separate UX effort and not required for supersets.
2. Round cue: visual highlight only, or also auto-scroll/focus the next member's set input? Auto-scroll may fight the user on mobile.

## Out of scope

- Group-level rest timers, EMOM/AMRAP/circuit timing.
- Drop sets and cluster sets (these are set-level semantics, not exercise grouping).
- Cross-workout or catalog-level "superset templates" separate from routines.
- Offering "Superset with…" inside the global Add Exercise picker (skipped for Phase 2; the card-level "Superset with…" entry point is clearer and avoids adding modal state to the global picker).
- Mentioning supersets in the post-workout AI recap (deferred until rest/round timing data exists so the coach has something actionable to say).
