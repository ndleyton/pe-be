# RFC 0010: Reliable repeated +/− input in ExerciseSetTable

- **Status:** Proposed; implementation not included.
- **Date:** 2026-09-15
- **Source revision:** `c9310250`
- **Scope:** Rep steppers, their displayed values, and persistence through the exercise-set editing flow, for authenticated and guest users.

## Summary

Users report that fast repeated +/− presses do not register. There are two different questions: did the application accept and display each press, and did it save the resulting value?

The current implementation intends to accept every press immediately and combine server writes after 500 ms of inactivity. Combining writes is appropriate for this interaction; dropping presses is not. The inspected path contains no deliberate click deduplication or rate limit. It does contain a reproducible persistence race: an older request's cleanup deletes newer pending work for the same set. Overlapping requests also lack protection against older values being committed last.

**Recommendation:** Keep immediate local updates and batched absolute-value writes, but replace the shared timer/request entry with a per-set writer that separates pending changes from the request in flight. Preserve dirty edits across server refreshes, make saving failures visible and recoverable, and separately improve the stepper's hit area and accessibility. Keep the 500 ms delay initially so correctness and timing changes can be evaluated independently.

These findings demonstrate defects that can explain some complaints, not the cause or prevalence of every production report. Physical-device input behavior, render latency, and the relationship between reported complaints and these races still need measurement.

## 1. User contract and terminology

For an editable set starting at 10 reps:

- Five + activations should immediately produce 15 locally, even while saving is slow.
- Subsequent − activations must operate on that latest local value.
- Apply the zero boundary to each activation in order. Starting at zero, `−, +` results in one; summing the deltas first would incorrectly produce zero.
- A display of 15 means the current local intent is 15. A saved indication means that intent has been acknowledged, not merely that a request was started.
- After writes finish, reloading should show the same value. Failures must not silently replace the user's intent.
- Completed sets remain read-only. A − activation at zero is an intentional no-op and should have understandable feedback.

**Debouncing** waits for a quiet period before saving. **Coalescing** combines changes into the latest field values. **Deduplication** suppresses duplicate delivery of the same operation. Two intentional + presses are two different operations, even if they occur close together. We should coalesce their resulting write, not deduplicate their intent.

## 2. Current implementation and evidence

Paths below are relative to the repository root; links resolve from this RFC.

| Layer | Observed behavior | Implication |
| --- | --- | --- |
| [ExerciseSetTable.tsx](../../../pe-be-tracker-frontend/src/features/exercises/components/ExerciseRow/ExerciseSetTable.tsx), `ExerciseSetRow` | +/− call handlers through `onClick`; disabled only for `set.done`. Classes request `h-6 w-6`; icon-only steppers lack explicit accessible names. | No intentional input debounce. Small targets are a plausible usability contributor; measure actual browser bounds. |
| [useExerciseSetActions.ts](../../../pe-be-tracker-frontend/src/features/exercises/hooks/useExerciseSetActions.ts), `incrementReps`, `decrementReps`, `applyLocalExerciseSets` | Reads and synchronously replaces `exerciseSetsRef.current`, updates React state, and publishes to the parent. | Successive handler calls can accumulate without waiting for a render or server response. |
| Same file, `queueSetUpdate` | Merges absolute field values per client key; resets a 500 ms timer. The entry remains present while its request awaits completion. Every request unconditionally deletes the entry in `finally`. | The timer and request share mutable ownership; older completion can erase newer work. There is no serialization. |
| [useExerciseRowState.ts](../../../pe-be-tracker-frontend/src/features/exercises/hooks/useExerciseRowState.ts) | `repsInputs` is separate string state, rebuilt in an effect when sets change. The table prefers this string over `set.reps`. | Additional synchronization step; incoming changes can replace drafts. This needs component-level investigation, not an assumption that clicks are lost. |
| [useWorkoutExerciseActions.ts](../../../pe-be-tracker-frontend/src/features/workouts/hooks/useWorkoutExerciseActions.ts), `handleExerciseUpdate` | Publishes authenticated edits into query cache; guest edits into the guest store. | Guest edits bypass this HTTP debounce entirely. Guest complaints require a separate diagnosis. |
| [exercises.ts](../../../pe-be-tracker-frontend/src/features/exercises/api/exercises.ts), `updateExerciseSet`; [client.ts](../../../pe-be-tracker-frontend/src/shared/api/client.ts) | Direct Axios PUT with supplied fields. Client interceptors provide headers/error reporting, not a write queue or request deduplication. | Query-cache deduplication is not the mechanism saving these edits. Global mutation retry settings do not wrap these direct calls. |
| [router.py](../../src/exercise_sets/router.py), [service.py](../../src/exercise_sets/service.py), [crud.py](../../src/exercise_sets/crud.py), [schemas.py](../../src/exercise_sets/schemas.py) | Ownership-checked update of supplied fields using `exclude_unset=True`, although HTTP method is PUT. No expected revision or operation ID in this update contract. | An absolute write cannot distinguish a newer user intent from an older request that reaches the database later. |

