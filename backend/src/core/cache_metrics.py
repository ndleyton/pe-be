from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from opentelemetry import metrics
from opentelemetry.metrics import Observation

from src.core.observability import set_current_span_attributes


@dataclass(frozen=True, slots=True)
class CacheMetricsSnapshot:
    entry_count: int
    tag_count: int
    body_bytes: int
    approx_bytes: int


class CacheMetricsReader(Protocol):
    def metrics_snapshot(self) -> CacheMetricsSnapshot: ...


_meter = metrics.get_meter(__name__)
_cache_request_counter = _meter.create_counter(
    "backend.cache.requests",
    unit="{request}",
    description="Cache request decisions by route and outcome.",
)
_cache_reader: CacheMetricsReader | None = None
_gauges_registered = False


def record_cache_request(route: str, *, decision: str, key: str | None) -> None:
    span_attributes = {
        "cache.system": "in_memory_ttl",
        "cache.route": route,
        "cache.decision": decision,
    }
    if key is not None:
        span_attributes["cache.key"] = key
    set_current_span_attributes(span_attributes)
    _cache_request_counter.add(
        1,
        {
            "cache.system": "in_memory_ttl",
            "cache.route": route,
            "cache.decision": decision,
        },
    )


def register_response_cache_metrics(cache: CacheMetricsReader) -> None:
    global _cache_reader
    global _gauges_registered

    _cache_reader = cache
    if _gauges_registered:
        return

    _meter.create_observable_gauge(
        "backend.cache.entries",
        callbacks=[_observe_cache_entries],
        unit="{entry}",
        description="Current number of in-memory backend cache entries.",
    )
    _meter.create_observable_gauge(
        "backend.cache.approx_size",
        callbacks=[_observe_cache_approx_size],
        unit="By",
        description="Approximate bytes held in the in-memory backend cache.",
    )
    _meter.create_observable_gauge(
        "backend.cache.body_size",
        callbacks=[_observe_cache_body_size],
        unit="By",
        description="JSON body bytes held in the in-memory backend cache.",
    )
    _gauges_registered = True


def _observe_cache_entries(_options) -> list[Observation]:
    snapshot = _snapshot()
    return [Observation(snapshot.entry_count, _base_attributes())]


def _observe_cache_approx_size(_options) -> list[Observation]:
    snapshot = _snapshot()
    return [Observation(snapshot.approx_bytes, _base_attributes())]


def _observe_cache_body_size(_options) -> list[Observation]:
    snapshot = _snapshot()
    return [Observation(snapshot.body_bytes, _base_attributes())]


def _snapshot() -> CacheMetricsSnapshot:
    if _cache_reader is None:
        return CacheMetricsSnapshot(
            entry_count=0,
            tag_count=0,
            body_bytes=0,
            approx_bytes=0,
        )
    return _cache_reader.metrics_snapshot()


def _base_attributes() -> dict[str, str]:
    return {"cache.system": "in_memory_ttl"}
