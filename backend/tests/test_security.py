from contextlib import contextmanager
from types import SimpleNamespace

import jwt
import pytest

from src.core import security


class _SpanStub:
    def __init__(self, name: str, attributes: dict[str, object] | None):
        self.name = name
        self.attributes = dict(attributes or {})

    def set_attribute(self, key, value):
        self.attributes[key] = value


@contextmanager
def _capture_span(spans: list[_SpanStub], name: str, *, attributes=None):
    span = _SpanStub(name, attributes)
    spans.append(span)
    yield span


class _UserManagerStub:
    def __init__(self, user=None):
        self.user = user
        self.parsed_ids = []
        self.requested_ids = []

    def parse_id(self, raw_id):
        self.parsed_ids.append(raw_id)
        return int(raw_id)

    async def get(self, parsed_id):
        self.requested_ids.append(parsed_id)
        return self.user


@pytest.mark.asyncio
async def test_traced_jwt_strategy_records_decode_and_lookup_spans(monkeypatch):
    spans: list[_SpanStub] = []
    strategy = security.TracedJWTStrategy(secret="secret", lifetime_seconds=60)
    user = SimpleNamespace(id=123)
    user_manager = _UserManagerStub(user=user)

    monkeypatch.setattr(
        security,
        "traced_span",
        lambda name, *, attributes=None: _capture_span(
            spans, name, attributes=attributes
        ),
    )
    monkeypatch.setattr(security, "decode_jwt", lambda *args, **kwargs: {"sub": "123"})

    result = await strategy.read_token("token", user_manager)

    assert result is user
    assert [span.name for span in spans] == ["auth.jwt.decode", "auth.user.lookup"]
    assert spans[0].attributes["auth.jwt.valid"] is True
    assert spans[0].attributes["auth.jwt.subject_present"] is True
    assert user_manager.parsed_ids == ["123"]
    assert user_manager.requested_ids == [123]


@pytest.mark.asyncio
async def test_traced_jwt_strategy_stops_on_invalid_token(monkeypatch):
    spans: list[_SpanStub] = []
    strategy = security.TracedJWTStrategy(secret="secret", lifetime_seconds=60)
    user_manager = _UserManagerStub()

    monkeypatch.setattr(
        security,
        "traced_span",
        lambda name, *, attributes=None: _capture_span(
            spans, name, attributes=attributes
        ),
    )

    def _raise_invalid(*args, **kwargs):
        raise jwt.PyJWTError("invalid token")

    monkeypatch.setattr(security, "decode_jwt", _raise_invalid)

    result = await strategy.read_token("token", user_manager)

    assert result is None
    assert [span.name for span in spans] == ["auth.jwt.decode"]
    assert spans[0].attributes["auth.jwt.valid"] is False
    assert user_manager.parsed_ids == []
    assert user_manager.requested_ids == []