### Verified diagnostic results

Temporary Vitest probes exercised the actual `useExerciseSetActions` hook with stable fixture props, fake timers, and manually resolved API promises:

1. **Normal burst:** ten synchronous increments from 10 produced local 20 immediately and one API call with `reps: 20` after 500 ms. This argues against a generic stale-handler or intentional click-deduplication explanation at this layer.
2. **Lost pending write:** the schedule below produced local 12, only one API call (`reps: 11`), a caught `TypeError`, and query invalidation. The second write never reached the API mock.
3. **Overlapping writes:** holding both requests open and simulating server commits in reverse order left local 12 and simulated server 11. This verifies that the client permits this schedule; it is not a live database reproduction or proof that response order equals database commit order.

All three probes and the existing `useExerciseSetActions.test.ts` and `useExerciseRowState.test.ts` tests passed: **19 tests total**, including 16 existing tests. Probe assertions intentionally described the observed defects; they are not passing regression tests for a fix. The temporary probe file was removed to keep this proposal documentation-only. The following schedules make the probes reproducible in implementation work. No production traffic, physical-device session, or live backend was used.

### Concrete lost-write schedule

| Time | Action | Local reps | Queue/request state |
| --- | --- | --- | --- |
| 0 ms | + from 10 | 11 | Timer A scheduled. |
| 500 ms | Timer A fires | 11 | Request A sends 11; pending entry remains. |
| 550 ms | Another + | 12 | Same entry gains 12; timer B scheduled for 1050 ms. Clearing the old timer cannot stop request A. |
| 600 ms | Request A resolves | 12 | A's `finally` deletes the entry that now holds B's work. |
| 1050 ms | Timer B fires | 12 until reconciliation | Reading `.data` on the missing entry throws; catch logs and invalidates the exercises query. No write of 12 occurs. |

A refetch can then return 11, which incoming-prop synchronization accepts, giving the appearance that a press was undone. Without a usable invalidation key or successful refetch, local 12 can remain visible until reload instead.

For overlapping writes, start A at 500 ms, accept another press while A is pending, and let B's timer fire before A settles. Both writes are now outstanding. A generation guard around cleanup would protect queue ownership but would not prevent older database writes from winning.

### Other risks identified by inspection, not reproduced in the probes

- **Incoming data overwrites:** the effect keyed by `exercise.exercise_sets` adopts incoming sets without tracking dirty fields. A refetch or parent replacement can overwrite newer local edits. Window-focus refetch is disabled globally, so do not attribute this specifically to focus without evidence; explicit invalidations and other fetches still exist.
- **Draft/blur interaction:** typing changes `repsInputs`; blur commits the draft, while stepper handlers read the numeric set model. Verify typed-value → stepper event ordering and active drafts when another field changes. Rebuilding every input record can overwrite uncommitted text.
- **New sets:** the create response replaces the optimistic set with server values, potentially replacing edits made to that same temporary set. A 500 ms timer can also expire before its real server ID exists. Current tests cover ID reconciliation when creation finishes before flushing, not all slow-create schedules. The existing late-create test protects edits to a different, existing set.
- **Delete/unmount:** deletion does not cancel queued set edits. Cleanup on unmount sends entries again, including entries whose request is already in flight; these writes are neither awaited by navigation nor a durable guarantee on browser exit.
- **Done/Finish/recap:** completion and options use separate immediate requests. Workout finish and recap generation do not await a shared set-save barrier. They can observe stale persisted reps even when the row looks correct.
- **Presentation and device input:** small adjacent targets, delayed rendering, browser gestures, focus behavior, and touch cancellation could explain missing activations before persistence is involved. None is established as a production cause yet.

## 3. How to distinguish the causes

