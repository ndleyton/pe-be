from src.core.observability import _excluded_urls, _server_request_hook


class _SpanStub:
    def __init__(self):
        self.attributes = {}

    def is_recording(self):
        return True

    def set_attribute(self, key, value):
        self.attributes[key] = value


def test_excluded_urls_splits_and_trims(monkeypatch):
    monkeypatch.setattr(
        "src.core.observability.settings.OTEL_EXCLUDED_URLS",
        "/health, /metrics ,",
    )

    assert _excluded_urls() == "/health,/metrics"


def test_server_request_hook_sets_request_id():
    span = _SpanStub()
    scope = {"headers": [(b"x-request-id", b"req-123")]}

    _server_request_hook(span, scope)

    assert span.attributes["request.id"] == "req-123"
