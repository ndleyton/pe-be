# RFC 0014 — A shared exercise catalog for guests and signed-in users

**Status** Proposed · **Date** 2026-11-17 · **Scope** Exercise discovery, guest workout logging, and Google sign-in

## Product decision

Anyone should be able to open the picker, find a released exercise, log sets, and finish a workout. Give guests and signed-in users the same online catalog, search, muscle filters, and pagination. Keep guest workouts on the device across reloads. After a guest finishes a workout, offer **“Sign in with Google for your free AI recap”** alongside the option to finish as a guest. Tracking and AI coaching both remain free.

The seeded catalog originated as part of offline logging. End-to-end offline logging has already stopped working reliably. Maintaining a separate picker now limits the exercises guests can find without delivering that original benefit. This proposal retires the seed for new guests. Restoring end-to-end offline logging would be a separate decision.

## Share catalog reads and preserve local workouts

The [catalog endpoint](../../src/exercises/router.py) accepts an optional user today. The [picker results hook](../../../pe-be-tracker-frontend/src/features/exercises/hooks/useExerciseTypeModalResults.ts) enables server queries only for authenticated users and separately filters guest records. The [guest initializer](../../../pe-be-tracker-frontend/src/stores/guestStoreSeedData.ts) generates exercise type IDs and seeds the browser.

| Action | Guest | Signed in |
| --- | --- | --- |
| Browse and search | All released exercises from the API | Same API, with existing visibility rules for the user's own types |
| Log a public exercise | Save its server ID as a string and a display snapshot with the local workout | Save through the workout API |
| Create a custom exercise | Keep a local ID and definition, reusable in later workouts on this device | Use the existing authenticated creation flow |
| Finish a workout | Save locally and offer Google sign-in for a free recap | Use the existing recap flow |

Use the existing browse and search queries in both sessions. Keep visibility-sensitive results scoped to the current session or account, including retained search results on sign-out. Use API muscle groups and pagination. Show loading, retry, and empty states consistently. A catalog request failure must leave the open workout and its logged sets intact.

Keep guest-created types accessible in a small *My exercises* list in the picker. Search can match those local names alongside server results. This list contains only the guest's own definitions. Public selections need a display snapshot for workout history, but selecting a public type should never add a second searchable catalog entry. Keep workout-type initialization unchanged.

### Thumbnails in guest results

The asset route requires sign-in for `generated/` paths, and the URL resolver can return those paths. Before enabling the guest picker, inspect image URLs returned for released types in anonymous browse and search. For generated artwork approved for public display, serve the corresponding published asset through the existing publication path. When a released type has only a private image, omit its URL from the anonymous response and render the picker's no-image state. Keep access controls on generated originals and candidate uploads. [Asset route](../../src/exercises/router.py) · [Image URL resolver](../../src/exercises/image_assets.py)

### Existing devices and Google sign-in

- Stop generating exercise seeds on fresh installs. Hydrate older stores with their original IDs, names, units, and workout references. Preserve legacy definitions needed by existing workouts, routines, or custom selections. Where the old format cannot reliably distinguish a seed from a custom type, retain the definition. Avoid guessing identity from a display name during migration.
- Match catalog selections by explicit server exercise-type ID only. Validate both direct IDs and legacy external IDs against released-or-owned visibility. Remove the exercise-type `ilike(guest_et.name)` fallback. A local definition without a server ID creates a private candidate for the signing-in user, even when a released type has the same name. Persist the resulting ID against the account and local type ID for future imports. Treat names (including `%` and `_`) as literal labels. If a distinct local type conflicts with the owner's unique candidate-name constraint, report the conflict and retain the local data for resolution. [Bulk import service](../../src/sync/service.py) · [Exercise type constraints](../../src/exercises/models.py)
- An unresolved or inaccessible exercise ID must leave its workout recoverable. Today the server can skip an exercise and the client can clear the guest store after a successful response. Roll back an incomplete bulk import and retain the local data for retry. [Sync client](../../../pe-be-tracker-frontend/src/utils/syncGuestData.ts)
- The store can also contain routines, while the current bulk payload omits them. Clear only confirmed imports and retain any routine and its dependencies until it has been imported. Test both a routine-only device and one with workouts and routines. The catalog rollout can proceed without implementing routine import if those local records remain recoverable.

### Workout IDs on import and retry

The current duplicate check skips a workout when the owner and `start_time` match. Two distinct workouts can share that timestamp. Persist a mapping from `(user_id, guest_workout_id)` to the server workout ID in the same transaction as the workout, exercises, and sets. Enforce uniqueness on the mapping key. Two distinct guest IDs with the same start time each create their own workout. A repeat of the same guest ID, including a concurrent retry, returns the committed workout ID and creates no additional rows. Historical imports lack this mapping. A timestamp collision with an unmapped legacy workout is insufficient evidence to link the two.

Extend the backend and frontend `SyncResult` with `workoutIdMap: Record<string, number>`. Every successful import includes an entry for every submitted workout, including previously imported ones. The duplicate branch adds the existing ID to the map before continuing. Keep the existing count fields. Persist the map in the request-level sync log so replaying an idempotency key, including after a concurrent request wins, returns the same map. A retry with a fresh key recovers IDs from the per-workout mapping. Treat a legacy counts-only replay as unconfirmed and preserve the local data if the mapping cannot be recovered. [Response schema](../../src/sync/schemas.py) · [Sync log](../../src/sync/models.py)

The client remembers the guest ID of the workout that prompted Google sign-in, checks that every submitted ID is accounted for, then uses that workout's mapped server ID to request the recap. A missing map or entry leaves the guest data available for recovery.

## Release and acceptance

Deploy the import changes first, then switch the picker to the shared catalog and stop generating exercise seeds.

- On a fresh device, find a released exercise absent from the old seed, log it alongside a custom exercise, reload, and finish as a guest. Sign in with Google and verify the recap belongs to that workout.
- On an existing device, verify that exercise names, units, sets, and routines survive hydration and a failed import. Retry after a lost response and verify the workout appears once.
- Import two guest workouts with different IDs and identical start times. Verify they get distinct server IDs and the selected workout gets the recap. Replay the request with the same key and then a fresh key. Both must return the original mappings, with no extra workouts, sets, or custom types.
- Import local types named `Bench`, `%`, and `_` alongside a released `Bench`. Verify each local ID resolves to its own private candidate and a selection carrying the released ID still resolves to the public type.
- Fetch released-type results as a signed-out user and request their actual thumbnail URLs without cookies. Verify published images load, a generated-only private reference renders the no-image state, and the protected original still requires sign-in.
- Exercise search, clear the query, and select a result. Change muscle filters while loading, paginate, and retry a failed request. After sign-out, verify that private results from the previous account disappear.

Evaluate the product change with completed first workouts per new visitor and the share of guests who receive a recap after choosing Google sign-in. Track catalog request failures and incomplete imports separately so a failed handoff is distinguishable from someone choosing to keep logging as a guest.
