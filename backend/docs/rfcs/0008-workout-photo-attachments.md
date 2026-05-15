# RFC 0008: Workout Photo Attachments

- Status: Proposed
- Date: 2026-05-15
- Owners: Backend / Frontend

## Summary

Allow an authenticated user to attach a photo to a workout so the workout log can capture visual progress in addition to structured training data, notes, and the AI recap.

The first version should support one primary photo per workout. The upload entry point in the product is a camera icon in [`FinishWorkoutModal.tsx`](../../../pe-be-tracker-frontend/src/features/workouts/components/FinishWorkoutModal/FinishWorkoutModal.tsx). When a photo exists, the finish modal should display that photo in the summary image area instead of [`AnatomicalImage.tsx`](../../../pe-be-tracker-frontend/src/features/workouts/components/FinishWorkoutModal/AnatomicalImage/AnatomicalImage.tsx). When no photo exists, the modal keeps the current anatomical muscle diagram fallback.

The recommended shape is:

1. Add a first-class `WorkoutPhoto` model owned by a workout.
2. Store uploaded image bytes in app-owned file storage, not PostgreSQL.
3. Add a dedicated owner-scoped upload endpoint under the workouts API.
4. Return photo metadata on workout detail reads so the frontend can render the current primary photo.
5. Keep v1 to one primary image per workout, but model the table so a future gallery can be added without a destructive rewrite.

## Context

### Product context

The finish-workout flow already produces a shareable visual summary:

- the modal calculates worked muscle groups from the completed exercises
- it renders a branded summary card
- it currently uses an anatomical SVG visualization as the main image
- it can share or download the generated image

That is useful for summarizing training stimulus, but it does not let a user document visual progress, form snapshots, pump photos, physique changes, or other personal training moments.

The camera icon should be a direct action in the finish modal:

- user taps the camera icon
- frontend opens camera/gallery capture via a file input
- frontend uploads the selected image to the workout
- the modal preview replaces the anatomical diagram with the uploaded photo
- sharing the summary captures the uploaded photo in the exported image

### Current backend shape

Workouts are owner-scoped in [`backend/src/workouts`](../../src/workouts):

- `Workout` stores core training metadata, notes, recap, and visibility
- `GET /api/v1/workouts/{workout_id}` requires the current authenticated owner
- `PATCH /api/v1/workouts/{workout_id}` updates owner-owned workout fields
- public workout reads from RFC 0006 should remain separate from the private owner API

There is no current workout media model.

### Existing image-upload patterns to reuse

The app already has uploaded-image patterns that should inform this design:

- chat attachments validate uploaded images, store bytes under `CHAT_ATTACHMENT_STORAGE_DIR`, persist metadata, serve owner-authorized files, and run cleanup for orphaned rows
- exercise image candidate uploads use generated storage keys, decoded-image validation, database metadata, owner/admin authorization, and file rollback if database persistence fails
- generated exercise images and chat attachments are stored in mounted runtime volumes rather than in the repository or PostgreSQL

Workout photos should reuse those principles instead of introducing a third ad hoc media system.

## Goals

- Let authenticated users attach one primary photo to a workout.
- Let the finish-workout modal upload the photo from a camera icon.
- Render the workout photo in the finish summary where the anatomical image currently appears.
- Keep the anatomical image as the fallback when no workout photo exists.
- Avoid storing image bytes in PostgreSQL.
- Authorize photo upload, read, replacement, and deletion by workout owner.
- Preserve the public browser-facing API contract under `/api/...`.
- Keep v1 simple enough to ship before expanding into galleries or social features.

## Non-Goals

- Anonymous workout photo uploads
- Multiple workout photos or gallery management in v1
- AI analysis of progress photos
- Photo editing, filters, cropping, stickers, or annotations
- Making private workout photos public by default
- Replacing the existing anatomy visualization globally
- Moving all existing image storage to object storage

## Decision

### 1. Add workout photos as a dedicated domain model

Add a new table rather than placing image metadata directly on `workouts`.

Recommended table:

```text
workout_photos
  id
  workout_id
  user_id
  storage_key
  mime_type
  size_bytes
  width
  height
  sha256
  original_filename
  is_primary
  created_at
  updated_at
  deleted_at
```