| Symptom | First evidence to collect | Likely area |
| --- | --- | --- |
| A touch produces no handler activation | Target bounds, pointer/click/cancel sequence, device/browser, completed state | Hit testing, gesture behavior, intentional disabled state |
| Handler runs but local count does not advance | Before/after local revision, client key, zero boundary, incoming-prop replacement | Local state/reconciliation |
| Local count advances but rendered input lags or resets | Rendered draft vs local model and render timings | Draft ownership, effect synchronization, rendering cost |
| UI is correct but reload is wrong | Queued revision, sent revision, acknowledgement, API failure and readback | Queue race, write ordering, failed save |
| Reproduces only on newly added sets | Create resolution time, temporary/server ID transition | Create/edit dependency |
| Reproduces in guest mode | Guest state before/after, hydration and storage outcome | Shared UI or guest persistence; not this authenticated HTTP queue |

Collect sampled burst summaries rather than one analytics event per tap: session-scoped set correlation token, auth/guest mode, activation count, clamped no-op count, local/rendered/acknowledged revisions, request count, queue age, failure category, and time to visible update. Do not collect notes or raw workout values for this diagnosis. Existing request IDs can correlate API failures; add explicit queue errors because a pre-request `TypeError` is not an Axios failure.

Compare 50–150 ms bursts, pauses around 500 ms, and delayed requests of 100–2000 ms. Test actual iOS Safari and Android Chrome as well as desktop mouse and keyboard. Emulated clicks alone cannot establish physical touch reliability.

## 4. Options and tradeoffs

These are composable choices. Persistence strategy, state ownership, and interaction design should be evaluated separately.

### A. Keep behavior; add measurement and save feedback

Expose delayed “Saving…” and persistent “Couldn’t save — Retry” status, plus diagnostic instrumentation.

- **Pros:** Small scope; distinguishes accepted input from saved input; provides evidence for device-specific complaints.
- **Cons:** Does not repair the demonstrated race or request ordering. A status based only on the latest completed request can falsely say “Saved.” Feedback without revision tracking is insufficient.
- **Disposition:** Include as a complement, not the sole resolution.

### B. Tune the debounce or use throttled saves

Shorten the 500 ms delay, add a maximum wait, or periodically send the latest value during continuous interaction. Local activation handling stays immediate.

- **Pros:** Shorter unsaved windows; maximum wait prevents continuous activity from postponing persistence indefinitely; longer delays reduce request count.
- **Cons:** Shorter delays increase request traffic and opportunities for overlapping writes. Longer delays increase exposure to navigation/exit. Throttling needs a trailing write or the final value can be lost. No timing value fixes unsafe queue ownership.
- **Disposition:** Tune only after correctness. Consider an initial maximum wait of 2 seconds as a proposal to validate, measured from the first unsent change; it cannot promise a server acknowledgement during a slow request or offline state.

### C. Minimal queue ownership patch

Capture an immutable batch when a timer fires, detach it from pending work, and let completion clean up only its own generation. New edits create a separate batch.

- **Pros:** Small targeted fix for the demonstrated deletion race; preserves current API and interaction; suitable as an interim patch.
- **Cons:** Detaching alone still allows concurrent writes and stale commits. It does not resolve refresh, lifecycle, or failure recovery. A guard on deletion alone is even narrower and insufficient.
- **Disposition:** Useful emergency mitigation if isolated, with explicit remaining risks; prefer D as the complete local writer fix.

### D. Immediate local state + serialized, coalesced per-set writer — recommended

Maintain one request in flight per set and a separate pending patch. Debounce pending changes; if a request is in flight, retain the latest unsent values and send them when eligible after it settles. Different sets can save independently.

- **Pros:** Every activation counts; low request volume; solves queue ownership and successful-request ordering within the writer; integrates naturally with existing absolute-value API. No backend schema change required for the initial fix.
- **Cons:** Requires explicit lifecycle, dirty-field, and error state. Slow requests delay subsequent saves. One component-local queue is insufficient across remounts or multiple editors. Client serialization cannot fully protect against another device or a timed-out request that still commits later.
- **Disposition:** Preferred baseline, owned above individual row lifetimes, with uncertainty handled explicitly and optional server revision support below.

### E. Save every activation immediately

Send absolute values for each click, either concurrently or through a FIFO queue.

- **Pros:** Simple input-to-request mapping; no quiet-period wait; useful diagnostic baseline.
- **Cons:** Concurrent writes can arrive out of order. FIFO prevents normal overlap but creates a backlog of obsolete intermediate values; requests scale with taps. Increased network/server work does not inherently improve visible responsiveness, which is already intended to be local.
- **Disposition:** Concurrent mode rejected for correctness. FIFO is viable for low-volume controls, but coalescing superseded absolute values makes it effectively D with a different send policy.

