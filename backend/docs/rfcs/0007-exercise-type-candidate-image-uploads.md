# RFC 0007: Exercise Type Candidate Image Uploads

- Status: Proposed
- Date: 2026-04-27
- Owners: Backend / Frontend / Platform

## Summary

Allow users to attach images when creating or submitting exercise type candidates, while keeping production storage safe for the current single Hetzner CPX11-style VPS deployment.

The recommendation is:

1. Accept candidate images through a dedicated authenticated upload endpoint.
2. Store uploaded bytes as app-owned files under the existing exercise-image storage volume, not in PostgreSQL.
3. Reuse the same storage principles already used by chat attachments and generated exercise images: generated storage keys, decoded-image validation, database metadata, owner/admin authorization, and systemd cleanup.
4. Persist candidate-image metadata in a first-class exercise-domain table and reference those assets from candidate `exercise_types.reference_images_url`.
5. On admin release, promote approved images into the existing published exercise-image path used by released exercise types.
6. Put quota, cleanup, backup, and observability controls in place before exposing uploads broadly.
7. Treat S3-compatible object storage as an optional delivery and backend-offload layer, not as a required storage-capacity fix for the initial rollout.

This fits the current deployment, where generated exercise images are stored on the VPS in the Docker volume mounted at `/app/.exercise_images` and served by the backend through `/api/v1/exercises/assets/...`.

## Context

### Current production shape

The current deploy path in [`.github/workflows/deploy-vps.yml`](../../../.github/workflows/deploy-vps.yml):

- writes `backend/.env.production` during the GitHub Actions deployment
- syncs the repository to the VPS with `rsync --delete`
- excludes `data/`, `logs/`, `backups/`, and other runtime directories from sync
- runs `docker compose -f docker-compose.prod.yml build`
- starts `db`, runs migrations, and recreates `backend` and `caddy`
- installs host `systemd` timers for recurring backend jobs

The production Compose stack in [`docker-compose.prod.yml`](../../../docker-compose.prod.yml) mounts:

- `exercise_images_data:/app/.exercise_images`
- `chat_attachments_data:/app/.chat_attachments`
- `postgres_data:/var/lib/postgresql/data`

So repository deploys do not erase generated exercise images, but those images still live on the same small VPS as Docker, PostgreSQL, Caddy, logs, and backups.

### Current Exercise Image Behavior

The app already has an exercise-image pipeline:

- `ExerciseType.images_url` holds the active image set as JSON text.
- `ExerciseType.reference_images_url` preserves source/reference image paths.
- `ExerciseImageCandidate` tracks generated image candidates and their storage paths.
- [`backend/src/exercises/image_assets.py`](../../src/exercises/image_assets.py) resolves relative paths into URLs and filesystem paths.
- [`backend/src/admin/exercise_image_service.py`](../../src/admin/exercise_image_service.py) writes generated candidates under `generated/...` and promotes selected images into `published/...`.
- [`backend/src/exercises/router.py`](../../src/exercises/router.py) serves exercise-image assets through the API.

Today, candidate exercise-type creation does not accept uploaded images. User-created exercise types start as `candidate`, can be moved to `in_review`, and can later be released by an admin.

### Existing upload behavior to reuse

Chat image attachments already provide the upload baseline:

- `ChatAttachment` stores owner, generated `storage_key`, MIME type, size, hash, dimensions, and provider references.
- `POST /api/v1/chat/attachments` accepts multipart uploads.
- `ChatService.save_uploaded_attachment(...)` validates size, detects the real image MIME type, checks declared vs detected MIME type, writes bytes to `CHAT_ATTACHMENT_STORAGE_DIR`, and rolls back the file if database persistence fails.
- `GET /api/v1/chat/attachments/{attachment_id}` authorizes by owner and serves the file.
- `ChatService.cleanup_orphaned_attachments(...)` removes stale unattached files and rows.
- `deploy-vps.yml` installs the chat cleanup job as a host `systemd` timer.

Exercise type candidate images should reuse that pattern. The RFC does not propose a different storage mechanism; it proposes a different domain table and lifecycle because candidate images are reviewed, may seed generated exercise image options, and may be promoted into the public `published/...` exercise image set.

## Goals