Recommended constraints and indexes:

- foreign key `workout_id -> workouts.id` with `ON DELETE CASCADE`
- foreign key `user_id -> users.id` with `ON DELETE CASCADE`
- unique `storage_key`
- index on `(workout_id, is_primary)`
- partial unique index allowing only one active primary photo per workout:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_photos_one_active_primary
ON workout_photos (workout_id)
WHERE is_primary = true AND deleted_at IS NULL;
```

Why this shape:

- v1 can enforce one active primary photo
- future gallery support can add non-primary rows without a new table
- the row can store dimensions and hash for frontend display, validation, and integrity checks
- soft deletion lets the app avoid dangling references while still giving cleanup jobs a clear target
- `user_id` makes owner queries and cleanup easier without repeatedly joining through `workouts`

### 2. Store bytes in app-owned media storage

Add a dedicated storage directory, for example:

```text
/app/.workout_photos/
  user-{user_id}/
    workout-{workout_id}/
      {photo_id-or-random-key}.{ext}
```

Recommended setting names:

- `WORKOUT_PHOTO_STORAGE_DIR`
- `WORKOUT_PHOTO_MAX_BYTES`
- `WORKOUT_PHOTO_ALLOWED_MIME_TYPES`
- `WORKOUT_PHOTO_RATE_LIMIT_WINDOW_SECONDS`
- `WORKOUT_PHOTO_RATE_LIMIT_MAX_REQUESTS`

Use the same allowed MIME family as other image uploads unless there is a product reason to narrow it:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/heic`
- `image/heif`

Do not store image bytes in PostgreSQL. Store only metadata and a generated `storage_key`.

### 3. Add owner-scoped workout photo endpoints

Recommended API:

```text
POST /api/v1/workouts/{workout_id}/photo
GET /api/v1/workouts/{workout_id}/photo/file
```

`POST /api/v1/workouts/{workout_id}/photo`

- requires authenticated user
- requires the workout to belong to the current user
- accepts multipart `file`
- validates size, decoded MIME type, dimensions, and allowed type
- writes bytes to `WORKOUT_PHOTO_STORAGE_DIR`
- creates or replaces the active primary photo
- returns photo metadata and a render URL

Recommended response:

```json
{
  "id": 123,
  "workout_id": 456,
  "mime_type": "image/jpeg",
  "size_bytes": 842311,
  "width": 1440,
  "height": 1920,
  "url": "/api/v1/workouts/456/photo/file",
  "created_at": "2026-05-15T12:34:56Z",
  "updated_at": "2026-05-15T12:34:56Z"
}
```

Replacement behavior:

- v1 should treat the upload as "replace the primary photo"
- write the new image file to a temp or pending location first
- start a database transaction before changing `workout_photos`
- soft-delete the current active primary row first so the partial unique index does not conflict:
  ```sql
  UPDATE workout_photos
  SET deleted_at = NOW()
  WHERE workout_id = :workout_id
    AND is_primary = true
    AND deleted_at IS NULL;
  ```
- insert the new `workout_photos` row with `is_primary=true` in the same transaction
- commit the transaction, then move or mark the temp file as final
- do not block the upload response on deleting replaced files
- clean soft-deleted files with a scheduled cleanup job as a follow-up
- if the transaction fails, delete the newly written temp file before returning

This ordering is required by `uq_workout_photos_one_active_primary`, the partial unique index on `workout_photos (workout_id) WHERE is_primary = true AND deleted_at IS NULL`. Inserting the replacement row before soft-deleting the existing primary row can violate that constraint.

`GET /api/v1/workouts/{workout_id}/photo/file`

- requires authenticated owner in v1
- streams the image with a safe `Content-Type`
- sets conservative private cache headers
- returns `404` if the row or file is missing

Public serving can be added later if public workout activity needs photos. It should not be enabled implicitly by the upload endpoint.

Deferred API:

- `GET /api/v1/workouts/{workout_id}/photo` is not necessary if detail reads include photo metadata.
- `DELETE /api/v1/workouts/{workout_id}/photo` can be added when the product supports removing a selected photo. The finish modal only needs replacement in v1.