### F. Disable controls while saving, or suppress closely spaced presses

- **Pros:** Simple way to limit outstanding writes; a visibly disabled control can explain why input is unavailable.
- **Cons:** Intentionally rejects the user's expected repeated input and ties workout entry speed to network latency. An invisible click cooldown is particularly confusing. Does not repair all other update paths. Buffering all activations instead of rejecting them leads back to a queue.
- **Disposition:** Reject for ordinary saving. Retain disabling for genuine read-only states such as completed sets.

### G. Explicit Apply/Save, blur-only, or Done-only persistence

Accumulate changes locally and save at a deliberate boundary.

- **Pros:** Clear commit action; fewer requests; can submit one coherent set snapshot. A dedicated editing dialog can offer larger controls.
- **Cons:** Additional action or navigation overhead; easy to forget saving; blur is unreliable as the sole boundary for stepper-only use. Done-only saving conflates editing with workout completion. Browser exit still needs recovery. Multiple explicit commits can still overlap unless serialized.
- **Disposition:** Viable product redesign if users want a draft workflow, not necessary to fix fast repeated presses. Explicit Retry is still valuable with autosave.

### H. Server-side increment/decrement operations with operation IDs

Send an adjustment command with a unique ID per intentional activation. Retry using the same ID; the server applies that operation at most once within its deduplication contract.

- **Pros:** Atomic adjustments avoid read-modify-write conflicts for concurrent increments; explicitly distinguishes intentional repeated input from duplicate delivery. Supports a command history if needed.
- **Cons:** Backend/API/storage changes; operation-ID retention and retry semantics; mixed direct typing and deltas need defined ordering. Atomicity alone does not preserve mixed +/− order at zero. Offline replay and concurrent mode changes add complexity. More requests unless commands are batched, and net-delta batching is incorrect at a clamp boundary.
- **Disposition:** Consider for genuine concurrent command editing. Excessive scope for a single user's rep editor unless that requirement emerges.

### I. Server revisions / conditional writes

Include an expected server revision with an absolute update; atomically reject mismatches and return the current state. The client explicitly rebases or presents a conflict.

- **Pros:** Protects against stale writes across devices, remounts, independent writers, and ambiguous delayed requests. Pairs with D without changing stepper semantics.
- **Cons:** Requires API/database changes and conflict UX. Retrying the same stale payload is not a conflict policy. Every relevant writer must participate; updates to disjoint fields may need field-level merge rules to avoid excessive conflicts.
- **Disposition:** Preferred hardening if cross-device editing or ambiguous timeout races are material. Keep the public `/api/...` routing contract; use defensive migrations if adding a revision column.

### J. Durable local outbox for authenticated edits

Persist unsent intent in IndexedDB, replay through the writer on reconnect/reopen, and scope it to the authenticated account.

- **Pros:** Recovers edits across refresh, browser termination, and connectivity loss; supports a consistent local-first experience.
- **Cons:** Substantial complexity: account isolation/logout, stale edits, deletion tombstones, migrations, conflict resolution, retention, and duplicate delivery. Local storage can also fail. Durability does not solve ordering without a correct writer and server protocol.
- **Disposition:** Separate phase if offline/reload recovery is a product requirement. Do not describe a best-effort unmount flush as durable saving.

### K. Simplify draft and optimistic state ownership

Use one current numeric model for stepper values and explicit string drafts only while typing. Track dirty fields/revisions so incoming server data updates clean fields without erasing unsaved intent. A feature hook exposes one adapter to the table for guest/auth modes.

*(Historical context: The current persistent `repsInputs` string dictionary was explicitly added to allow `null` values to render as a blank space instead of `0`. Option K must preserve this by rendering the unfocused numeric model as `set.reps === null ? "" : set.reps`, keeping string drafts only for the actively focused input.)*

- **Pros:** Removes competing sources for the visible value; protects active typing; makes blur/stepper composition explicit; can reduce redundant renders and full-record rebuilding; safely preserves the "blank space instead of zero" requirement without an app-wide string state dictionary.
- **Cons:** Refactor and regression risk across intensity, reps, duration, unit conversion, and mode switching. Empty and partially typed values need deliberate semantics. Does not independently fix server ordering.
- **Disposition:** Pair with D, keeping `ExerciseSetTable` presentational and splitting pure state helpers from transport.

### L. Improve the stepper interaction itself

