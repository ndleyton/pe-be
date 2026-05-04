# RFC 0007: Routine Programs and Ordered Routine Collections

- Status: Proposed
- Date: 2026-05-03
- Owners: Backend / Frontend

## Summary

This RFC proposes adding a first-class `RoutineProgram` model for grouping multiple routines into an ordered training program.

The app currently treats each routine as a standalone template. That is fine for one-off workouts, but it is weak for multi-day programs such as:

- Push / Pull / Legs
- Upper / Lower
- Full Body rotations
- Arms + Delts specialization days
- multi-week or phased programs

The recommended shape is:

- keep `Routine` as the executable workout template
- add `RoutineProgram` as the user-facing collection
- add a join model that orders routines inside the program
- preserve existing `author` and `category` as routine metadata, not as the long-term grouping mechanism
- expose program read APIs that return a program card plus ordered routine days
- let users start workouts from the child routines exactly as they do today

This gives the product a clean way to show grouped routine packs without overloading `category` or forcing naming conventions into routine titles.

## Context

### What exists today

The backend already has a mature routine domain:

- routines live in [`backend/src/routines`](../../src/routines)
- the user-facing model is `Routine`, backed by the legacy `recipes` table in [`backend/src/routines/models.py`](../../src/routines/models.py)
- routines can be `private`, `public`, or `link_only`
- routines can already be filtered and summarized through `/api/v1/routines/summary`
- routines already have flat metadata fields: `author` and `category`
- users can start a workout from a routine through `/api/v1/routines/{routine_id}/start`

This is enough for standalone routines, but not enough to represent a complete program.

### What does not exist yet

The app does not currently have:

- a first-class "program" or "collection" entity
- a stable ordered relationship between routines
- program-level visibility
- program-level author/category/source metadata
- day labels like `Push A`, `Lower 2`, or `Weak Points And Arms`
- phase/week metadata for future expansion
- a route that returns one grouped program with ordered days

### Why `author` and `category` are not enough

Using `author` and `category` as a grouping convention is a reasonable short-term workaround, but it has problems:

- `category` becomes overloaded as both taxonomy and program identity
- ordering is implicit and fragile
- one routine cannot cleanly belong to multiple programs
- the frontend has to infer grouping from flat routine lists
- there is no place for program-level descriptions, schedule notes, source labels, or read-only flags
- future multi-week programs would require more conventions instead of a schema

This RFC keeps `author` and `category` useful for discovery, but moves program structure into its own model.

## Goals

- Let users browse routine groups as programs.
- Let a program show ordered routine days.
- Let each day point to an existing routine.
- Preserve current routine creation, routine sharing, and start-workout flows.
- Support public, private, and link-only program visibility.
- Support canonical/admin-created programs that are read-only.
- Avoid duplicating exercise templates in the program layer.
- Keep the v1 schema simple while leaving room for weeks and phases.

## Non-Goals

- Calendar scheduling
- Progression engines
- Automatic load calculation
- Program enrollment or adherence tracking
- Week-by-week periodization enforcement
- Replacing standalone routines
- Importing or reproducing proprietary paid program content

## Decision

Add a new routine program domain.

### Data Model Decision

Create two new tables:

```text
routine_programs
- id
- name
- description
- creator_id
- visibility
- author
- category
- source_label
- is_readonly
- times_used
- created_at
- updated_at
```

```text
routine_program_days
- id
- program_id
- routine_id
- day_label
- sort_order
- week_number nullable
- phase_label nullable
- notes nullable
- created_at
- updated_at
```

`RoutineProgram` is the grouped product surface. `Routine` remains the executable workout template.

### Resolved Product Decisions

- `RoutineProgram.visibility` supports `private`, `public`, and `link_only` in v1.
- Public programs may link only to public child routines in v1.
- Routine deletion is restricted when a routine is referenced by any program in v1.
- Admin-created read-only programs deep clone routines when a user saves or clones the program.
- `RoutineProgram.times_used` increments on clone/save in v1 and is used as a lightweight popularity sort signal.

In the deletion decision, a "day row" means the `routine_program_days` join-table record that places one routine at a labeled position inside a program. Automatically deleting that row when a routine is deleted would silently remove a day from every affected program. Restricting deletion gives the user and API a clearer failure mode for v1.

### API Decision

Expose programs through routine-adjacent routes:

- `GET /api/v1/routine-programs/summary`
- `GET /api/v1/routine-programs/`
- `GET /api/v1/routine-programs/{program_id}`
- `POST /api/v1/routine-programs/`
- `PUT /api/v1/routine-programs/{program_id}`
- `DELETE /api/v1/routine-programs/{program_id}`
- `POST /api/v1/routine-programs/{program_id}/clone`

Admin-only creation can either use the same route with superuser permissions or a mirrored admin route:

- `POST /api/v1/admin/routine-programs`

The route prefix should use `routine-programs`, not `programs`, to keep the domain explicit and avoid future ambiguity with coaching plans, nutrition plans, or app subscriptions.

### Frontend Decision

Show programs as grouped cards in the routine library.

A program card should display:

- program name
- author
- category
- number of days
- total exercise count
- first few day labels
- visibility badge where relevant
- save count or popularity indicator where relevant

Opening a program shows an ordered day list. Each day row links to the underlying routine detail and can use the existing "start routine" flow.

## Why This Is The Best Fit

### 1. It preserves the routine primitive

Routines are already the unit that can be started as workouts. Programs should organize routines, not replace them.

### 2. It avoids metadata overload

`author` and `category` are useful for filtering, but they are not relational structure. A dedicated join table makes ordering and grouping explicit.

### 3. It supports reuse

The same `Push A` routine can appear in:

- a 6-day PPL program
- a 5-day hybrid program
- a user's custom rotation

That is difficult if program identity is encoded in the routine name or category.

### 4. It leaves room for weeks and phases

The nullable `week_number` and `phase_label` fields are enough for later multi-week display without requiring a full scheduling engine in v1.

### 5. It creates a better product surface

Users should see "Pure Bodybuilding Inspired PPL" as one object, not eight separate unrelated routines in a flat list.

## Proposed Design

### Backend Domain Shape

Add a new feature slice:

- [`backend/src/routine_programs/models.py`](../../src/routine_programs/models.py)
- [`backend/src/routine_programs/schemas.py`](../../src/routine_programs/schemas.py)
- [`backend/src/routine_programs/crud.py`](../../src/routine_programs/crud.py)
- [`backend/src/routine_programs/service.py`](../../src/routine_programs/service.py)
- [`backend/src/routine_programs/router.py`](../../src/routine_programs/router.py)

This avoids growing the existing routines slice too much while keeping the domain boundary clear.

The existing [`backend/src/routines`](../../src/routines) slice should continue to own:

- routine CRUD
- exercise templates
- set templates
- start-workout-from-routine

The new slice should own:

- program CRUD
- ordered program day management
- program visibility checks
- program summary reads
- program cloning
- program popularity counters for clone/save events

### Model Details

#### `RoutineProgram`

Fields:

- `id`: primary key
- `name`: required string
- `description`: nullable text
- `creator_id`: required FK to `users.id`, cascade delete
- `visibility`: enum with `private`, `public`, `link_only`
- `author`: nullable string
- `category`: nullable string
- `source_label`: nullable string, for labels such as `Jeff Nippard inspired`
- `is_readonly`: boolean, default `false`
- `times_used`: integer, default `0`
- timestamps from the shared base model

Indexes:

- `(creator_id, visibility)`
- `(creator_id, created_at desc)`
- `(visibility, created_at desc)`
- `(category, visibility)`
- `(author, visibility)`
- `(times_used desc)`

#### `RoutineProgramDay`

Fields:

- `id`: primary key
- `program_id`: required FK to `routine_programs.id`, cascade delete
- `routine_id`: required FK to `recipes.id`, restrict delete in v1
- `day_label`: required string
- `sort_order`: required integer
- `week_number`: nullable integer
- `phase_label`: nullable string
- `notes`: nullable text
- timestamps from the shared base model

Constraints:

- unique `(program_id, sort_order)`
- unique `(program_id, day_label)` can be considered, but should not be required because a program may intentionally repeat labels like `Push`

Indexes:

- `(program_id, sort_order)`
- `(routine_id)`

### Visibility Semantics

Program visibility should mirror routine visibility:

- `private`: visible only to owner
- `public`: visible to everyone and included in public browse lists
- `link_only`: visible by direct ID/link, but not included in public browse lists

For v1, a visible program should only expose days whose child routines are also visible to the viewer.

Recommended validation:

