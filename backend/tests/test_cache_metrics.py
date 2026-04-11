import pytest

from src.core.cache_metrics import record_cache_request
from src.core.http_cache import TTLResponseCache


class _CounterStub:
    def __init__(self) -> None:
        self.calls: list[tuple[int, dict[str, str]]] = []

    def add(self, amount: int, attributes: dict[str, str]) -> None:
        self.calls.append((amount, attributes))


@pytest.mark.asyncio(loop_scope="session")
async def test_cache_metrics_snapshot_tracks_entries_and_bytes():
    cache = TTLResponseCache()
    body = b'{"ok":true}'

    assert cache.metrics_snapshot().entry_count == 0
    assert cache.metrics_snapshot().approx_bytes == 0

    await cache.set("demo-key", body=body, ttl_seconds=30, tags=("catalog",))

    snapshot = cache.metrics_snapshot()
    assert snapshot.entry_count == 1
    assert snapshot.tag_count == 1
    assert snapshot.body_bytes == len(body)
    assert snapshot.approx_bytes > snapshot.body_bytes

    await cache.invalidate_tags("catalog")

    snapshot = cache.metrics_snapshot()
    assert snapshot.entry_count == 0
    assert snapshot.tag_count == 0
    assert snapshot.body_bytes == 0
    assert snapshot.approx_bytes == 0


def test_record_cache_request_sets_span_attributes_and_counter(monkeypatch):
    counter = _CounterStub()
    recorded_attributes: list[dict[str, str]] = []

    monkeypatch.setattr("src.core.cache_metrics._cache_request_counter", counter)
    monkeypatch.setattr(
        "src.core.cache_metrics.set_current_span_attributes",
        lambda attributes: recorded_attributes.append(attributes),
    )

    record_cache_request("exercise_types", decision="hit", key="exercise-types:key")

    assert recorded_attributes == [
        {
            "cache.system": "in_memory_ttl",
            "cache.route": "exercise_types",
            "cache.decision": "hit",
            "cache.key": "exercise-types:key",
        }
    ]
    assert counter.calls == [
        (
            1,
            {
                "cache.system": "in_memory_ttl",
                "cache.route": "exercise_types",
                "cache.decision": "hit",
            },
        )
    ]