- Let authenticated users attach useful reference images to exercise type candidates.
- Give admins enough image context to review, regenerate, publish, or reject candidate images.
- Avoid storing image bytes in PostgreSQL.
- Keep the public product language as "exercise types" and "routines", not legacy "recipes".
- Preserve the public API contract under `app.example.com/api/...`.
- Keep disk growth bounded on the CPX11.
- Preserve a path to object storage if image delivery, async loading, or backend bandwidth pressure justify it later.

## Non-Goals

- Building a public anonymous image upload surface
- Replacing the existing generated image candidate pipeline
- Moving existing generated images to object storage in the first implementation
- CDN design for large-scale media delivery
- General user media support outside exercise type candidate images
- Creating an async worker fleet or queue service on day one

## Decision

Introduce uploaded candidate images as a new asset type in the existing exercise-image domain.

### Storage layout

Use the existing `EXERCISE_IMAGE_STORAGE_DIR` volume, but partition uploaded images from generated and published assets:

```text
/app/.exercise_images/
  uploads/
    exercise-type-candidates/
      user-{user_id}/
        exercise-type-{exercise_type_id}/
          {asset_id}.{ext}
  generated/
    exercise-type-{exercise_type_id}/...
  published/
    exercise-type-{exercise_type_id}/...
```

Rules:

- uploaded files are private to the owner and admins while the exercise type is `candidate` or `in_review`
- uploaded files are stored per candidate exercise type in phase 1; the upload store is not content-addressed
- if two users upload the same 5 MB reference image, the backend stores two physical files under different candidate-owned paths
- generated candidates remain private unless explicitly published
- published images remain readable through the existing public exercise-image path
- paths stored in the database are always relative to `EXERCISE_IMAGE_STORAGE_DIR`

### Data model

Preferred implementation: reuse and broaden the existing `exercise_image_candidates` table instead of adding a separate upload table.

Rationale:

- this app already treats `ExerciseImageCandidate` as the admin-review inventory for exercise type images
- generated image options, uploaded references, and eventually published selections all belong to the same review surface
- one table makes cleanup, max-count quota checks, and admin review queries simpler than joining two image asset concepts
- it avoids creating a third image persistence model after chat attachments and generated exercise images

The current table is generated-image-specific, so reuse should be explicit rather than forcing uploaded images through fake generation fields. Add only the fields needed for uploaded-reference lifecycle and review while preserving existing generated-option behavior.

Recommended additions:

- `asset_kind`: `uploaded_reference` | `generated_candidate`
- `status`: `active` | `rejected` | `deleted` | `abandoned` | `promoted`
- `deleted_at`
- `original_filename`
- `sha256`

Field purposes:

- `asset_kind` separates uploaded references from generated candidates in queries and behavior.
- `status` lets review and cleanup represent rejection, deletion, and promotion without immediately losing audit context.
- `deleted_at` supports delayed physical cleanup and avoids hard-delete edge cases while a review page or admin action may still reference the row.
- `original_filename` is useful review context for user uploads, but should never be used for storage paths.
- `sha256` supports logical idempotency and cleanup verification. It is not a physical file deduplication key in phase 1.

`sha256` idempotency scope:

- use it to avoid duplicate active upload rows for the same exercise type when the same file is submitted twice, such as a retry or double-click
- do not use it to deduplicate physical files across different users or exercise type candidates in phase 1
- use it during cleanup or integrity checks to verify that a stored file still matches its database row when needed

Physical deduplication is intentionally deferred. A content-addressed store such as `uploads/blobs/{sha256[:2]}/{sha256}.webp` would reduce duplicate bytes, but it also changes the lifecycle model:

- multiple `exercise_image_candidates` rows would need to reference the same physical object
- the current unique `storage_path` constraint would need to be relaxed or replaced with a blob/reference model
- deletion would need reference counting or garbage collection before removing the shared file
- per-user/candidate directory structure would become logical metadata rather than the physical storage layout
- backups would need to preserve the shared-object relationship correctly

Given the current upload limits, candidate scoping, 3-month cleanup for rejected or abandoned images, and existing per-flow local storage pattern, the simpler phase-1 choice is to store separate physical files and rely on `sha256` for logical idempotency only. Revisit physical deduplication if disk metrics show uploaded-reference duplication is material.

