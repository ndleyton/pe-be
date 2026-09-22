# RFC 0010: Set Sides and Exercise Variations

- Status: Proposed
- Date: 2026-09-22
- Owners: Backend / Frontend
- Scope: Product experience, persistence alternatives, statistics, and implementation plan

## Summary and recommendation

Add structured **side** to exercise sets and routine set templates. Keep exercise identity separate: left/right describes how a particular set was performed; grip, stance, or equipment can describe a reusable exercise variation.

Recommended first release:

1. Add nullable `side` (`left`, `right`, `both`) to sets and set templates. Null means unspecified, including historical data. Add an integer `position` on both tables as the authoritative set order.
2. Offer “Add left + right” as a shortcut that creates two independent sets. “Both” means a single bilateral effort, not two unilateral sets packed into one row.
3. Keep volume as recorded load × recorded reps, without an automatic side multiplier. Separate side-specific strength records and show side breakdowns.
4. Defer a general variation taxonomy. Initially, distinct exercise types can represent meaningful grip variants; later relate them to a parent exercise type without replacing their historical IDs.

No-schema-change implementations are possible, but are suitable for a limited annotation pilot, not the recommended foundation for sync and reliable charts. These are proposed decisions, not implemented behavior.

Supersets are out of scope. They describe relationships and execution order across multiple exercises, whereas an exercise-type variation describes one movement. A “superset” variant cannot identify its partners or order, so this RFC does not implement that separate feature.

## Current implementation and constraints

The following observations are based on the repository at the time of writing:

| Area | Current behavior | Consequence |
| --- | --- | --- |
| [ExerciseSet](../../src/exercise_sets/models.py), [set schemas](../../src/exercise_sets/schemas.py) | Numeric load/reps/duration, RPE/RIR, completion, rest, free-text `notes` and `type`; no side field | There is no existing structured metadata container to reuse |
| [Routine models](../../src/routines/models.py) | `SetTemplate` has `notes` and `type`; no side field | Templates need equivalent semantics and explicit copying |
| [Routine updates](../../src/routines/crud.py), `update_routine` | Supplying `exercise_templates` deletes and recreates the nested tree | Omission-preserving field updates do not protect legacy full-tree writes |
| [Program cloning](../../src/routine_programs/crud.py), `_clone_routine` / `clone_program` | Manually reconstructs each `SetTemplate` | Must explicitly copy side and preserve canonical order |
| [Set creation](../../src/exercise_sets/router.py) | Existing POST creates one set per request | Two calls cannot guarantee atomic pair creation |
| [Exercise relationships](../../src/exercises/models.py) | `exercise_sets` has no ORM `order_by` | Define and enforce canonical order across all read paths |
| [Routine service](../../src/routines/service.py) | Saving a workout as a routine clears notes and carries set `type`; applying a routine constructs sets without copying `type` or notes | Encoding metadata in either field is not automatically lossless |
| [Exercise types](../../src/exercises/models.py) | Independent catalog identities with ownership/release rules; no parent/variation relationship | Named variants work as separate types, but have separate histories |
| [Statistics](../../src/exercises/crud.py), `get_exercise_type_stats` | Groups by exercise type and exercise creation date; converts units; volume is intensity × reps; total sets counts rows | Side and variation semantics must be introduced deliberately |
| Same statistics function | Filters deleted sets/exercises, but does not filter `done`; “last workout” uses the latest exercise instance | Completion filtering and multiple same-type instances need explicit handling |
| [PR comparator](../../src/exercises/crud.py), `is_new_personal_best` | Compares load, then reps, then RIR | This is not an estimated 1RM metric |
| [Workout recap](../../src/workouts/recap.py) | Independently calculates current volume and compares with exercise statistics; current sets filter deletion but not completion | Chart and recap policies must agree |
| [Chart](../../../pe-be-tracker-frontend/src/features/exercises/components/ProgressiveOverloadChart/ProgressiveOverloadChart.tsx) | Max-weight and total-volume series | One undifferentiated max-weight line would conceal side differences |
| [Guest store](../../../pe-be-tracker-frontend/src/stores/useGuestStore.ts), [sync mapper](../../../pe-be-tracker-frontend/src/utils/syncGuestData.ts) | Persisted local sets; sync manually enumerates fields and currently omits `type` | Adding a field to an interface alone does not preserve it through sync |

