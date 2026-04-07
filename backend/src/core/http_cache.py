import asyncio
import hashlib
from dataclasses import dataclass
from time import monotonic
from typing import Iterable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.responses import Response


@dataclass(slots=True)
class CachedJSONBody:
    body: bytes
    etag: str
    expires_at: float


class TTLResponseCache:
    def __init__(self) -> None:
        self._entries: dict[str, CachedJSONBody] = {}
        self._tag_index: dict[str, set[str]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> CachedJSONBody | None:
        async with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.expires_at <= monotonic():
                self._remove_key_unlocked(key)
                return None
            return entry

    async def set(
        self,
        key: str,
        *,
        body: bytes,
        ttl_seconds: int,
        tags: Iterable[str] = (),
    ) -> CachedJSONBody:
        entry = CachedJSONBody(
            body=body,
            etag=_build_etag(body),
            expires_at=monotonic() + ttl_seconds,
        )
        async with self._lock:
            self._remove_key_unlocked(key)
            self._entries[key] = entry
            for tag in tags:
                self._tag_index.setdefault(tag, set()).add(key)
        return entry

    async def invalidate_tags(self, *tags: str) -> None:
        async with self._lock:
            keys_to_remove: set[str] = set()
            for tag in tags:
                keys_to_remove.update(self._tag_index.get(tag, set()))

            for key in keys_to_remove:
                self._remove_key_unlocked(key)

    async def clear(self) -> None:
        async with self._lock:
            self._entries.clear()
            self._tag_index.clear()

    def _remove_key_unlocked(self, key: str) -> None:
        if key not in self._entries:
            return

        self._entries.pop(key, None)
        empty_tags: list[str] = []
        for tag, keys in self._tag_index.items():
            keys.discard(key)
            if not keys:
                empty_tags.append(tag)
        for tag in empty_tags:
            self._tag_index.pop(tag, None)


def render_json_bytes(payload: object) -> bytes:
    return bytes(JSONResponse(content=payload).body)


def build_cached_json_response(
    request: Request | None,
    *,
    body: bytes,
    etag: str | None,
    cache_control: str,
    vary: str | None = None,
    status_code: int = 200,
) -> Response:
    headers = {"Cache-Control": cache_control}
    if etag is not None:
        headers["ETag"] = etag
    if vary is not None:
        headers["Vary"] = vary

    if etag is not None and request is not None and _etag_matches(
        request.headers.get("if-none-match"), etag
    ):
        return Response(status_code=304, headers=headers)

    body_content = b""
    if request is None or request.method != "HEAD":
        body_content = body
    return Response(
        content=body_content,
        status_code=status_code,
        media_type="application/json",
        headers=headers,
    )


def _build_etag(body: bytes) -> str:
    return f'"{hashlib.sha256(body).hexdigest()}"'


def _etag_matches(header_value: str | None, etag: str) -> bool:
    if not header_value:
        return False

    candidates = [candidate.strip() for candidate in header_value.split(",")]
    normalized_etag = _normalize_etag_token(etag)
    return "*" in candidates or any(
        _normalize_etag_token(candidate) == normalized_etag
        for candidate in candidates
        if candidate
    )


def _normalize_etag_token(value: str) -> str:
    stripped = value.strip()
    if stripped.startswith("W/"):
        return stripped[2:].strip()
    return stripped


response_cache = TTLResponseCache()
