from __future__ import annotations

import mimetypes
from functools import lru_cache
from typing import Any
from urllib.parse import quote

from src.core.config import settings

PUBLIC_MEDIA_CACHE_CONTROL = "public, max-age=300, s-maxage=31536000"


class ObjectStorage:
    """Thin wrapper over an S3-compatible bucket (Cloudflare R2)."""

    def __init__(self, *, bucket: str, client: Any) -> None:
        self.bucket = bucket
        self._client = client

    def put_bytes(
        self,
        key: str,
        data: bytes,
        *,
        content_type: str | None = None,
        cache_control: str | None = None,
    ) -> None:
        extra: dict[str, str] = {
            "ContentType": content_type
            or mimetypes.guess_type(key)[0]
            or "application/octet-stream",
        }
        if cache_control:
            extra["CacheControl"] = cache_control
        self._client.put_object(Bucket=self.bucket, Key=key, Body=data, **extra)

    def list_objects(self, prefix: str):
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            for item in page.get("Contents", []):
                yield item["Key"], item["LastModified"]

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=key)


def r2_enabled() -> bool:
    return settings.MEDIA_STORAGE_BACKEND.strip().lower() == "r2"


@lru_cache(maxsize=1)
def _r2_client() -> Any:
    import boto3
    from botocore.config import Config

    if not (
        settings.R2_ENDPOINT_URL
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
    ):
        raise RuntimeError(
            "MEDIA_STORAGE_BACKEND=r2 requires R2_ENDPOINT_URL, "
            "R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY"
        )
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(retries={"max_attempts": 3, "mode": "standard"}),
    )


def get_public_media_storage() -> ObjectStorage | None:
    """Return the public media bucket, or None when R2 mirroring is off."""
    if not r2_enabled():
        return None
    if not settings.R2_PUBLIC_BUCKET:
        raise RuntimeError("MEDIA_STORAGE_BACKEND=r2 requires R2_PUBLIC_BUCKET")
    return ObjectStorage(bucket=settings.R2_PUBLIC_BUCKET, client=_r2_client())


def purge_public_media(key: str, *, base_url: str) -> None:
    import httpx

    if not (
        base_url
        and settings.CLOUDFLARE_ZONE_ID
        and settings.CLOUDFLARE_CACHE_PURGE_TOKEN
    ):
        raise RuntimeError(
            "Public media purge requires MEDIA_PUBLIC_BASE_URL, CLOUDFLARE_ZONE_ID and CLOUDFLARE_CACHE_PURGE_TOKEN"
        )
    # shortcut: one purge call per key; batch up to 30 URLs when orphan sweeps grow large.
    response = httpx.post(
        f"https://api.cloudflare.com/client/v4/zones/{settings.CLOUDFLARE_ZONE_ID}/purge_cache",
        headers={"Authorization": f"Bearer {settings.CLOUDFLARE_CACHE_PURGE_TOKEN}"},
        json={"files": [f"{base_url.rstrip('/')}/{quote(key, safe='/')}"]},
        timeout=15,
    )
    response.raise_for_status()
    if response.json().get("success") is not True:
        raise RuntimeError("Cloudflare cache purge was unsuccessful")
