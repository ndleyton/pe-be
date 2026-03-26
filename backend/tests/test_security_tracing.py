from dataclasses import dataclass

import pytest
from fastapi import HTTPException
from fastapi_users import exceptions
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
    InMemorySpanExporter,
)

from src.core import security


@dataclass
class _UserStub:
    id: int
    is_active: bool = True
    is_verified: bool = True
    is_superuser: bool = False


class _UserManagerStub:
    def __init__(self, user: _UserStub | None):
        self._user = user

    def parse_id(self, value):
        return int(value)

    async def get(self, user_id: int):
        if self._user is None or self._user.id != user_id:
            raise exceptions.UserNotExists()
        return self._user


@pytest.fixture
def span_exporter(monkeypatch):
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    monkeypatch.setattr(security, "_tracer", provider.get_tracer("test-security"))
    return exporter


@pytest.mark.asyncio
async def test_traced_authenticator_emits_spans_for_authenticated_user(span_exporter):
    user = _UserStub(id=123)
    user_manager = _UserManagerStub(user)
    strategy = security.TracedJWTStrategy(secret="test-secret", lifetime_seconds=3600)
    token = await strategy.write_token(user)
    authenticator = security.TracedAuthenticator([security.auth_backend], lambda: None)

    resolved_user, resolved_token = await authenticator._authenticate(
        user_manager=user_manager,
        jwt=token,
        strategy_jwt=strategy,
        active=True,
    )

    assert resolved_user is user
    assert resolved_token == token

    spans = {span.name: span for span in span_exporter.get_finished_spans()}
    assert set(spans) == {"auth.current_user", "auth.jwt.read_token"}
    assert spans["auth.current_user"].attributes["auth.result"] == "authenticated"
    assert spans["auth.current_user"].attributes["auth.token_present"] is True
    assert spans["auth.current_user"].attributes["enduser.id"] == "123"
    assert spans["auth.jwt.read_token"].attributes["auth.user_found"] is True


@pytest.mark.asyncio
async def test_traced_authenticator_records_rejected_auth(span_exporter):
    strategy = security.TracedJWTStrategy(secret="test-secret", lifetime_seconds=3600)
    authenticator = security.TracedAuthenticator([security.auth_backend], lambda: None)

    with pytest.raises(HTTPException) as exc_info:
        await authenticator._authenticate(
            user_manager=_UserManagerStub(None),
            jwt="not-a-real-token",
            strategy_jwt=strategy,
            active=True,
        )

    assert exc_info.value.status_code == 401

    spans = {span.name: span for span in span_exporter.get_finished_spans()}
    assert spans["auth.current_user"].attributes["auth.result"] == "rejected"
    assert spans["auth.current_user"].attributes["http.status_code"] == 401
    assert spans["auth.jwt.read_token"].attributes["auth.user_found"] is False
