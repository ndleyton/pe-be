# RFC 0012: Serve Media from Cloudflare R2

- Status: In progress (phase 1 implemented)
- Date: 2026-10-02
- Owners: Backend

## Summary

Move uploaded and generated images out of the VPS's local Docker volumes and into Cloudflare R2. Public images are served from `https://media.example.com` through Cloudflare's CDN. Private images are served through short-lived presigned URLs.

The rollout is phased. Phase 1, implemented in this change, mirrors **published exercise images** to the public bucket and can switch their URLs to the CDN once a one-time backfill has run.

## Context

Today every image request goes through the backend:

```text
browser → Render proxy → Caddy (VPS, Ashburn) → FastAPI auth + DB lookup → FileResponse from a local volume
```

- **Volumes:** `exercise_images_data`, `workout_photos_data` and `chat_attachments_data` live on the VPS disk.
- **Bad for lists:** list screens send one Python request per image, which uses workers and DB pool connections.
- **Far from many users:** the VPS is in US East, so users in Europe, Asia and South America pay a round trip on every image.
- **Blocks scaling out:** local files tie the app to one server. This is a prerequisite for option B in [RFC 0011](0011-zero-downtime-backend-deploys.md).

The upload pipeline itself is already good and stays unchanged: MIME sniffing, size and pixel limits, EXIF transpose, resizing, and WebP output.

## Cloudflare setup (done)

| Item | Value |
| --- | --- |
| Zone | `example.com`; SSL Full (strict), Always Use HTTPS, minimum TLS 1.2 |
| Public bucket | `pe-be-public`, location hint ENAM, custom domain `media.example.com` |
| Cache rule | Hostname `media.example.com`, eligible for cache, Edge TTL follows `Cache-Control` |
| Private bucket | `pe-be-private`, ENAM, no public access |
| API token | Object Read & Write, scoped to both buckets |

Verified: `curl -sI https://media.example.com/<object>` returns `MISS`, then `HIT`.

## Design

### Storage layer

`src/core/object_storage.py` wraps an S3-compatible client (`boto3` with `endpoint_url`):

- `ObjectStorage.put_bytes(key, data, content_type=None, cache_control=None)` and `delete(key)`
- `get_public_media_storage()` returns the public bucket, or `None` when `MEDIA_STORAGE_BACKEND` is not `r2`.

Local disk stays the source of truth during the migration. Dev and tests run with `MEDIA_STORAGE_BACKEND=local`, so they need no R2 access.

### Configuration

```text
MEDIA_STORAGE_BACKEND=r2                      # default: local
R2_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_BUCKET=pe-be-public
R2_PRIVATE_BUCKET=pe-be-private              # used from phase 2
MEDIA_PUBLIC_BASE_URL=https://media.example.com   # set only after backfill
CLOUDFLARE_ZONE_ID=...
CLOUDFLARE_CACHE_PURGE_TOKEN=...             # Cache Purge permission, scoped to the zone
JOB_PUBLIC_MEDIA_RECONCILIATION_ENABLED=true # default: true; false disables scheduled cleanup
PUBLIC_MEDIA_ORPHAN_GRACE_HOURS=24           # minimum: 1
```

### Object keys and caching

Keys reuse the existing relative storage paths (for example `published/exercise-type-12/front/0-<generation_key>-<sha256[:16]>.png`). Published paths include a generation key or candidate id, so their content does not change. They are uploaded with `Cache-Control: public, max-age=300, s-maxage=31536000`: browsers cache for five minutes, while the CDN can cache for a year.

### Serving by image type

| Media | Visibility | Serving |
| --- | --- | --- |
| Published exercise images | Public | `media.example.com/<key>`, cached at the edge for a year; browser TTL five minutes |
| Exercise upload/generated candidates | Owner/admin only | Stay on the backend for now (`private, no-store`) |
| Workout photos | Private | Presigned GET URLs from `pe-be-private`, with the expiry rounded to the hour so URLs stay cacheable |
| Chat attachments | Private | Presigned GET URLs |

## Rollout

### Phase 1: published exercise images (this change)

1. When `apply_reference_or_option` publishes images, it writes them locally as before, then mirrors them to `pe-be-public`. If the upload fails, the request fails before commit, as a local write failure does today.
2. `python -m src.jobs.backfill_public_media [--dry-run]` uploads the `published/` files referenced by committed `ExerciseType.images_url` values. Orphaned files are skipped.
3. Once the backfill has run, setting `MEDIA_PUBLIC_BASE_URL` makes `resolve_exercise_image_url` return CDN URLs for `published/` paths. Unsetting it rolls back immediately, because the local files are still there.

The Deploy VPS workflow reads the phase 1 media settings above from GitHub repository secrets. Configure them before deployment; `MEDIA_STORAGE_BACKEND` defaults to `local`. Set the `MEDIA_PUBLIC_BASE_URL` secret only after backfill.

