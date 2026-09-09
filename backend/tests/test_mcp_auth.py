import json

import pytest

from src.mcp import auth
from src.users.pat_schemas import PATPrincipal
from src.users.pat_service import PATAuthenticationError


pytestmark = pytest.mark.asyncio(loop_scope="session")


class _SessionContext:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, *_args):
        return None


async def _call_middleware(scope_type, headers=()):
    events = []

    async def app(_scope, _receive, _send):
        raise AssertionError("Rejected requests must not reach the application")

    async def receive():
        return {"type": f"{scope_type}.connect"}

    async def send(event):
        events.append(event)

    middleware = auth.PATBearerMiddleware(app)
    await middleware({"type": scope_type, "headers": list(headers)}, receive, send)
    return events


@pytest.mark.parametrize("scope_type", ["http", "websocket"])
async def test_missing_bearer_token_uses_transport_valid_rejection(scope_type):
    events = await _call_middleware(scope_type)

    if scope_type == "websocket":
        assert events == [
            {
                "type": "websocket.close",
                "code": 1008,
                "reason": "A Bearer personal access token is required",
            }
        ]
    else:
        assert events[0]["type"] == "http.response.start"
        assert events[0]["status"] == 401
        assert json.loads(events[1]["body"])["detail"].startswith("A Bearer")


@pytest.mark.parametrize(
    ("failure", "detail", "status_code"),
    [
        ("invalid", "Invalid or expired personal access token", 401),
        ("missing_scope", "Missing required scope: trainer:*", 403),
    ],
)
@pytest.mark.parametrize("scope_type", ["http", "websocket"])
async def test_authenticated_rejections_use_transport_valid_events(
    monkeypatch, scope_type, failure, detail, status_code
):
    async def verify(_session, _token):
        if failure == "invalid":
            raise PATAuthenticationError
        return PATPrincipal(user_id=1, credential_id=2, scopes=frozenset())

    monkeypatch.setattr(auth, "async_session_maker", _SessionContext)
    monkeypatch.setattr(auth, "verify_personal_access_token", verify)

    events = await _call_middleware(
        scope_type, [(b"authorization", b"Bearer test-token")]
    )

    if scope_type == "websocket":
        assert events == [{"type": "websocket.close", "code": 1008, "reason": detail}]
    else:
        assert events[0]["type"] == "http.response.start"
        assert events[0]["status"] == status_code
        assert json.loads(events[1]["body"]) == {"detail": detail}


async def test_any_trainer_scope_is_delegated_to_application(monkeypatch):
    principal = PATPrincipal(
        user_id=1, credential_id=2, scopes=frozenset({"trainer:write"})
    )
    app_called = False

    async def verify(_session, _token):
        return principal

    async def app(_scope, _receive, _send):
        nonlocal app_called
        app_called = True
        assert await auth.current_principal() == principal

    async def receive():
        return {"type": "http.request"}

    async def send(_event):
        return None

    monkeypatch.setattr(auth, "async_session_maker", _SessionContext)
    monkeypatch.setattr(auth, "verify_personal_access_token", verify)

    middleware = auth.PATBearerMiddleware(app)
    await middleware(
        {"type": "http", "headers": [(b"authorization", b"Bearer test-token")]},
        receive,
        send,
    )

    assert app_called is True