Recommended compatibility rules:

- existing generated rows default to `asset_kind='generated_candidate'`
- uploaded rows use `asset_kind='uploaded_reference'`
- uploaded rows still get a real `generation_key`, but that key is a deterministic hash over upload identity and file hash, not a model prompt
- uploaded rows use a stable `pipeline_key`, for example `user_upload_v1`
- uploaded rows use a stable `option_key`, for example `uploaded-reference`
- uploaded rows can set `source_image_url` to the stored relative upload path, since the upload itself is the source
- generated-only fields such as `model_name`, `prompt_version`, and `prompt_summary` should either become nullable or use explicit non-misleading values such as `model_name='user-upload'`; making them nullable is cleaner
- admin option queries must filter generated options with `asset_kind='generated_candidate'`
- review/reference queries can include active `asset_kind='uploaded_reference'` rows
- deleted rows are excluded from normal review and generation-source queries

The existing `reference_images_url` can continue to point at uploaded reference paths for compatibility with the generation pipeline. The `ExerciseImageCandidate` row becomes the metadata and lifecycle record for those paths.

Fields that are not needed for the first version:

- `size_bytes`: useful only for persisted byte-quota accounting; file size can be validated at upload time without storing it
- `width` / `height`: useful only if the UI needs to display dimensions later; dimensions can be validated at upload time without storing them
- `uploaded_by_user_id`: useful for audit if admins can upload on behalf of users; not required if ownership is derived from `ExerciseType.owner_id`

Why not add a new table:

- a new table is semantically clean, but it creates another exercise-image asset model with overlapping storage, ownership, cleanup, and review behavior
- the current code already has an exercise-image candidate table and admin-review endpoints; extending that table keeps the feature closer to existing patterns
- the main cost of reuse is a small migration to relax generated-only assumptions and add upload metadata

Rejected alternative schema:

- `exercise_type_image_assets`

Reasons:

- it would duplicate fields already present on `exercise_image_candidates`
- it would require separate cleanup and review queries
- it would still need coordination with `reference_images_url` and the generated-candidate pipeline

Current `exercise_image_candidates` fields that remain useful:

- `exercise_type_id`
- `generation_key`
- `pipeline_key`
- `option_key`
- `option_label`
- `option_description`
- `source_image_index`
- `source_image_url`
- `mime_type`
- `storage_path`

Fields to add for upload support:

- `asset_kind`
- `status`
- `deleted_at`
- `original_filename`
- `sha256`

Why not reuse `chat_attachments`:

- chat attachments are owned by conversation/message parts and may carry Gemini Files API provider references
- candidate exercise images are owned by an exercise type review workflow
- candidate exercise images can become public catalog assets after admin release
- retention rules differ: orphaned chat uploads are short-lived, while candidate references may need to survive review and future regeneration

The implementation should still share code or conventions where practical. A small common image-upload helper for MIME detection, dimensions, hashing, size checks, generated names, and atomic write/rollback would be better than duplicating chat upload logic.

### Separation of concerns

Reusing `exercise_image_candidates` should not mean mixing upload, generation, review, and publishing logic in one large service. The table can be shared while the code remains split by responsibility.

Recommended boundaries:

- `src/shared/image_uploads.py` or equivalent
  - pure image validation and metadata extraction
  - MIME detection from decoded bytes
  - size and pixel-limit checks
  - hashing
  - extension selection
  - optional metadata stripping/transcoding if added
  - no exercise, chat, admin, or database knowledge

- `src/exercises/image_assets.py`
  - exercise-image storage path resolution
  - path traversal protection
  - URL resolution for relative exercise-image paths
  - filesystem read/write/copy/delete helpers for `EXERCISE_IMAGE_STORAGE_DIR`
  - no candidate-review business rules

- `src/exercises/image_candidate_repository.py` or CRUD functions
  - create uploaded-reference rows in `exercise_image_candidates`
  - query generated candidates separately from uploaded references
  - mark uploaded-reference rows deleted/rejected/promoted
  - count images by exercise type and asset kind for max-count quotas
  - no multipart parsing and no Gemini calls

