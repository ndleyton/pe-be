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

### Existing devices and Google sign-in

- Stop generating exercise seeds on fresh installs. Hydrate older stores with their original IDs, names, units, and workout references. Preserve legacy definitions needed by existing workouts, routines, or custom selections. Where the old format cannot reliably distinguish a seed from a custom type, retain the definition. Avoid guessing identity from a display name during migration.
- During sync, send server IDs directly for new public selections and include the definitions needed to resolve local IDs. The [bulk import service](../../src/sync/service.py) already accepts numeric strings on exercises. Apply the same released-or-owned visibility check to legacy external IDs. Keep locally authored types private to the signing-in user under the existing candidate flow.
- An unresolved exercise must leave its workout recoverable. Today the server can skip an exercise and the [client](../../../pe-be-tracker-frontend/src/utils/syncGuestData.ts) can clear the guest store after a successful response. Make an incomplete workout import fail atomically and retain it locally for retry. A retry after a lost response must resolve to the original imported workout, including the server workout ID needed for its recap.
- The store can also contain routines, while the current bulk payload omits them. Clear only confirmed imports and retain any routine and its dependencies until it has been imported. Test both a routine-only device and one with workouts and routines. The catalog rollout can proceed without implementing routine import if those local records remain recoverable.

## Release and acceptance

Deploy the import changes first, then switch the picker to the shared catalog and stop generating exercise seeds.

- On a fresh device, find a released exercise absent from the old seed, log it alongside a custom exercise, reload, and finish as a guest. Sign in with Google and verify the recap belongs to that workout.
- On an existing device, verify that exercise names, units, sets, and routines survive hydration and a failed import. Retry after a lost response and verify the workout appears once.
- Exercise search, clear the query, and select a result. Change muscle filters while loading, paginate, and retry a failed request. After sign-out, verify that private results from the previous account disappear.

Evaluate the product change with completed first workouts per new visitor and the share of guests who receive a recap after choosing Google sign-in. Track catalog request failures and incomplete imports separately so a failed handoff is distinguishable from someone choosing to keep logging as a guest.