## Domain semantics

### Side belongs to a set

`side` identifies the side participating in the recorded effort:

- `left`: one unilateral effort on the left.
- `right`: one unilateral effort on the right.
- `both`: one bilateral effort using both sides together.
- `null`: unspecified. It must not be inferred to mean both, nor changed by a migration.

An alternating unilateral exercise should be logged as left and right rows when side tracking is desired. The pair shortcut makes this practical. Otherwise users may keep an unspecified row with their existing counting convention. Do not silently convert an old “20 alternating reps” row into “20 each side.”

Reps and duration always refer to the effort represented by that row. Left and right can differ in reps, weight, RPE/RIR, notes, duration, and completion. A completed left row must never imply a completed right row.

The label “Both” needs helper text: “Both sides together. For one side at a time, add left + right.” Keep “Unspecified” available for clearing the field and for activities where laterality is irrelevant.

## Persistence alternatives

The chosen ordering design adds a `position` column to sets and templates. The alternatives below remain a comparison of side storage; the selected implementation is no longer a no-schema-change design. “No new columns” and “no schema changes” are different constraints:

| Option | How | Benefits | Costs / failure modes | Assessment |
| --- | --- | --- | --- | --- |
| A. Human-readable notes | Write “left” or “neutral grip” in existing notes | Zero migrations; immediately understandable | No reliable filters, validation, or automatic charts; notes are cleared on some copy paths | Useful manual workaround |
| B. Versioned metadata in `type` or `notes` | Reserve an envelope such as `setmeta:v1:{...}` and decode it in API adapters | Zero schema changes; can expose typed API fields | All writers/copy paths need a codec; text collisions, old-client overwrites, poor SQL filtering, no relational constraints | Possible time-boxed pilot, not recommended production storage |
| C. Side-specific exercise types | Create “Row — Left” and “Row — Right” | Existing catalog and stats work independently | Catalog duplication, fragmented history, no structured family rollup | User workaround, not the domain model |
| D. Companion tables only | `exercise_set_characteristics(set_id PK/FK, side)` plus template equivalent | No columns added to existing tables; typed constraints and indexes | Still requires migrations; extra joins and lifecycle handling; absence of companion row must mean defaults | Valid if avoiding changes to existing tables is a hard constraint |
| E. New JSONB metadata column | Versioned typed object on sets and templates | Flexible experimentation | Adds columns anyway; validation and querying are less direct than a typed side field | Reserve for genuinely open-ended attributes, not these core semantics |
| F. Typed columns | Explicit side and position fields on sets and templates | Clear API/SQL, cheap filters, ordinary constraints, easier support | Migration, ordering backfill, and copy/sync work | Recommended |

For B, use one documented namespaced envelope, not delimiter combinations such as `warmup:left`. Preserve any ordinary `type` and user notes as distinct logical values. Unknown versions must survive round trips or cause an explicit unsupported-version error; malformed ordinary text must remain ordinary text. Add an escape strategy, length limits, and a deterministic migration decoder. Do not scrape natural-language notes or names to generate authoritative metrics.

Even B requires backend changes, guest migration, and updates to every serializer. It saves the database migration, not most of the implementation work. Existing `type` sync omission and routine-copy behavior must be fixed before any such pilot. If the constraint is specifically “no columns on existing tables,” D is much stronger than text encoding.

## Recommended schema and invariants

Proposed additions to **both** `exercise_sets` and `set_templates`:

| Field | Type / default | Meaning |
| --- | --- | --- |
| `side` | nullable string with CHECK, default NULL | `left`, `right`, `both`, or unspecified |
| `position` | integer NOT NULL, CHECK `position >= 0`; no constant DB default | Zero-based order within the owning exercise or exercise template; assigned by the service |