- `src/exercises/image_upload_service.py`
  - owner/admin authorization for candidate image uploads
  - candidate exercise type status checks
  - calls shared image validation
  - writes uploaded bytes under `uploads/...`
  - creates `asset_kind='uploaded_reference'` rows
  - updates `reference_images_url`
  - rolls back the file if database persistence fails

- `src/admin/exercise_image_service.py`
  - remains responsible for Gemini generation and admin option application
  - queries only `asset_kind='generated_candidate'` when building generated options
  - may read `asset_kind='uploaded_reference'` rows as generation source material
  - copies approved generated or uploaded assets into `published/...`

- `src/exercises/router.py`
  - thin HTTP layer for upload/list/delete endpoints
  - multipart parsing and response models
  - delegates workflow to `image_upload_service`

- `src/jobs/exercise_image_cleanup.py`
  - standalone cleanup CLI using the same managed job pattern as chat attachment cleanup
  - determines cleanup eligibility from both row status and age
  - deletes files for rows with `status in ('deleted', 'rejected', 'abandoned')` only after the status-specific retention window has elapsed
  - leaves `status='active'` and `status='promoted'` rows untouched, so published/promoted files are protected by design
  - purges orphaned uploaded files only when their filesystem creation time is older than the configured grace window, avoiding deletion of files from in-flight upload operations
  - follows the race-safe grace-period pattern in `src/jobs/chat_attachment_cleanup.py`, where chat cleanup combines an orphaned-row condition with an age threshold before deleting files
  - emits counts and reclaimed bytes

The core rule: `asset_kind` controls behavior. Upload services create and manage `uploaded_reference`; generation services create and manage `generated_candidate`; publishing copies either kind into `published/...` and updates `ExerciseType.images_url`.

### Backend API

Expose authenticated endpoints under the exercise-type resource.

Recommended endpoints:

- `POST /api/v1/exercises/exercise-types/{exercise_type_id}/images`
  - multipart upload
  - allowed only for the owner while the type is `candidate`, or for admins
  - validates MIME type, size, dimensions, and image decodability
  - writes the file to `uploads/exercise-type-candidates/...`
  - creates an `exercise_image_candidates` row with `asset_kind='uploaded_reference'`
  - updates `reference_images_url` with the uploaded relative path

- `GET /api/v1/exercises/exercise-types/{exercise_type_id}/images`
  - returns image metadata and resolved URLs
  - owner and admins can see candidate uploads
  - public callers only see released `images`

- `DELETE /api/v1/exercises/exercise-types/{exercise_type_id}/images/{asset_id}`
  - marks the uploaded-reference row as `deleted`
  - removes it from `reference_images_url`
  - physical deletion can be done immediately for candidate assets or by cleanup job

Do not accept image URLs directly from clients in the first version. URL ingestion creates SSRF, hotlinking, copyright, and lifecycle problems. The backend should own every uploaded byte it later presents to admins or uses for generation.

### Validation and quotas

Use conservative limits because the VPS disk is shared with the database.

Initial recommended defaults:

- accepted MIME types: `image/jpeg`, `image/png`, `image/webp`
- maximum file size: 5 MB per image
- maximum dimensions: 4096 by 4096 pixels
- maximum decoded pixels: 16 MP
- maximum images per candidate exercise type: 4
- maximum candidate image storage per user: 100 MB
- strip EXIF and metadata before storage
- normalize orientation
- defer resizing and format normalization to publish time

These should be configurable by environment variables, for example:

- `EXERCISE_IMAGE_UPLOAD_MAX_BYTES`
- `EXERCISE_IMAGE_UPLOAD_MAX_COUNT_PER_TYPE`
- `EXERCISE_IMAGE_UPLOAD_MAX_BYTES_PER_USER`
- `EXERCISE_IMAGE_UPLOAD_MAX_PIXELS`
- `EXERCISE_IMAGE_PUBLISHED_MAX_EDGE_PX`
- `EXERCISE_IMAGE_PUBLISHED_FORMAT`

### Image transformations

There are two separate image-processing moments: upload-time sanitization and publish-time normalization.

Upload-time behavior:

