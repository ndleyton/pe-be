from __future__ import annotations

import asyncio
import math
from collections import defaultdict, deque
from time import monotonic


class RateLimitExceededError(Exception):
    def __init__(self, retry_after_seconds: int):
        self.retry_after_seconds = retry_after_seconds
        super().__init__("Rate limit exceeded")


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(
        self,
        *,
        scope: str,
        key: str,
        limit: int,
        window_seconds: int,
    ) -> None:
        if limit <= 0 or window_seconds <= 0:
            return

        now = monotonic()
        bucket_key = f"{scope}:{key}"

        async with self._lock:
            bucket = self._buckets[bucket_key]
            threshold = now - window_seconds
            while bucket and bucket[0] <= threshold:
                bucket.popleft()

            if len(bucket) >= limit:
                retry_after = max(bucket[0] + window_seconds - now, 0)
                raise RateLimitExceededError(max(math.ceil(retry_after), 1))

            bucket.append(now)

    async def reset(self) -> None:
        async with self._lock:
            self._buckets.clear()


rate_limiter = InMemoryRateLimiter()