- A public program may contain only public child routines.
- Publishing a program should fail if any child routine is not public.
- Private programs may contain routines owned by the creator, plus routines the creator is otherwise allowed to view.
- Link-only programs are readable by direct ID/link, but are excluded from public browse and summary surfaces unless the viewer owns them.
- Link-only programs should still avoid a confusing partial-render state; if they are intended to be shared with anonymous viewers, their child routines should be public.

This avoids a confusing state where a public program renders with missing days.

### Read Models

#### `RoutineProgramSummary`

Use this for list pages:

- `id`
- `name`
- `description`
- `creator_id`
- `visibility`
- `author`
- `category`
- `source_label`
- `is_readonly`
- `times_used`
- `day_count`
- `routine_count`
- `exercise_count`
- `set_count`
- `day_labels_preview`
- `created_at`
- `updated_at`

#### `RoutineProgramRead`

Use this for detail pages:

- all base program fields
- ordered `days`

Each day should include:

- `id`
- `day_label`
- `sort_order`
- `week_number`
- `phase_label`
- `notes`
- routine summary or full routine read

For v1, embedding a routine summary is probably enough. The day can link to `/routines/{routine_id}` for full exercise detail.

### Write Schemas

`RoutineProgramCreate`:

- program fields
- `days: list[RoutineProgramDayCreate]`

`RoutineProgramDayCreate`:

- `routine_id`
- `day_label`
- `sort_order`
- `week_number`
- `phase_label`
- `notes`

`RoutineProgramUpdate`:

- partial program fields
- optional full replacement `days`

Use full replacement for the day list in v1. It matches the existing routine update pattern where nested exercise templates are replaced as a unit.

### Cloning

`POST /api/v1/routine-programs/{program_id}/clone` should:

1. verify the source program is visible to the viewer
2. clone child routines into new private routines owned by the viewer
3. create a new private program owned by the viewer
4. preserve day ordering and labels
5. set `author` and `source_label` based on source metadata
6. increment the source program's `times_used`
7. return the new program detail

Deep cloning child routines gives the user a true editable copy and avoids later surprises if the source program changes. This applies to public user-created programs and admin-created read-only programs.

### Starting A Program Day

Do not add "start program" behavior in v1.

Users should start a specific day:

- program detail page
- click `Start` on `Push A`
- frontend calls existing `/api/v1/routines/{routine_id}/start`

This keeps the workout creation path unchanged.

### Times Used

In v1, increment `Routine.times_used` when a day routine is started as usual.

Increment `RoutineProgram.times_used` when a user saves or clones a program. This is the easiest useful popularity signal because the clone endpoint already has program context, while the existing routine start endpoint does not. In the UI, this should be labeled as saves or popularity rather than completed program usage.

## Migration Plan

Create a defensive Alembic migration:

1. create enum `routine_program_visibility` if it does not exist
2. create `routine_programs` if it does not exist
3. create `routine_program_days` if it does not exist
4. create indexes with `IF NOT EXISTS`
5. create unique constraint/index for `(program_id, sort_order)` defensively

Downgrade should:

1. drop `routine_program_days` if it exists
2. drop `routine_programs` if it exists
3. drop enum only if no longer used

Follow the repository's migration guidance: inspect existing tables/columns before destructive operations.

## API Sketch

### Create Program

```json
{
  "name": "Pure Bodybuilding Inspired PPL",
  "description": "A hypertrophy-focused push, pull, legs rotation.",
  "visibility": "public",
  "author": "Jeff Nippard inspired",
  "category": "Hypertrophy",
  "source_label": "Public split structure inspired by Jeff Nippard programs",
  "days": [
    {
      "routine_id": 101,
      "day_label": "Pull A",
      "sort_order": 1
    },
    {
      "routine_id": 102,
      "day_label": "Push A",
      "sort_order": 2
    }
  ]
}
```

Do not store `workout_type_id` on the program unless a later product decision needs it. The child routines already have workout type.

### Program Summary Response

```json
{
  "id": 1,
  "name": "Pure Bodybuilding Inspired PPL",
  "description": "A hypertrophy-focused push, pull, legs rotation.",
  "creator_id": 4,
  "visibility": "public",
  "author": "Jeff Nippard inspired",
  "category": "Hypertrophy",
  "source_label": "Public split structure inspired by Jeff Nippard programs",
  "is_readonly": true,
  "times_used": 18,
  "day_count": 8,
  "routine_count": 7,
  "exercise_count": 43,
  "set_count": 129,
  "day_labels_preview": ["Pull A", "Push A", "Legs A", "Weak Points And Arms"],
  "created_at": "2026-05-03T00:00:00Z",
  "updated_at": "2026-05-03T00:00:00Z"
}
```