- decode the uploaded image to verify it is a real JPEG, PNG, or WebP
- reject images that exceed byte, dimension, or decoded-pixel limits
- normalize orientation based on image metadata
- strip EXIF and other metadata before writing the stored reference file
- preserve the uploaded image's visual content and aspect ratio
- preserve the source format where practical after sanitization
- do not resize valid uploaded references solely to save space in phase 1
- do not apply AI generation, stylistic changes, background removal, cropping, or compression-heavy transformation during upload

Publish-time behavior for direct uploaded images:

- create a published derivative from the sanitized uploaded reference
- normalize to a standard maximum size while preserving aspect ratio
- do not upscale smaller images
- strip metadata from the published derivative
- encode the published derivative as WebP
- write the derivative under `published/...`
- keep the uploaded reference under `uploads/...` for review history and future regeneration

Recommended initial published-size policy:

- `EXERCISE_IMAGE_PUBLISHED_MAX_EDGE_PX=1600`
- `EXERCISE_IMAGE_PUBLISHED_FORMAT=webp`
- resize only when the longest edge exceeds that value
- use deterministic output paths so re-publishing the same asset is idempotent

AI image generation remains a separate admin action. If an admin chooses the generated/polished path, the uploaded reference is used as source material for the existing generation flow; direct publish does not call Gemini.

### Review and release flow

Candidate flow:

1. User creates an exercise type candidate.
2. User uploads one or more reference images.
3. Backend stores uploaded assets and sets `reference_images_url`.
4. User requests review.
5. Admin sees candidate images in the review queue.
6. Admin can:
   - release the uploaded images directly
   - generate polished image options from the uploaded references
   - reject/remove an image
   - release the exercise type without images

Release behavior:

- direct approval normalizes selected uploaded assets to the published image size/format and writes them under `published/...`
- generated approval keeps the existing `generated/...` to `published/...` copy flow
- `ExerciseType.images_url` points only at published assets after release
- `ExerciseType.reference_images_url` may retain the original uploaded references for future regeneration, but public responses should not expose private upload paths unless the type is released and the image was published

This keeps review source material separate from the public image set.

### Product decisions

- Uploads always attach to an existing exercise type candidate. Do not support unattached pre-create uploads.
- Admins may publish direct user-uploaded images; images do not always need to go through the generated/polished pipeline.
- Published direct uploads should be normalized by size before publication.
- Rejected or abandoned candidate images are retained for 3 months, then eligible for cleanup.

## CPX11 Storage Constraints

The current CPX11-style deployment makes local storage acceptable only if growth is controlled.

Main risks:

- uploads and generated image candidates can grow without bound
- Docker images, PostgreSQL, logs, and media all compete for the same disk
- the deploy workflow preserves Docker volumes but does not back them up by itself
- a VPS rebuild or volume loss would lose images unless backups include Docker volumes
- serving images through FastAPI consumes backend CPU and network bandwidth

Required controls before broad rollout:

1. Quotas at upload time.
2. A cleanup job for deleted, orphaned, and stale candidate images.
3. Disk usage metrics and alerts.
4. A backup path that includes `exercise_images_data`.
5. A documented restore path for image files plus database metadata.

### Cleanup job

Install a host `systemd` timer following the existing job pattern in RFC 0004.

Recommended behavior:

- delete physical files only when both status and age make the asset eligible
- remove files for rows with `status='deleted'` after 7 days
- remove files for rows with `status in ('rejected', 'abandoned')` after 3 months
- optionally prune generated candidates that are not current, not published, and older than 30 days
- never delete files for rows with `status='active'`
- never delete files for rows with `status='promoted'`; published/promoted files are protected by design
- purge uploaded files whose database rows were removed only when the filesystem creation time is older than the configured grace window, so in-flight uploads are not removed by a concurrent cleanup run
- emit counts and reclaimed bytes

This should be implemented as a standalone backend CLI and installed by `deploy-vps.yml` the same way chat attachment cleanup and stale workout closure are installed.

The implementation should mirror `src/jobs/chat_attachment_cleanup.py` closely:

- job enable flag in settings
- configurable retention and batch size
- combined lifecycle-plus-time cleanup windows; chat cleanup uses "orphaned and older than threshold", while exercise image cleanup uses "eligible status and older than threshold"
- `run_managed_job(...)` for locking and observability
- service-owned transaction handling
- non-interactive CLI entrypoint that can run through `docker compose -f docker-compose.prod.yml run --rm backend ...`

