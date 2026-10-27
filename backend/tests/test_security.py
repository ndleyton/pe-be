from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import jwt
import pytest

from src.core import security


@pytest.mark.asyncio
async def test_auth_strategy_accepts_real_signed_token():
    strategy = security.get_jwt_strategy()
    user = SimpleNamespace(id=123)
    user_manager = _UserManagerStub(user=user)

    token = await strategy.write_token(user)

    assert strategy.algorithm == "HS256"
    assert await strategy.read_token(token, user_manager) is user
    assert user_manager.requested_ids == [123]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "case",
    [
        "expired",
        "wrong-signature",
        "tampered-payload",
        "unexpected-algorithm",
        "unsigned",
        "wrong-audience",
        "reset-audience",
        "verification-audience",
        "missing-subject",
        "malformed",
    ],
)
async def test_auth_strategy_rejects_invalid_real_tokens(case):
    strategy = security.get_jwt_strategy()
    user_manager = _UserManagerStub(user=SimpleNamespace(id=123))
    payload = {
        "sub": "123",
        "aud": strategy.token_audience,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    key = strategy.encode_key
    algorithm = "HS256"
    if case == "expired":
        payload["exp"] = datetime.now(timezone.utc) - timedelta(minutes=5)
    elif case == "wrong-signature":
        key = "a-different-signing-secret-at-least-32-bytes-long"
    elif case == "unexpected-algorithm":
        algorithm = "HS512"
    elif case == "unsigned":
        algorithm, key = "none", ""
    elif case == "wrong-audience":
        payload["aud"] = "another-service"
    elif case == "reset-audience":
        payload["aud"] = security.UserManager.reset_password_token_audience
    elif case == "verification-audience":
        payload["aud"] = security.UserManager.verification_token_audience
    elif case == "missing-subject":
        del payload["sub"]

    token = jwt.encode(payload, key, algorithm=algorithm)
    if case == "tampered-payload":
        header, _, signature = token.split(".")
        changed = {**payload, "sub": "456"}
        changed_payload = jwt.encode(changed, key, algorithm=algorithm).split(".")[1]
        token = f"{header}.{changed_payload}.{signature}"
    elif case == "malformed":
        token = "not-a-jwt"

    assert await strategy.read_token(token, user_manager) is None
    assert user_manager.parsed_ids == []
    assert user_manager.requested_ids == []


@pytest.mark.asyncio
@pytest.mark.parametrize("purpose", ["reset", "verification"])
@pytest.mark.parametrize(
    "case", ["expired", "wrong-signature", "unexpected-algorithm", "auth-audience"]
)
async def test_account_actions_reject_invalid_real_tokens(purpose, case):
    user_db = AsyncMock()
    manager = security.UserManager(user_db)
    audience = (
        manager.reset_password_token_audience
        if purpose == "reset"
        else manager.verification_token_audience
    )
    payload = {
        "sub": "123",
        "email": "user@example.com",
        "password_fgpt": "fingerprint",
        "aud": audience,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    key = security.SECRET
    algorithm = "HS256"
    if case == "expired":
        payload["exp"] = datetime.now(timezone.utc) - timedelta(minutes=5)
    elif case == "wrong-signature":
        key = "a-different-signing-secret-at-least-32-bytes-long"
    elif case == "unexpected-algorithm":
        algorithm = "HS512"
    elif case == "auth-audience":
        payload["aud"] = security.get_jwt_strategy().token_audience
    token = jwt.encode(payload, key, algorithm=algorithm)

    if purpose == "reset":
        with pytest.raises(security.exceptions.InvalidResetPasswordToken):
            await manager.reset_password(token, "new-password")
    else:
        with pytest.raises(security.exceptions.InvalidVerifyToken):
            await manager.verify(token)

    assert user_db.mock_calls == []


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


@pytest.mark.asyncio
async def test_traced_google_oauth2_records_token_exchange_span(monkeypatch):
    spans: list[_SpanStub] = []
    current_span_attributes: list[dict[str, object]] = []
    client = security.TracedGoogleOAuth2("client-id", "client-secret")

    monkeypatch.setattr(
        security,
        "traced_span",
        lambda name, *, attributes=None: _capture_span(
            spans, name, attributes=attributes
        ),
    )
    monkeypatch.setattr(
        security,
        "set_current_span_attributes",
        lambda attributes: current_span_attributes.append(dict(attributes or {})),
    )

    async def _fake_get_access_token(self, code, redirect_uri, code_verifier=None):
        return {
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_at": 123,
            "id_token": "id-token",
        }

    monkeypatch.setattr(
        security.GoogleOAuth2,
        "get_access_token",
        _fake_get_access_token,
    )

    token = await client.get_access_token(
        "code",
        "https://api.example.com/callback",
        "verifier",
    )

    assert token["access_token"] == "access-token"
    assert [span.name for span in spans] == ["auth.oauth.google.exchange_token"]
    assert spans[0].attributes["auth.oauth.provider"] == "google"
    assert spans[0].attributes["auth.oauth.phase"] == "access_token"
    assert spans[0].attributes["auth.oauth.pkce"] is True
    assert current_span_attributes[-1]["auth.oauth.id_token_present"] is True


@pytest.mark.asyncio
async def test_traced_google_oauth2_records_profile_span(monkeypatch):
    spans: list[_SpanStub] = []
    current_span_attributes: list[dict[str, object]] = []
    client = security.TracedGoogleOAuth2("client-id", "client-secret")

    monkeypatch.setattr(
        security,
        "traced_span",
        lambda name, *, attributes=None: _capture_span(
            spans, name, attributes=attributes
        ),
    )
    monkeypatch.setattr(
        security,
        "set_current_span_attributes",
        lambda attributes: current_span_attributes.append(dict(attributes or {})),
    )

    async def _fake_get_profile(self, token):
        return {
            "emailAddresses": [{"value": "user@example.com"}],
            "resourceName": "people/123",
        }

    monkeypatch.setattr(security.GoogleOAuth2, "get_profile", _fake_get_profile)

    profile = await client.get_profile("token")

    assert profile["resourceName"] == "people/123"
    assert [span.name for span in spans] == ["auth.oauth.google.fetch_profile"]
    assert spans[0].attributes["auth.oauth.provider"] == "google"
    assert spans[0].attributes["auth.oauth.phase"] == "profile"
    assert current_span_attributes[-1]["auth.oauth.google.profile.email_count"] == 1