### 4. Include photo metadata in workout detail reads

Extend owner-facing workout detail responses with optional photo metadata:

```json
{
  "id": 456,
  "name": "Push Day",
  "photo": {
    "id": 123,
    "url": "/api/v1/workouts/456/photo/file",
    "width": 1440,
    "height": 1920,
    "mime_type": "image/jpeg"
  }
}
```

This keeps the finish modal and workout-detail views from making an extra metadata request. The image bytes still load through the file endpoint.

Implementation detail:

- use `joinedload` for the single primary-photo relationship on detail reads
- do not add thumbnails or photo metadata to workout list/history pages in v1
- use `selectinload` or a targeted subquery for collection reads only if a later list UI needs thumbnails

### 5. Frontend flow in the finish modal

Update [`FinishWorkoutModal.tsx`](../../../pe-be-tracker-frontend/src/features/workouts/components/FinishWorkoutModal/FinishWorkoutModal.tsx) to support a camera upload action.

Recommended component contract additions:

- `workoutId`
- `workoutPhoto`
- `onUploadWorkoutPhoto(file: File)`
- `isUploadingWorkoutPhoto`

Recommended UI behavior:

- show a camera icon button near the share button or image area
- use a visually hidden file input with `accept="image/*"` and `capture="environment"` where appropriate
- upload immediately after a file is selected
- show upload progress or a compact loading state in the image area
- show the uploaded photo preview when upload succeeds
- replace the current photo when the user uploads another image
- do not support deleting the selected photo from the finish modal in v1
- keep `AnatomicalImage` as the fallback when no photo exists
- preserve the current share/export behavior by rendering the selected photo inside `downloadAreaRef`

The image selection component should not own workout-fetching state. Keep transport and mutation logic in a feature hook under `src/features/workouts/hooks` or the parent workflow hook, then pass modal props into the presentational component.

### 6. Add a small display component instead of overloading AnatomicalImage

Do not change `AnatomicalImage` into a generic media renderer. It has one job: render the anatomy SVG with muscle highlighting.

Add a small wrapper component, for example:

```text
FinishWorkoutVisual
  if workoutPhoto exists:
    render WorkoutPhotoImage
  else:
    render AnatomicalImage
```

This keeps the visual choice explicit and makes the fallback behavior easy to test.

Recommended display behavior:

- use `object-fit: cover`
- preserve a stable aspect ratio so the share card does not jump during upload
- include alt text such as `Workout photo for {workoutName}`
- set `crossOrigin` only if the backend and html2canvas requirements need it
- verify that html2canvas can capture the authenticated image endpoint; if browser credentials are not included reliably, convert the uploaded image preview to a local object URL or data URL for the share card render path

### 7. Keep private photos private by default

Workout photos are personal user media. In v1:

- only the workout owner can upload, read, or replace the photo
- a public workout does not make its photo public
- any future public-photo behavior must be explicit in the public profile/activity RFC path
- public responses must use a public-safe schema and authorization rule, not the owner-only `/workouts/{id}/photo/file` endpoint

This avoids accidentally exposing private progress images when workout visibility changes.

## Detailed Design

### Backend modules

Recommended files:

- `backend/src/workouts/photo_models.py` or add `WorkoutPhoto` to `backend/src/workouts/models.py`
- `backend/src/workouts/photo_schemas.py` or add photo schemas to `backend/src/workouts/schemas.py`
- `backend/src/workouts/photo_service.py`
- `backend/src/workouts/photo_crud.py`
- `backend/src/workouts/photo_assets.py`
- `backend/src/workouts/router.py` for thin route wiring

If the implementation introduces a shared image helper for validation and hashing, prefer a backend-neutral module such as:

- `backend/src/shared/image_uploads.py`

That helper can be reused by chat attachments, exercise candidate uploads, and workout photos over time.

### Validation rules

Server-side validation should include:

- authenticated owner check before reading or writing files
- max byte size
- decoded image verification
- detected MIME type matches allowed types
- declared MIME type cannot override detected type
- max pixel count or max width/height if needed for memory safety
- generated storage paths only; never trust the original filename for storage
- path traversal protection when resolving `storage_key`