### Backups

Decision: extend the existing encrypted host backup pattern to include `exercise_images_data` rather than introducing a new backup system for this feature.

This keeps the operational model consistent with the current VPS:

- one family of host-managed backup scripts
- one encryption/passphrase convention
- one pull/restore runbook area
- one `systemd` timer pattern to monitor

The first implementation should therefore extend the existing Postgres backup pattern instead of adding object storage, a managed backup product, or a separate backup agent solely for exercise images.

Current backup foundation:

- `backend/deploy/backups/create-postgres-dump.sh` creates encrypted nightly Postgres dumps.
- `backend/deploy/systemd/pe-be-postgres-backup.timer` schedules that dump.
- `backend/deploy/backups/pull-postgres-backups.sh` pulls encrypted dumps off the VPS.
- `backend/deploy/backups/README.md` documents restore testing.

Recommended image backup mechanism:

- create `backend/deploy/backups/create-exercise-images-archive.sh`
- archive the Docker volume by mounting `exercise_images_data` read-only into a short-lived container or by reading the resolved Docker volume path on the host
- write encrypted archives to `/var/backups/pe-be/exercise-images`
- reuse the same passphrase/config convention as the Postgres backup flow unless there is a reason to separate keys
- install `pe-be-exercise-images-backup.service` and `pe-be-exercise-images-backup.timer`
- run the image backup shortly after the Postgres dump so database metadata and files are reasonably close in time
- create a pull script, or extend the existing pull script, to sync `/var/backups/pe-be/exercise-images`
- document restore as: restore Postgres dump, restore `exercise_images_data`, then run an integrity check for missing referenced files

This keeps the backup model simple and consistent with the current VPS. Object storage remains a delivery/offload option, not the first backup mechanism.

## Object Storage As A Delivery Option

Do not introduce object storage solely to launch the first candidate upload feature. The current local-volume approach is consistent with both generated exercise images and chat attachments, and storage capacity is not the immediate concern.

The value of S3-compatible storage would be mostly delivery architecture:

- published images can be loaded directly from a media origin instead of through FastAPI
- browser image loading can be naturally deferred and parallelized against a separate host
- Caddy and backend CPU/network usage are reduced for public image traffic
- future CDN behavior becomes easier
- deploys and backend restarts become less coupled to public media delivery

That does not mean every private candidate upload should immediately go to S3. Candidate uploads are owner/admin-scoped review material, and serving them through the backend keeps authorization straightforward.

Design the database and service layer so storage is swappable if the delivery decision changes.

Recommended abstraction:

- `ExerciseImageStorage.save_upload(...)`
- `ExerciseImageStorage.copy(...)`
- `ExerciseImageStorage.open(...)`
- `ExerciseImageStorage.delete(...)`
- `ExerciseImageStorage.public_url(...)`

Initial implementation:

- local filesystem under `EXERCISE_IMAGE_STORAGE_DIR`

Future implementation:

- Hetzner Object Storage, Cloudflare R2, Backblaze B2, or another S3-compatible backend

Trigger points to add object storage for published images:

- public image bandwidth becomes material
- image request volume meaningfully affects backend latency or CPU
- image delivery benefits from independent caching, range requests, or CDN behavior
- frontend lazy/deferred image loading should not compete with API traffic
- backup or restore operations become cleaner with media outside the Docker volume
- upload traffic increases beyond admin-review scale
- the backend needs multiple VPS instances

## Security and Privacy

Candidate uploads are user-provided content. Treat them as untrusted.

Required protections:

- require authentication for upload
- enforce owner/admin authorization for candidate image reads
- validate decoded image content, not just `Content-Type`
- use generated storage names, never client filenames
- strip metadata
- reject SVG and other active formats
- add `X-Content-Type-Options: nosniff`
- return images with the validated MIME type
- prevent path traversal with the existing relative-path resolver pattern
- log moderation/rejection reasons without exposing sensitive image content

Generated and uploaded candidate images should remain private by default. Only `published/...` paths should be treated as public catalog media.

## Caching and Delivery

Public published images can use stronger cache headers than private candidate uploads.

Recommended headers:

- `published/...`: `public, max-age=31536000, immutable`
- `generated/...`: `private, max-age=300`
- `uploads/...`: `private, no-store` or short private cache only

The current Caddy setup reverse proxies image requests to the backend and does not act as an image cache. That is fine initially, especially while volume is small. If public image traffic grows, object storage should be evaluated first as a delivery/offload improvement rather than as a response to running out of disk.

## Deployment Implications

Changes needed for the current deploy workflow:

- define any new upload-limit environment variables in `backend/.env.production.template`
- thread those variables through `.github/workflows/deploy-vps.yml`
- keep using the existing `exercise_images_data` volume for first implementation
- install a new cleanup systemd service and timer if cleanup is implemented in the same feature
- ensure `docker compose -f docker-compose.prod.yml run --rm backend ...` can run the cleanup CLI
- document backup and restore before enabling the feature for regular users

No change is required to the public `app.example.com/api/...` contract.

## Alternatives Considered

### Option A: Store uploads in PostgreSQL

Pros:

- transactional with exercise type metadata
- simple backups if database backup is already reliable

Cons:

- bloats the database on a small VPS
- increases backup and restore size
- worsens database I/O pressure
- makes image serving an expensive database operation

Decision: reject.

### Option B: Store uploads in the existing exercise image volume

Pros:

- matches current generated image storage
- no new infrastructure
- deploy workflow already preserves Docker volumes
- easiest path for admin review and generation from uploaded references

Cons:

- disk growth must be controlled
- backups must include the Docker volume
- media serving competes with backend traffic
- not ideal if upload volume grows

Decision: accept for phase 1 with quotas, cleanup, metrics, and backup work.

### Option C: Move all exercise images to object storage first

Pros:

- better durability and scalability
- reduces backend involvement in public image delivery
- easier public image delivery through CDN-style URLs
- can improve deferred image loading by using a separate media origin

Cons:

- adds provider setup and credentials
- requires migration of existing generated and published images
- increases implementation size before validating usage
- makes private candidate-image authorization more complex if applied too broadly

Decision: defer. Keep local storage for now, but keep the storage abstraction and database fields compatible with a future published-media offload.

## Rollout Plan

1. Introduce a defensive migration that extends `exercise_image_candidates` with `asset_kind`, `status`, `deleted_at`, `original_filename`, and `sha256`.
2. Backfill existing rows as `asset_kind='generated_candidate'` and `status='active'`.
3. Relax or populate generated-only fields for uploaded-reference rows without using misleading model metadata.
4. Extract shared image-upload validation helpers, reusing the chat attachment approach for MIME detection, hashing, generated storage names, and file rollback on persistence failure.
5. Implement exercise-image upload service and repository helpers that create `asset_kind='uploaded_reference'` rows, update `ExerciseType.reference_images_url`, and enforce owner/admin authorization.
6. Expose upload/list/delete backend endpoints for candidate exercise-type images.
7. Update existing admin image option queries so generated-option behavior filters on `asset_kind='generated_candidate'`.
8. Surface active uploaded-reference images in admin review and allow them to seed the existing generated-image flow.
9. Enable direct publishing by normalizing approved uploaded references into `published/...` and updating `ExerciseType.images_url`.
10. Build the frontend candidate-image picker with previews, upload progress, and removal.
11. Deploy a cleanup CLI and systemd timer for deleted rows and orphaned uploaded files.
12. Cover migration assumptions, upload validation, authorization, `asset_kind` filtering, deletion, and publishing with focused backend tests.
13. Exercise candidate-image upload/removal and admin-review rendering in frontend tests.
14. Extend the existing backup tooling and runbook to archive and restore `exercise_images_data`.
15. Enable the feature for a small authenticated cohort.
16. Revisit object storage only if public image delivery starts competing with API traffic or would materially benefit from a separate media origin.

## Resolved Questions

- Upload timing: uploads always attach to an existing candidate exercise type.
- Publication: direct user-uploaded images may be published by an admin.
- Retention: rejected or abandoned candidate images are retained for 3 months.
- Backups: extend the existing encrypted host backup pattern to archive `exercise_images_data` alongside Postgres backups.
- Published format: direct uploaded images should be normalized by size before publication.