### Program Detail Response

```json
{
  "id": 1,
  "name": "Pure Bodybuilding Inspired PPL",
  "days": [
    {
      "id": 1,
      "day_label": "Pull A",
      "sort_order": 1,
      "week_number": null,
      "phase_label": null,
      "notes": null,
      "routine": {
        "id": 101,
        "name": "Pull A",
        "exercise_count": 6,
        "set_count": 18,
        "exercise_names_preview": ["Pullups", "Barbell Row", "Lat Pulldowns"]
      }
    }
  ]
}
```

## Frontend UX

### Routine Library

Add tabs or sections:

- `Programs`
- `Routines`

The `Programs` tab shows grouped cards. The `Routines` tab preserves the current standalone routine list.

### Program Detail

Program detail should show:

- title, author, category, description
- ordered day list
- each day row with routine preview names
- `Start` action per day
- `Save Program` / `Clone` action for public or link-only programs not owned by the viewer

### Existing Routine Pages

Standalone routine detail pages should remain unchanged.

If a routine belongs to programs, a small "Used in" section can be added later. That is not required for v1.

## Rollout Plan

1. Backend schema and models
2. Backend CRUD/service/router
3. Admin creation support
4. Summary/detail API tests
5. Frontend API client and types
6. Program list UI
7. Program detail UI
8. Optional admin seed for initial routine programs

## Testing Plan

Backend:

- create private program with owned routines
- create link-only program and verify it is directly readable but excluded from public browse
- create public program with public child routines
- reject public program with private child routines
- reject public program with link-only child routines in v1
- signed-out users see public programs in summary
- signed-out users do not see private or link-only programs in summary
- direct read permits link-only programs
- clone public program creates private editable program and private child routines
- clone admin-created read-only program creates private editable program and private child routines
- cloning increments source program `times_used`
- deleting a program does not delete child routines
- deleting a child routine referenced by a program is restricted in v1
- summary counts and previews are stable and ordered

Frontend:

- program list renders grouped cards
- program detail renders ordered days
- start day uses existing routine start flow
- clone/save program appears only for public or link-only programs not owned by viewer
- popularity or save count displays from `times_used` where included
- empty/loading/error states preserve progressive rendering

## Resolved Questions

### Should `RoutineProgram.visibility` allow `link_only`, or should v1 only support `private` and `public`?

Decision:

- allow `link_only` in v1

### Should public programs be allowed to link to `link_only` child routines, or only `public` child routines?

Decision:

- public programs may link only to public child routines in v1

### Should routine deletion be restricted when referenced by any program, or should deletion remove the day row?

Decision:

- restrict routine deletion when referenced by any program in v1

Clarification:

- the day row is the `RoutineProgramDay` join-table record
- automatic removal is deferred because it could silently damage published programs

### Should admin-created read-only programs deep clone routines on user save, or link to canonical routines until the user edits?

Decision:

- deep clone routines on save/clone

### Should `times_used` mean clones/saves, starts, or completed program cycles?

Decision:

- use clones/saves in v1
- use it as a lightweight popularity sort signal
- do not label it as completed usage

## Alternatives Considered

### Use `author` and `category`

This is the fastest option and is acceptable for a short-term prototype.

It fails once the product needs ordering, phases, repeat days, link-only sharing, cloning, or a real program detail page.

### Use naming conventions only

Names like `Pure Bodybuilding PPL - Pull A` require no schema work.

This is brittle, clutters the routine list, and makes the UI parse structure out of display strings.

### Add JSON metadata to routines

A `metadata` JSON column could store `program`, `split`, and `dayOrder`.

This is flexible but weakly validated, harder to query, and likely to become inconsistent as soon as users edit or duplicate routines.

### Add schedule/enrollment tables now

A full program engine could model weeks, enrollments, completed days, and progression.

That is more than the current need. The app first needs grouped display and ordered routine collections.

## Recommendation

Implement `RoutineProgram` and `RoutineProgramDay` as a dedicated v1 grouping layer.

Use `author` and `category` as display/filter metadata on both routines and programs, but do not rely on them as the grouping source of truth.

Keep routine execution unchanged: a user starts a specific routine day using the existing `/api/v1/routines/{routine_id}/start` endpoint.
