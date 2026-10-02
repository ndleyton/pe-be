# RFC 0012: Serve Media from Cloudflare R2

- Status: In progress (phase 1 implemented)
- Date: 2026-10-02
- Owners: Backend

## Summary

Move uploaded and generated images out of the VPS's local Docker volumes and into Cloudflare R2. Public images are served from `https://media.personalbestie.com` through Cloudflare's CDN. Private images are served through short-lived presigned URLs.

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
| Zone | `personalbestie.com`; SSL Full (strict), Always Use HTTPS, minimum TLS 1.2 |
| Public bucket | `pe-be-public`, location hint ENAM, custom domain `media.personalbestie.com` |
| Cache rule | Hostname `media.personalbestie.com`, eligible for cache, Edge TTL follows `Cache-Control` |
| Private bucket | `pe-be-private`, ENAM, no public access |
| API token | Object Read & Write, scoped to both buckets |

Verified: `curl -sI https://media.personalbestie.com/<object>` returns `MISS`, then `HIT`.

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
MEDIA_PUBLIC_BASE_URL=https://media.personalbestie.com   # set only after backfill
```

### Object keys and caching

Keys reuse the existing relative storage paths (for example `published/exercise-type-12/front/0-<generation_key>.png`). Published paths include a generation key or candidate id, so their content does not change. They are uploaded with `Cache-Control: public, max-age=31536000, immutable`.

### Serving by image type

| Media | Visibility | Serving |
| --- | --- | --- |
| Published exercise images | Public | `media.personalbestie.com/<key>`, cached at the edge for a year |
| Exercise upload/generated candidates | Owner/admin only | Stay on the backend for now (`private, no-store`) |
| Workout photos | Private | Presigned GET URLs from `pe-be-private`, with the expiry rounded to the hour so URLs stay cacheable |
| Chat attachments | Private | Presigned GET URLs |

## Rollout

### Phase 1: published exercise images (this change)

1. When `apply_reference_or_option` publishes images, it writes them locally as before, then mirrors them to `pe-be-public`. If the upload fails, the request fails before commit, as a local write failure does today.
2. `python -m src.jobs.backfill_public_media [--dry-run]` uploads all existing `published/` files.
3. Once the backfill has run, setting `MEDIA_PUBLIC_BASE_URL` makes `resolve_exercise_image_url` return CDN URLs for `published/` paths. Unsetting it rolls back immediately, because the local files are still there.

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

### Phase 3: retire local volumes

Once reads come from R2 only, stop the local writes, remove the three volumes from `docker-compose.prod.yml`, and make R2 the source of truth. This removes the storage blocker from RFC 0011 option B.

## Cost

R2 has free egress. Storage costs $0.015/GB-month, writes $4.50 per million and reads $0.36 per million, with a free tier of 10 GB, 1M writes and 10M reads per month. Expected cost at current scale is $0, and about $2/month at 100× growth. Edge-cached reads never reach the bucket. These are approximate list prices; check them against Cloudflare's pricing page.

## Risks and open questions

- **Republished uploads:** a republished uploaded reference reuses the key `published/.../uploaded/<candidate_id>.<ext>`. If the encoding settings change between publishes, the CDN can serve the old bytes for up to a year. Mitigate by adding a content hash to that key.
- **Request latency:** mirroring adds one R2 PUT per published image to the admin request. This is acceptable for an admin-only path.
- **Mid-publish failure:** a failed mirror after a partial publish leaves orphaned objects in R2. They're harmless, because unreferenced published keys are never linked.
- **Secrets:** R2 credentials live only in `backend/.env.production` on the VPS.
- **Open question:** should public profile workout photos use the public bucket? Decide in phase 2.