Increase measured hit targets and spacing, add “Increase reps”/“Decrease reps” accessible names with set context, set `type="button"`, and provide clear pressed/focus feedback. Proposed target size is 44×44 CSS pixels where the mobile layout permits; validate narrow layouts rather than overlapping invisible hit areas. Make the zero boundary understandable without implying a failed save. *(Context: The current h-6 w-6 or 24x24 CSS pixels hit targets are significantly smaller than the recommended mobile tap target sizes of 44x44px for iOS and 48x48px for Android. While fixing the queue race condition is paramount, the small hit targets are absolutely contributing to the perception of "missed" presses on mobile.)*

- **Pros:** Addresses missed physical targets and discoverability; low transport risk; keyboard access and predictable native button behavior remain available.
- **Cons:** Consumes row width/height; may require layout changes. Does not fix persistence or guarantee a device-specific gesture issue is resolved.
- **Optional hold-to-repeat:** Fewer taps for large changes, but risks overshoot and requires delay/rate tuning, pointer cancellation, focus/unmount cleanup, and avoiding an extra release click. Keep direct typing available.
- **Optional pointer/touch changes:** Test targeted `touch-action` behavior or earlier pointer activation only when traces show a need. Pointer-down changes can fire during a scroll and duplicate click activation; preserve keyboard activation and browser zoom accessibility.
- **Disposition:** Ship target/label improvements alongside correctness; evaluate hold-to-repeat and gesture changes separately on real devices.

## 5. Recommended design

### Ownership and state

Create a feature-level writer keyed by account, workout, and stable set client key, with a mapping to server ID. Its lifetime must outlast row collapse/remount. Define explicit teardown on account/workout transitions; do not let requests leak across accounts. Keep guest transport in its existing local persistence adapter.

For each set, track:

- Latest local model and per-field dirty revision; an optional focused string draft.
- Pending patch, first-pending time, debounce deadline, and batch revision.
- Immutable in-flight patch and its revision.
- Last acknowledged values/revisions, creation dependency, deletion state, and save error.

On each +/− activation, synchronously calculate from the latest local intent, apply the per-activation clamp, update the displayed model, and merge an absolute value into pending work. Never put HTTP calls inside a React state updater. If a valid typed draft is active, explicitly commit it before applying the step; empty input uses the existing zero baseline. Define invalid input behavior consistently with the text editor.

When sending, detach an immutable batch from pending state. New edits belong to a new batch. On success, acknowledge only the sent revisions; never replace newer local values with an old response or clear a newer patch. If pending work is due, send it next. A scheduled callback with no pending work is a harmless no-op, not an exception.

Serialization handles normal completion ordering, but a timeout does not prove the server stopped processing the request. Mark the state uncertain, retain intent, and reconcile before claiming success. For a strict guarantee against late commits after timeout, use I; cancelling a request or ignoring its response alone cannot guarantee database ordering.

### Related workflow rules

- **Errors:** Preserve unsaved fields, expose Retry, and merge failed fields underneath newer pending values so old retries cannot overwrite newer intent. Distinguish recoverable connectivity failures from validation/auth/deletion errors. Avoid blanket refetch-and-replace rollback.
- **Incoming reads:** Merge clean fields, preserve dirty fields and focused drafts, and do not consider an optimistic cache value a server acknowledgement. After dirty work settles, reconcile with a fresh read when needed.
- **Creation:** Queue edits until a real server ID exists. Merge the create response with newer local edits instead of replacing them. Surface failed creation; do not PUT to a temporary ID.
- **Deletion:** Tombstone the set, cancel unsent edits, and coordinate any in-flight work before deletion; do not retry edits to a deleted entity.
- **Done/options:** Route set writes through the same owner. Done may display optimistically, but its persisted transition must follow or include the latest edited fields. Commit focused drafts before establishing the save barrier.
- **Finish/recap:** Await all relevant set revisions before generating recap or finalizing a workflow that depends on saved values. Keep the screen usable while saving; on failure, offer retry and preserve the workout.
- **Navigation:** Flush through the same writer, not a separate cleanup request. Keep an app-lifetime owner or await the barrier for deliberate navigation. Browser/process exit remains best effort without J.
- **Status:** Show Saving only after a short delay to avoid flicker; show an error persistently. “Saved” requires no pending batch, no in-flight request, and acknowledgement of the current revision. Guest wording should distinguish local persistence from server sync.

## 6. Validation and acceptance criteria

Use dedicated hook tests with shared fixtures and controlled promises. Advance fake timers inside `act`; avoid timer-dependent `waitFor`. Add component tests for actual input values and event ordering, plus browser tests for reload/readback. Do not infer touch reliability from hook tests.