Use a string CHECK constraint on each table: `side IS NULL OR side IN ('left', 'right', 'both')`. Do not introduce a PostgreSQL enum for this small evolving attribute. Existing records remain NULL; no name- or note-based backfill is proposed. A standalone side index is not required initially: statistics already scope by exercise type and user, so add an index only if query plans justify it.

Validate side in API schemas and authorize set/template mutations through the existing workout/routine ownership rules. Ordinary set updates retain their existing concurrency contract. The pair shortcut creates two distinct rows with explicit left/right values, both undone, through the atomic endpoint specified below. Its request identity is for retry safety only, not a domain pair identifier.

No group tables, membership constraints, group revisions, or routine-rest additions are required for this scope. Routine rest prescription can be evaluated independently if needed.

### Persisted order and correspondence

Order actual sets by `(position, id)` within `exercise_id`, and set templates by `(position, id)` within `exercise_template_id`. Position is authoritative; ID is a defensive tie-breaker, not the domain order. Configure both ORM relationships, dedicated queries, nested/public reads, exports, copy paths, and frontend selectors consistently. Client payload array order must not override explicit positions.

Enforce unique active positions with these indexes:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_sets_active_position
ON exercise_sets (exercise_id, position)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_set_templates_position
ON set_templates (exercise_template_id, position);
```

Set templates have no soft-delete column. Position gaps are permitted; deleting a set leaves the remaining positions unchanged. Restoring an actual set preserves its old position if free, otherwise appends at `max(active position) + 1`. Return its final position and invalidate the ordered list. No routine or exercise ordering column is introduced by this RFC.

All operations allocating/changing positions or active membership must serialize: lock the owning exercise for actual sets, and the owning routine for template operations (including full-tree replacement). Create, pair creation, delete, restore, reorder, import, sync, and tools use the same lock convention. Append single sets at `max(active position) + 1` (zero when empty), including legacy create requests that omit position. The pair endpoint reserves the next two positions and inserts left then right in its existing atomic transaction. Ordinary set-field updates cannot write `position`; order changes use the list operation below.

Add `PUT /api/v1/exercise-sets/exercise/{exercise_id}/order` and `PUT /api/v1/routines/{routine_id}/exercise-templates/{exercise_template_id}/set-order`. Each accepts `ordered_set_ids` and `expected_set_ids`, both complete lists; the latter is the current order observed by the client. After authorization and parent locking, require `expected_set_ids` to match the current active canonical list, otherwise return `409 order_changed`. Require the requested list to be a permutation of exactly those IDs, with no missing, duplicate, deleted, or foreign members. If current order already equals the requested order, return success without writes so a lost-response retry is harmless. This compares current ordering/membership, not unrelated set values.

Assign dense positions `0..n-1` in one transaction. To avoid intermediate uniqueness conflicts, first move affected rows to distinct positive temporary positions above the current maximum, flush, then assign final positions and flush. The partial index cannot be deferred. Check integer bounds before reserving temporary positions. Return the full persisted ordered list. Provide accessible Move up/Move down actions in actual-set and routine editors; drag-and-drop is optional. Optimistic reorder failure restores the prior list and refetches on conflict without dropping edits to other fields.

The first left set corresponds to the first right set, the second left to the second right, and so on in position order. Derive correspondence from non-deleted rows, regardless of completion; both-side and unspecified rows do not participate. Unequal reps or loads do not change correspondence. Extra rows on one side have no counterpart. Reordering, deleting, restoring, or changing a row's side recomputes correspondence; no persistent pair identity is required. This is a display convention, not a link between values or completion states, and does not change per-row aggregation.

Guest sets persist numeric positions, initialized from existing array order during store migration. Pair creation appends two consecutive positions in one store mutation. Guest reorder updates the full list atomically. Sync sends positions and stable local IDs together; for a newly imported exercise it preserves positions, and any merge into existing sets must validate the complete resulting order under the parent lock rather than overwrite colliding slots. Copies and routine-program clones preserve source positions, including gaps, with new IDs. Version-2 full-tree routine replacement validates positions independently of payload array order.

### Position migration and compatibility

Add nullable position columns first. Backfill actual sets using zero-based `row_number()` partitioned by exercise and ordered by `created_at, id`, including soft-deleted rows; this preserves the dedicated query's current order and makes any existing ties deterministic. Backfill templates by ascending ID within each exercise template, matching their current relationship order. Do not infer side during this migration. Validate nonnegative/unique active positions, then add the CHECKs, indexes, and NOT NULL constraints. Guard schema operations through inspection; never overwrite positions already populated in a completed migration.

This is a coordinated backend writer cutover: stop/drain old backend writers during the migration and start only position-aware API, CLI, sync, and tool writers before reopening writes. A constant default cannot safely allocate per-parent positions. Old frontend single-set creates remain supported because the new service allocates omitted positions; old backend processes that insert rows without the new allocator cannot run after NOT NULL is enforced. Validate upgrade with realistic data (including identical timestamps and deleted sets) and downgrade on a disposable copy. After writes reopen, preserve explicit positions through every copying/serialization path.

## User experience

### Recording sets

Keep the normal set table compact. Put a side selector in set options and show a small accessible “L”, “R”, or “Both” chip on tagged rows. Accessible names must read “Left”, “Right”, and “Both sides”; color alone is insufficient.

Provide "Add left + right" alongside Add set. It creates two rows; the second inherits values from the first via the existing copy-on-create default. Both rows start undone, and subsequent edits and completion are independent — no continuous linking between sides is needed. A new set may inherit the previous side as a convenience; alternating/pair entry should be an explicit action, not a hidden guess.

Do not force a side selection for every ordinary bilateral set. New untagged rows remain unspecified unless the user chooses a side or starts from a tagged template. Preserve input focus, keyboard completion, and pending-save feedback.

Use the same side controls for routine prescriptions. Keep workflow and guest/auth branching in feature hooks, pure mapping logic in `lib`, and API operations in `api`. Preserve section-level loading rather than blocking the entire workout page. Failed optimistic writes restore the edited values and completion state.

### Load entry and “both”

Side alone cannot tell whether “10 kg” means one dumbbell, two dumbbells together, a barbell total, or a machine stack. Therefore this release must not multiply a `both` row by two or reinterpret existing intensities.

Show “Volume uses the weight and reps you record; side does not multiply it” in metric help. “Add left + right” should label reps as per-side and load as the load for that side. Retain existing bilateral load conventions; do not silently change them through a new default.

If normalized total external-load volume becomes a product requirement, design a separate recorded `load_basis`/implement-count feature, including historical unknowns. It cannot be derived safely from laterality. This RFC's volume is a logging metric, not a claim of equivalent physiological work across movements.

## Exercise variations: evaluating the alternative

The user's proposed “Exercise-left / Exercise-right” approach works mechanically today by creating separate exercise types, but it conflates **which movement** with **which side performed this set**. Switching a single set's side would require moving it to another exercise instance, and search would list multiple near-identical entries. Adding grip, stance, and side together multiplies catalog entries and splits PRs unnecessarily.

Recommended separation:

| Characteristic | Recommended location | Example |
| --- | --- | --- |
| Side performed | Set / set template | Left row, right row |
| Stable technique variant | Exercise type identity, optionally grouped into a family later | Neutral-grip pulldown |
| Temporary descriptive detail | Set notes until structured support is justified | “Used unfamiliar handle today” |

For an initial grip implementation, use separate existing exercise types (“Pulldown — Neutral grip”, “Pulldown — Wide grip”). They already have distinct IDs and independent histories. Do not infer their relationship by stripping suffixes. Side still lives on their sets.

A later variation feature can add a nullable `parent_exercise_type_id` and validated attributes (for example `grip=neutral`, `stance=narrow`) to these existing identities. Keep it one level deep, reject cycles, and validate permitted attributes per movement. Define ownership/release rules so private variants cannot leak via public parent responses, plus uniqueness within the appropriate owner/release scope. Merge duplicates through explicit reviewed ID mappings, never a rename-based backfill.

The picker would show “Pulldown → Neutral grip,” then side selection remains in the set editor. For v1, a grip change mid-workout adds a separate exercise instance of the chosen variant. A future set-level `variation_id` offers finer editing but complicates history, templates, and validation against the base exercise; it is not needed to ship side tracking.

Family views can combine workload with variant labels and filters. PRs and max-weight lines should remain scoped to a concrete variant: a wide-grip record must not automatically beat a neutral-grip record. Old unclassified types stay separate until explicitly mapped. A family name change must not change exercise IDs or historical results.

## Aggregations and charts

### Metric contract

Keep the existing statistics response behavior available during rollout. Introduce an opt-in, explicitly versioned metric policy (for example `metrics_version=2`) and include the selected policy in the response and frontend query key. Do not silently change the meaning of `totalSets` for old clients.

For v2, eligible performance rows are completed, non-deleted sets under non-deleted exercises, owned by the requesting user. Apply this uniformly to charts, history summaries, PRs, and recap. Planned sets and incomplete counterpart rows do not contribute. This is a deliberate change from current completion filtering and needs separate historical regression review: existing undone rows must not be mass-marked done to make charts match.

Group sessions by workout ID, combining multiple instances of the same exercise type within a workout. “Previous session” for recap means a different, earlier workout, excluding the current workout explicitly. Build daily display buckets from the workout's recorded date using one documented timezone policy, not exercise insertion time. Two sessions on one day contribute to daily volume but remain separate sessions in tooltips and previous-session comparisons.

### Definitions

| Metric | Proposed behavior |
| --- | --- |
| Recorded volume | Sum of unit-normalized load × reps for eligible rows with compatible mass units; no side multiplier |
| Completed sets | Count eligible actual rows; left + right is two sets; a bilateral row is one |
| Reps | Sum recorded reps on eligible rows, including unloaded rows; left 10 + right 10 is 20 recorded reps |
| Max weight / PR | Partition by concrete exercise type or variant, side (`null` is its own bucket), and compatible load/unit semantics; use existing load/reps/RIR comparator within a bucket |
| Timed work | Sum recorded durations with clear “set time” labeling; do not label this workout elapsed time or weight volume |
| RPE/RIR | Preserve per-set values; do not add them or turn one side's effort into the other's |

A bilateral set is not two side-specific observations. Do not split it evenly into left/right series. Unspecified historical sets remain visible in a clearly labeled separate series; absence of a side measurement is missing data, not zero.

Mass conversions should reuse existing canonical intensity utilities. Incompatible dimensions (seconds, distance, assistance, bodyweight conventions) must not be summed into kg × reps. Return metric availability/exclusion counts where needed; unknown load is not evidence of zero work. Timed rows with no reps are excluded from volume and PR comparisons that require reps, but remain in completed-set and duration summaries.

### Worked examples

Assume all rows are completed, loads are comparable recorded kg, and no row is deleted:

| Recorded efforts | Recorded volume | Completed sets | Strength comparison |
| --- | --- | --- | --- |
| Left 10 kg × 10; right 10 kg × 10 | 200 kg·reps | 2 | Separate 10 kg left/right observations |
| Left 10 kg × 10; right 10 kg × 8 | 180 kg·reps | 2 | Preserve the 10-versus-8 rep difference |
| Both 20 kg × 10 | 200 kg·reps | 1 | A bilateral observation; not a unilateral PR |
| Both 10 kg × 10, user records per-dumbbell weight | 100 kg·reps | 1 | Do not infer another implement or double the value |
| Left 10 kg × 10 done; right prescription not done | 100 kg·reps | 1 | Right side is missing, not zero strength |

The fourth example is intentionally not normalized total external load. It demonstrates why `side=both` cannot fix inconsistent load-entry conventions by itself.

### Chart and summary experience

- Volume defaults to all eligible rows of the concrete exercise type, with optional left/right/both/unspecified breakdown and counts. Label units as kg·reps (or the selected equivalent), not simply kg.
- Max-weight views expose separate labeled series or a side filter. Do not connect unknown/bilateral/unilateral points into one apparent progression. Tooltips include side, variation, load, reps, and unit.
- PR cards require a comparison bucket; an overview can list “Left PR” and “Right PR.” Do not select a bilateral record as the winner for an “all sides” personal best.
- Do not show an “imbalance score” in v1. A missing counterpart, different loads, unequal prescriptions, or fatigue order makes naive percentages misleading. Order-based correspondence alone does not establish comparable loads, prescriptions, or conditions. A later comparison needs sufficient comparable evidence; it must not make diagnostic claims.
- Finish summaries, muscle summaries, exports, and AI recap use the same row eligibility and counting definitions. A paired unilateral log can raise a displayed set count versus old bilateral logging; explain the count instead of applying a hidden half-set multiplier.
- Guest logging supports all fields. Current exercise statistics are authenticated-only; do not imply this RFC automatically adds guest chart support. If added later, share fixture-based metric contracts with the backend.

## API, copying, offline state, and interoperability

Extend set create/read/update, nested workout schemas, routine templates, sync schemas, and AI/MCP structured logging schemas with `side` and `position`. Position is returned on reads and accepted in validated nested creation/import payloads; ordinary updates must use the order endpoint to change it. Omitted fields preserve stored values on PATCH; explicit `side: null` clears side. This omission rule applies to field updates (including the existing set PUT); nested full-tree replacement follows the compatibility contract below. Existing workout/routine detail responses include side and position on nested sets/templates, including public reads where those sets are already visible. No dedicated characteristic endpoint is required. Use frontend endpoint constants and preserve collection trailing-slash conventions on existing APIs.

### Legacy routine full-tree writes

Keep the existing routine endpoint, but version its nested replacement contract with an explicit `template_tree_version: 2` request field. For version 2, every supplied set template must explicitly include `side` (even when NULL) and a nonnegative `position`, unique within its exercise template. Missing values return `422`; NULL deliberately means unspecified. An omitted `exercise_templates` remains a metadata-only update and never replaces the tree.

Before any routine update that supplies a tree, lock the routine row and inspect its current stored templates in the same transaction, before deleting anything:

- Without version 2, reject every full-tree replacement with `409 routine_template_version_required`, including an empty tree. Since all stored templates now have authoritative positions, this guard applies even when all sides are NULL. No fields or rows from the rejected request may be committed. New routine creation also requires version 2 when a nested tree is supplied.
- Metadata-only updates remain compatible because they leave templates untouched. Unknown versions are rejected.
- Version 2 permits explicit full replacement, including clearing/removing side-tagged rows and supplying a new position order. Validate the complete tree first. Do not preserve omitted metadata by matching index, exercise name, or repetitions across reconstructed trees.

All owner/admin/tool tree-replacement entrypoints and any direct template-side or position mutations must participate in the same parent-lock discipline, so replacements and template order changes cannot interleave. New clients fetch current detail before editing and submit explicit side and position values. This version contract prevents unsupported-client data loss; it does not introduce general optimistic concurrency protection for two side-aware full-tree editors.

Deploy this guard before enabling side writes. During UI rollback, keep the guard active: an old client may edit routine metadata but must upgrade to create or replace a nested template tree. Do not describe this as old clients preserving unknown fields; the server rejects writes that cannot preserve them.

### Atomic left/right creation and retries

Add `POST /api/v1/exercise-sets/pairs/`, registered before parameterized set routes. Require `Idempotency-Key` (client-generated UUID). The body contains one `exercise_id` and exactly two explicit set payloads, ordered left then right, with `done=false`. Validate both payloads and parent ownership before mutation. Return `201` with both persisted set representations in canonical order. This endpoint provides creation atomicity only; subsequent edits remain independent.

Add a dedicated `exercise_set_creation_requests` table with `user_id`, `operation`, `idempotency_key`, `request_hash`, `result_payload` (JSONB with both original responses/IDs), and `created_at`, with a unique constraint on `(user_id, operation, idempotency_key)`. Use a fixed operation such as `create_left_right_sets`; include exercise ID and normalized ordered payloads in the hash. The key is not stored as a pairing field on either set. The side-column choice therefore still requires this additional table for the full pair shortcut; a strictly no-schema-change pilot must omit that shortcut unless equivalent durable request storage is explicitly provided.

In one database transaction, claim the unique request key, lock the owning exercise, allocate two consecutive positions, insert/flush the left row, insert/flush the right row, store the completed result, and commit once. Lower-level creation helpers must not commit independently. A validation/insertion failure rolls back both rows and the request record. A process crash before commit leaves neither; a lost response after commit is recoverable by replay.

Concurrent requests with the same scoped key serialize through the unique constraint. Resolve a uniqueness conflict via a savepoint/retry and read the committed winning record: the same hash returns the original `201` response without inserting, while a different hash returns `409 idempotency_key_reused`. If the competing transaction rolls back, a waiting request can claim the key and execute. Never return a partially populated result or rely on in-memory deduplication. Recheck current ownership before replay. If the parent no longer exists, return `404`; do not recreate sets.

Keep request records for the owner's lifetime in v1 (no time-based expiration); deleting or editing an individual result set does not free its request key. Replay returns the original creation response, so clients invalidate/refetch current sets rather than treating a replay as current state. Account deletion may cascade request records. Bound key and payload sizes. Reuse the hashing/claim pattern in the existing MCP idempotency code where useful, but do not assume its operation-specific storage or transaction boundaries already satisfy this contract.

The frontend persists a pending pair operation with its key and immutable payload until the outcome is resolved; retries reuse both. Changed inputs require resolving the pending operation first, then an ordinary edit or a new deliberate creation. Guests append both rows and their local identities in one persisted store update; guest-to-auth sync must deduplicate those stable local identities transactionally across retries, including after a lost response. Routine editing creates both template rows within the version-2 full-tree transaction rather than calling this actual-set endpoint.

Copying rules:

1. Copy side and position through workout → routine → workout, routine duplication, **routine-program cloning** (`routine_programs/crud.py::_clone_routine`, invoked by `clone_program`), workout reuse, and import/export. Preserve the concrete exercise type/variant identity and canonical set order as well. Program cloning must copy side and position for every reconstructed `SetTemplate`, including when several program days share a source routine and its clone is reused.
2. Applying a routine creates undone actual sets; copying a prescription must not copy historical completion.
3. Persist side and position in the guest store with a versioned migration. Existing rows migrate to null side and positions from their persisted array order.
4. Sync includes side and position in manually mapped set payloads and resolves local exercise/set IDs as usual. Retries must not duplicate rows, including rows created by the pair shortcut.
5. Extend manual guest/auth adapters and serializers; unknown API fields alone are not sufficient compatibility protection.
6. AI parsing must preserve explicit “left” and “right.” Ambiguous “both sides, 10 reps” should request clarification or remain unspecified, not invent a counting convention. Tools may omit new fields for backward compatibility but must not erase them on updates.

Add side filters, concrete variation identity, and metric version to relevant query keys and invalidation paths so charts update after edits, undo, and sync.

## Delivery and migration plan

1. **Metric fixtures and API contract:** agree on the definitions and example outcomes above; audit all manual mappings and copy paths. No historical reclassification.
2. **Additive backend:** defensive migrations for nullable side columns, backfilled position columns with NOT NULL/CHECKs and position indexes, and the durable creation-request table/unique constraint; atomic pair service and endpoint; versioned tree-replacement guard; position ordering across reads, locked allocation, and atomic reorder endpoints; owner-scoped authorization; updated copy/sync/MCP paths and explicit routine-program cloning support. Inspect existing schema objects before creating or dropping them.
3. **Statistics v2:** implement shared backend metric helpers for chart and recap, versioned responses, side buckets, and completed-set policy. Keep legacy responses available while callers migrate. Include comparisons against realistic historical data.
4. **Side UI and guest parity:** store migration, selector, persisted pair retry operations, independent completion, version-2 routine editor, accessible reorder controls, order-preserving sync, and filtered statistics. Ship behind a feature flag until end-to-end preservation passes.
5. **Variation follow-up:** validate demand for family browsing and grip filters, then write the taxonomy/ownership contract. No requirement to block side tracking on that work.

Deploy additive backend/schema support before merging the dependent frontend, which auto-deploys independently. Preserve the public `/api/...` contract and verify both backend and proxy readiness. Enable writes only when the receiving backend advertises support; never silently send characteristics to a backend that ignores them.

Rollback should disable the UI feature and retain additive data. The server preserves omitted fields on field updates and rejects legacy nested routine creates/full-tree replacements regardless of side values; retain that compatibility guard through frontend rollback. A database downgrade that drops populated metadata loses user information: export/retain it before such a downgrade, and test both upgrade and downgrade on a disposable realistic dataset. No scheduled job is required for this design.

## Validation and acceptance criteria

Implementation tests must cover:

- Null/left/right/both validation, omitted versus explicit-null updates, and independent paired-row edits/completion. Verify first-left/first-right correspondence within each exercise, unmatched extra rows, exclusion of both/unspecified rows, and recomputation after reorder, deletion, restoration, or side changes. Verify position-based order on every nested/dedicated read and deterministic order through copy and guest sync. Completion and unequal reps/loads must not change correspondence.
- Owner-scoped set/template updates reject cross-user writes; nested detail responses preserve side, including explicit NULL values.
- Guest refresh, store migration, failed sync retry, local-ID remapping, duplicate prevention for pair creation, and authenticated refresh with identical characteristics.
- Workout → routine → workout, duplication/reuse, and routine-program cloning round trips, including preserved side/variant identity, canonical order, and reset completion on routine application. Clone a program with repeated references to the same routine and verify every resulting template retains side and position and shared-day reuse remains correct.
- Legacy full-tree replacement of any routine (including an empty tree or all-NULL sides), and legacy nested creation, fail atomically; metadata-only legacy edits remain allowed. Version-2 writes require explicit side and valid unique positions on every row and permit explicit clearing. Race a legacy replacement against a side-aware write and verify the parent lock prevents metadata loss. Cover admin/tool entrypoints and rollback to old frontend payloads.
- Atomic pair insertion fails on the second row without leaving the first; concurrent same-key requests and lost-response retries create exactly two rows with the same returned IDs. Changed-payload key reuse returns 409. Retry after result-set edit/deletion never recreates it. Guest pair creation and lost-response sync retries retain exactly two stable local/server identities.
- Position backfill with deleted rows/timestamp ties, NOT NULL enforcement, concurrent append/pair requests, soft-delete slot reuse, restore collisions, and complete-list reorder validation. Conflicting reorder returns 409; identical retries succeed; intermediate swaps do not violate uniqueness. Test legacy single-set position allocation, ordered guest sync, and rollback of optimistic reorder.
- Every worked metric example, mixed kg/lb, zero/unloaded reps, unknown loads, timed sets, deleted and undone rows, old unspecified history, multiple same-type instances, and same-day separate sessions.
- No cross-side/cross-variant PR comparisons; recap excludes the current workout from previous-session comparisons.
- Focus, keyboard behavior, compact mobile layout, pair creation, accessible reorder controls, optimistic rollback, query invalidation, and partial rendering. Add dedicated hook tests and shared nested fixtures.
- Old-client payloads, API/MCP structured logging, and exports preserve metadata or explicitly report unsupported semantics.

For implementation, run focused backend tests during iteration, then `uv run ruff check .` and `uv run pytest` from `backend/` with the dedicated test DB. Run frontend lint, typecheck, relevant unit/hook tests, and focused Playwright flows from `pe-be-tracker-frontend/`. This RFC itself changes documentation only; it does not claim those runtime checks have been performed.

Success means a user can prescribe and log unequal left/right sets for a concrete exercise or grip variant, refresh, sync or reuse the workout as a routine, and see the same side labels and correctly scoped history without losing information or changing old records.

## Decisions to confirm before implementation

The recommended defaults are sufficient for implementation planning; these remain product decisions:

- Accept the explicit bilateral meaning of “Both,” with a two-row shortcut for one side at a time, or require an additional “each side” mode and a separate load/reps-basis design?
- Accept completed-only statistics v2, including the visible difference from historical row-counting behavior?
- Ordering storage is decided: add `position` to actual sets and set templates. Typed `side` columns remain the recommended companion change; the no-column alternatives are retained for comparison only.
- Is structured grip-family browsing needed in the first release, or are existing independent exercise types sufficient until the variation follow-up?