Recommended first limits:

- max size: 10 MB
- max dimensions: 6000 px on the longest side, or equivalent pixel-count limit
- no metadata requirement in v1

Do not strip EXIF metadata in v1. Private owner-only storage is enough for the first release. Document that uploaded files may retain camera metadata and revisit metadata stripping before any public photo sharing work.

### Schema relationships

Recommended ORM relationship:

```python
class Workout(Base):
    primary_photo: Mapped["WorkoutPhoto | None"] = relationship(
        "WorkoutPhoto",
        primaryjoin=(
            "and_(Workout.id == WorkoutPhoto.workout_id, "
            "WorkoutPhoto.is_primary.is_(True), "
            "WorkoutPhoto.deleted_at.is_(None))"
        ),
        viewonly=True,
        uselist=False,
    )
```

The exact SQLAlchemy expression can be adjusted to the repo's style. The key requirement is that workout detail reads expose at most one active photo.

### API constants

Add frontend endpoint constants in [`endpoints.ts`](../../../pe-be-tracker-frontend/src/shared/api/endpoints.ts) instead of hardcoding paths:

```ts
workoutPhoto: (workoutId: number) => `/workouts/${workoutId}/photo`,
workoutPhotoFile: (workoutId: number) => `/workouts/${workoutId}/photo/file`,
```

Preserve trailing slashes only where existing collection endpoints require them. These item endpoints should not need trailing slashes.

### Frontend API client

Add a focused API helper:

```ts
uploadWorkoutPhoto(workoutId: number, file: File): Promise<WorkoutPhoto>
```

Rules:

- use `FormData`
- do not manually set the multipart `Content-Type`
- surface validation errors through the existing toast/error pattern
- invalidate the relevant workout query after upload
- update modal-local preview immediately when the upload response returns

### Guest behavior

Guest/local-first workout state is currently persisted through the guest store. Workout photo uploads should be authenticated-only in v1 because persistent binary media introduces storage, sync, and cleanup complexity.

Recommended guest UX:

- hide or disable the camera upload action for guests
- optionally show a sign-in prompt if the user taps it
- keep the anatomical image fallback for guest summaries

Do not store guest photos in IndexedDB in v1.

### Recap interaction

The post-workout AI recap remains text/metrics grounded in v1. The uploaded workout photo should not be sent to Gemini automatically.

Reasons:

- progress photos can be sensitive
- image-based coaching requires separate consent and safety copy
- the existing recap service is grounded in deterministic workout metrics and notes
- adding image analysis would change token cost, latency, and privacy expectations

Future image-aware recap can be proposed separately.

### Public workout interaction

RFC 0006 has landed public profile/activity reads. Workout photos should not automatically appear there.

If public workout photos are later desired, add explicit controls such as:

- `workout_photos.visibility`: `private` | `public`
- public-safe file endpoint with signed or public URLs
- separate public schemas that never leak private media accidentally

Until then, public workout activity should omit `photo`, even for public workouts.

## Migration Plan

1. Add `workout_photos` table with defensive Alembic guards.
2. Add settings for storage directory, size limit, allowed MIME types, and rate limits.
3. Add storage directory to production Docker volume mounts and deployment backup expectations.
4. Add backend service, CRUD, upload endpoint, and file-serving endpoint.
5. Add tests for upload, replacement, authorization, invalid MIME, oversize files, and missing files.
6. Extend workout detail reads with optional photo metadata where needed.
7. Add frontend endpoint constants and an upload API helper.
8. Add a workout-photo upload hook.
9. Add camera button and photo fallback rendering in the finish modal.
10. Verify share/download image capture with uploaded photos on desktop and mobile viewport sizes.

## Testing Plan

### Backend

Focused tests:

- owner can upload a valid photo
- non-owner cannot upload to another user's workout
- non-owner cannot read another user's photo file
- invalid MIME type is rejected
- oversized image is rejected
- duplicate replacement leaves only one active primary photo
- deleting a workout cascades photo rows
- upload rolls back the file if database persistence fails

Commands:

```bash
cd backend && uv run pytest --no-cov tests/workouts/test_workout_photos.py
cd backend && uv run ruff check .
cd backend && uv run pytest
```