| Scenario | Required result |
| --- | --- |
| Ten + activations in one synchronous burst and ten at 50 ms intervals | Local/displayed 20 from 10; one final write after quiet time when no maximum-wait boundary was crossed. |
| Mixed +/−, zero and null baselines | Ordered application; never negative; clamped no-op distinguished from lost activation. |
| New input while an earlier request is in flight | New patch survives earlier success or failure; later final value is persisted. |
| Timers at 499/500/501 ms and both completion orders | No undefined-entry exception; at most one normal request in flight per set; current intent preserved. |
| Two or more sets edited together | Independent progress and batching; no cross-set cancellation or global serialization. |
| Reps plus intensity/duration edits | All intended dirty fields preserved; reps/duration exclusivity and unit conversion maintained. |
| Type → click stepper; blur/Enter/Escape; another field updates while typing | Defined draft commit/cancel semantics, no duplicate increment, no erased active draft. |
| Slow create, create failure, edit/delete before create resolves | No temporary-ID update; latest draft preserved and clear recoverable state. |
| Stale refetch while dirty | Dirty local value remains visible; clean fields can refresh; eventual server readback matches accepted intent. |
| Offline, validation failure, timeout, retry with newer edits | No false Saved; draft retained; older retry cannot replace newer intent; uncertainty policy exercised. |
| Done/Finish/recap/navigation immediately after tapping | Required writes acknowledged before dependent server actions; no duplicate unmount write. |
| Guest hydration/storage and reopen | No HTTP set writes; saved guest result survives local reload when storage succeeds; failures are distinguishable. |
| Actual mobile taps, rapid alternation, scrolling and keyboard activation | Every delivered activation counted once; no accidental scroll activation or duplicate pointer/click path. |

Proposed release targets, to validate rather than present as measured results:

- Zero lost accepted activations or stale final readbacks in deterministic test schedules.
- Zero missing-queue exceptions and zero overlapping normal writes for the same set in the new writer.
- p95 activation-to-visible-value latency below 100 ms on agreed representative mobile devices.
- One write for an isolated burst shorter than the maximum-wait window, and bounded request frequency for sustained input.
- No claim of reliable browser-exit recovery or conflict-free multi-device editing until the corresponding protocol exists.

Run the relevant hook/component suites, frontend lint and typecheck, then browser scenarios with delayed/error responses and real backend readback. This RFC changes no application code; backend test/ruff gates apply if a later implementation changes the API or models.

## 7. Rollout and decisions

1. **Reproduce and baseline:** Turn the diagnostic schedules into permanent regression tests; collect the symptom split and compare authenticated versus guest sessions. Existing single-click and debounce tests do not cover these races.
2. **Correctness:** Implement D with queue ownership, dirty-field reconciliation, creation/deletion dependencies, and failure visibility. Use K to make displayed-value ownership explicit. Establish the Done/Finish/recap barriers before claiming end-to-end reliability.
3. **Interaction:** Ship L's basic target/label improvements after checking mobile row layout. Measure feedback latency and report reduction independently of request count.
4. **Tune and extend:** Evaluate B only with the safe writer. Adopt I for stronger concurrency guarantees and J for durable offline edits when requirements justify them. Hold-to-repeat remains an independent UX experiment.

Roll out to a small cohort with queue-error, unresolved-dirty-age, request-volume, and complaint monitoring. Expand only after correctness and responsiveness targets hold. Drain or explicitly hand off pending work before switching writer implementations; never run both for the same set. Roll back optional timing/UI experiments independently so reverting an experiment does not reintroduce the known queue race.

### Decisions requested from RFC reviewers

- Accept D + K and basic L as the baseline, with 500 ms unchanged initially?
- Is preserving edits across browser termination required in the first release, making J part of scope?
- Is concurrent editing across devices expected, making I necessary immediately? **No. While users could have the app open on two devices, live concurrent editing of a single workout set is an extreme edge case. Option I (Server Revisions / Conditional Writes) would require backend database schema changes and frontend conflict resolution UI. We should stick to "last write wins" for now to keep the scope tight.**
- Should prolonged save failure block Finish until retry succeeds, or offer an explicit exit with retained local drafts? The latter requires defined durability and recap behavior.
- Which representative mobile devices and accessibility input methods define acceptance?

**Conclusion:** Treat every intentional +/− activation as input to preserve. Coalesce the resulting persistence work safely. The current code already follows that intention locally, but its asynchronous queue does not reliably uphold it.