Deploy order:
1. Deploy the code with `MEDIA_STORAGE_BACKEND=r2` and no `MEDIA_PUBLIC_BASE_URL`.
2. Run the backfill with `docker compose -f docker-compose.prod.yml run --rm backend python -m src.jobs.backfill_public_media`.
3. Spot-check a few keys with `curl`.
4. Set `MEDIA_PUBLIC_BASE_URL` and restart.

### Phase 2: workout photos and chat attachments

- Write to `pe-be-private` alongside the local volume.
- Return presigned URLs in API payloads, and make `/photo/file` redirect to them.
- Generate a ~400 px thumbnail at upload time for list views.
- Backfill both volumes.
- Move the cleanup jobs (`workout_photo_cleanup`, `chat_attachment_cleanup`, `exercise_image_cleanup`) to delete from R2 as well.
- Published image reconciliation and takedowns are implemented in Phase 1 (below).

### Phase 3: retire local volumes

Move the persistent `.published-media-pending/` retry ledger to shared durable storage before removing the image volume. Once reads come from R2 only, stop the local writes, remove the three volumes from `docker-compose.prod.yml`, and make R2 the source of truth. This removes the storage blocker from RFC 0011 option B.

## Reconciliation and takedowns

`python -m src.jobs.reconcile_public_media --dry-run` reports eligible publications without writing retry records, deleting files/objects, or purging cache. Without `--dry-run`, it sweeps local `published/` files and paginated R2 keys older than `PUBLIC_MEDIA_ORPHAN_GRACE_HOURS`, and retries pending takedowns even when origin files/objects are already gone.

Database references in **both** `images_url` and `reference_images_url` protect a publication, even if its local file is missing. Before each deletion the job checks references again under the same PostgreSQL transaction advisory lock used by publishing and backfill. Offline scripts modifying publication references must acquire that lock too, or run with reconciliation stopped.

Replacement queues retired paths before commit and attempts takedown after commit. `DELETE /api/v1/admin/exercise-types/{id}/published-images` clears current images and any published references; private candidate originals remain private. It requires an administrator. It returns cleanup counts, with HTTP 202 when deletion or purge remains pending. Shared publications are retained while any row still references them.

Each takedown has an atomic, fsynced JSON record in `.published-media-pending/` on the existing persistent image volume. Records remain until local deletion, R2 deletion, and Cloudflare URL purge all succeed. The hourly job retries failures and exits unsuccessfully if any attempts still fail. This ledger is intentionally tied to Phase 1's persistent local volume and must be migrated before retiring that volume.

The deployment workflow installs, reloads, enables, restarts, and verifies `pe-be-public-media-reconciliation.timer`. Configure the zone ID and Cache Purge token before enabling R2 in production. Set the public media base URL after backfill, as in the rollout above; until it is set, purge attempts remain pending and are retried. Disabling R2 does not cancel pending R2 takedowns; restore the R2 settings to finish those retries.

Browser copies and prior downloads cannot be recalled. The five-minute browser TTL applies to new responses. For existing objects, rerun backfill to update their cache metadata and purge their CDN URLs; already cached browser responses can retain their original one-year policy. Configure Cloudflare's Browser Cache TTL to respect the origin's shorter policy, and keep the CDN cache key at its default so URL purges cover it.

Manual VPS installs must copy the service/timer into `/etc/systemd/system/` (substituting the deploy path), run `systemctl daemon-reload`, enable and restart the timer, and verify `systemctl is-enabled` and `systemctl is-active`. A Compose redeploy alone does not install timers.

## Cost

R2 has free egress. Storage costs $0.015/GB-month, writes $4.50 per million and reads $0.36 per million, with a free tier of 10 GB, 1M writes and 10M reads per month. Expected cost at current scale is $0, and about $2/month at 100× growth. Edge-cached reads never reach the bucket. These are approximate list prices; check them against Cloudflare's pricing page.

## Risks and open questions

- **Republished uploads:** handled. Uploaded references publish to `published/.../uploaded/<candidate_id>-<sha256[:16]>.<ext>`, so changed bytes get a new key and existing immutable objects are never overwritten. Keys published before this change keep their old names.
- **Regenerated candidates:** generated publications include a hash of the published bytes. Regeneration with different bytes gets a new immutable key; existing publications keep their old names.
- **Request latency:** mirroring adds one R2 PUT per published image to the admin request. This is acceptable for an admin-only path.
- **Mid-publish failure:** newly created, unreferenced publications are deleted from local disk and R2, followed by a cache purge. Pre-existing and database-referenced paths are kept. Failed deletion or purge retains a persistent retry record; failed commits are handled by reconciliation after the grace period.
- **Exposure before commit:** publication uploads bytes before the database commit. A failed or ambiguous commit can leave a public object; new publication retry records and reconciliation remove unreferenced leftovers after the grace period. Keys are content addressed, but are not secrets. Publishing user photos is a public disclosure decision, and cleanup does not undo earlier downloads.
- **Secrets:** R2 credentials and the zone-scoped Cache Purge token are supplied through GitHub repository secrets and written to `backend/.env.production` by the deployment workflow.
- **Open question:** should public profile workout photos use the public bucket? Decide in phase 2.