### Frontend

Focused tests:

- camera button is visible for authenticated users
- camera action is hidden or disabled for guests
- successful upload renders the workout photo instead of `AnatomicalImage`
- no photo renders the anatomy fallback
- upload failure shows an error and keeps the fallback/previous photo
- share/export area includes the selected photo

Commands:

```bash
cd pe-be-tracker-frontend && pnpm run lint
cd pe-be-tracker-frontend && pnpm run typecheck
cd pe-be-tracker-frontend && pnpm test
```

Manual checks:

- mobile browser file picker opens camera/gallery as expected
- finish modal layout does not jump during upload
- uploaded photo is captured in shared/downloaded summary image
- authenticated image endpoint loads after refresh
- replaced photos no longer render

## Operational Notes

Production currently runs backend and PostgreSQL on a VPS. Workout photo storage must be treated as persistent runtime data, like chat attachments and exercise images.

Implementation should update:

- Docker Compose volume mounts
- deployment backup documentation if backups should include workout photos
- storage metrics or logs for upload volume and rejected files

Do not assume a manual `git pull` plus `docker compose up` will install any future cleanup timer. If a systemd timer is added, update the host unit files, run `systemctl daemon-reload`, and verify the timer on the host.

## Follow-Ups

### Scheduled cleanup for replaced files

Add a scheduled cleanup job for soft-deleted workout photo files after the v1 upload path lands.

Recommended behavior:

- find `workout_photos` rows with `deleted_at IS NOT NULL`
- remove the corresponding file from `WORKOUT_PHOTO_STORAGE_DIR`
- hard-delete the row only after file removal succeeds, or keep the row with a `file_deleted_at` field if audit history is useful
- batch deletions to avoid long-running jobs
- install the job through the same host `systemd` timer pattern used by other backend jobs

### Public workout photo visibility

Public workout photo visibility should be a separate explicit product decision. RFC 0006 public profile/activity support exists, but workout photos remain owner-only in this RFC.

Future public-photo work should decide:

- whether photos can be public independently from workout visibility
- whether existing uploaded photos default to private forever
- whether EXIF stripping or transcoding is required before publication
- what public file-serving strategy is used
- how public schemas avoid leaking private media

### Photo removal UI

The finish modal only supports replacing a selected photo in v1. A delete/remove action can be added later if users need to return a workout summary to the anatomy fallback.

### Workout list thumbnails

Workout list and history pages should not show thumbnails in v1. If thumbnails are added later, revisit list query loading, thumbnail sizing, and cache behavior deliberately instead of adding full photo metadata to every list response.

## Alternatives Considered

### Add `photo_url` directly to `workouts`

Rejected for v1.

This is simple, but it pushes media lifecycle into the main workout row and makes future gallery support harder. It also loses useful metadata such as dimensions, hash, size, and deletion state.

### Reuse `chat_attachments`

Rejected.

Chat attachments are conversation/message assets and may carry Gemini provider references. Workout photos are workout-owned user media with different retention, display, replacement, and future public-sharing rules.

### Store photos only in the frontend

Rejected.

The photo must survive refresh, appear on workout detail/history surfaces later, and participate in server-side authorization. Browser-only storage would also fail authenticated sync and backup expectations.

### Allow multiple photos immediately

Deferred.

A gallery is a reasonable future feature, but it adds ordering, deletion, thumbnail, layout, and quota UX. One primary photo solves the finish-modal use case cleanly while leaving room in the schema for more photos later.

### Upload during workout creation

Rejected for this use case.

The requested entry point is the finish-workout modal. Uploading after or near completion matches the moment users will document the session and avoids coupling photo capture to workout start.

## Resolved Decisions

- EXIF metadata stripping is not required in v1 because workout photos are owner-only.
- Replaced photo files should be cleaned by a scheduled job as a follow-up, not synchronously in the upload request.
- The finish modal supports uploading and replacing photos only; it does not support deleting a selected photo in v1.
- Photo rendering stays limited to workout detail and finish-summary surfaces in v1.
- Public profile/activity support has landed, but workout photos remain visible only to the owner for now.
