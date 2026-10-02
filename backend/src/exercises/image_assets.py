from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from src.core.config import settings
from src.core.object_storage import (
    PUBLIC_IMMUTABLE_CACHE_CONTROL,
    get_public_media_storage,
)

PUBLISHED_PREFIX = "published/"


def exercise_image_storage_dir() -> Path:
    return Path(settings.EXERCISE_IMAGE_STORAGE_DIR).expanduser().resolve()


def resolve_exercise_image_asset_url(image_url: str) -> str:
    prefix = f"{settings.API_PREFIX}/exercises/assets"
    return f"{prefix.rstrip('/')}/{image_url.lstrip('/')}"


def resolve_exercise_image_url(image_url: str) -> str:
    if image_url.startswith(("http://", "https://")):
        return image_url

    if image_url.startswith(PUBLISHED_PREFIX) and settings.MEDIA_PUBLIC_BASE_URL:
        return f"{settings.MEDIA_PUBLIC_BASE_URL.rstrip('/')}/{image_url}"

    if image_url.startswith(("generated/", PUBLISHED_PREFIX, "uploads/")):
        return resolve_exercise_image_asset_url(image_url)
    else:
        prefix = settings.IMAGE_URL_PREFIX or f"{settings.API_PREFIX}/exercises/assets"

    if prefix:
        return f"{prefix.rstrip('/')}/{image_url.lstrip('/')}"

    return image_url


def resolve_exercise_image_urls(image_urls: Iterable[str]) -> list[str]:
    return [
        resolve_exercise_image_url(image_url) for image_url in image_urls if image_url
    ]


def parse_image_url_list(raw_value: str | list[str] | None) -> list[str]:
    if raw_value is None:
        return []

    try:
        parsed = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
    except (TypeError, json.JSONDecodeError):
        return []

    if not isinstance(parsed, list):
        return []

    return [item for item in parsed if isinstance(item, str) and item]


def storage_path_for_relative_url(relative_url: str) -> Path:
    base_dir = exercise_image_storage_dir()
    candidate_path = (base_dir / relative_url).resolve()
    if base_dir not in candidate_path.parents and candidate_path != base_dir:
        raise ValueError("Exercise image path escapes storage directory")
    return candidate_path


def mirror_published_images(relative_paths: Iterable[str]) -> int:
    """Copy published exercise images to the public media bucket, if enabled.

    Published paths embed a generation key or candidate id, so they never
    change content and can be cached as immutable.
    """
    storage = get_public_media_storage()
    if storage is None:
        return 0

    mirrored = 0
    for relative_path in relative_paths:
        if not relative_path.startswith(PUBLISHED_PREFIX):
            continue
        storage.put_bytes(
            relative_path,
            storage_path_for_relative_url(relative_path).read_bytes(),
            cache_control=PUBLIC_IMMUTABLE_CACHE_CONTROL,
        )
        mirrored += 1
    return mirrored
