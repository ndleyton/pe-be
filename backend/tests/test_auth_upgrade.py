import json
from http.cookies import SimpleCookie
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlsplit

import jwt
import pytest

from src.core import security
from src.core.config import settings
from src.main import app
from src.users.models import User


@pytest.fixture
def legacy_auth():
    # Captured with v14/PyJWT 2.10.1/pwdlib 0.2.1, not regenerated on upgrade.
    return json.loads(
        (Path(__file__).parent / "fixtures" / "auth_before_v15.json").read_text()
    )


@pytest.mark.asyncio
async def test_pre_upgrade_token_authenticates_session(
    async_client, db_session, monkeypatch, legacy_auth
):
    monkeypatch.setattr(security, "SECRET", legacy_auth["secret"])
    user = User(
        id=123, email="legacy@example.com", hashed_password="unused", is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    async_client.base_url = "https://test"
    async_client.cookies.set("personalbestie_session", legacy_auth["token"])

    response = await async_client.get("/api/v1/auth/session")

    assert response.status_code == 200, response.text
    assert response.json()["id"] == user.id


@pytest.mark.asyncio
@pytest.mark.parametrize("hash_type", ["argon2", "bcrypt"])
async def test_pre_upgrade_password_can_log_in(
    async_client, db_session, legacy_auth, hash_type
):
    user = User(
        email="legacy@example.com",
        hashed_password=legacy_auth["hashes"][hash_type],
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    async_client.base_url = "https://test"

    response = await async_client.post(
        "/api/v1/auth/jwt/login",
        data={"username": user.email, "password": legacy_auth["password"]},
    )

    assert response.status_code == 302, response.text
    assert "personalbestie_session=" in response.headers["set-cookie"]
    session = await async_client.get("/api/v1/auth/session")
    assert session.status_code == 200, session.text
    assert session.json()["id"] == user.id


@pytest.mark.asyncio
@pytest.mark.parametrize("cookie_case", ["matching", "missing", "mismatched"])
async def test_google_oauth_csrf_cookie_round_trip(
    async_client, monkeypatch, cookie_case
):
    oauth = security.google_oauth_client
    monkeypatch.setattr(
        oauth, "get_access_token", AsyncMock(return_value={"access_token": "google-token"})
    )
    get_identity = AsyncMock(return_value=("google-id", "oauth@example.com"))
    monkeypatch.setattr(oauth, "get_id_email", get_identity)
    user = SimpleNamespace(id=123, is_active=True)
    manager = AsyncMock()
    manager.oauth_callback.return_value = user

    async def override_manager():
        yield manager

    app.dependency_overrides[security.get_user_manager] = override_manager
    # Exercise local HTTP by default, and HTTPS with production Secure cookies.
    async_client.base_url = "https://test" if settings.COOKIE_SECURE else "http://test"
    response = await async_client.get("/api/v1/auth/google/authorize")
    assert response.status_code == 200, response.text
    cookie = SimpleCookie(response.headers["set-cookie"])["fastapiusersoauthcsrf"]
    assert cookie["httponly"]
    assert bool(cookie["secure"]) == settings.COOKIE_SECURE
    assert cookie["samesite"] == "lax"
    assert cookie["path"] == "/"
    assert cookie["domain"] == ""
    state = parse_qs(urlsplit(response.json()["authorization_url"]).query)["state"][0]
    claims = jwt.decode(
        state,
        settings.SECRET_KEY,
        algorithms=["HS256"],
        audience="fastapi-users:oauth-state",
    )
    assert claims["csrftoken"] == cookie.value

    if cookie_case != "matching":
        async_client.cookies.clear()
        if cookie_case == "mismatched":
            async_client.cookies.set("fastapiusersoauthcsrf", "wrong-token")
    callback = await async_client.get(
        "/api/v1/auth/google/callback", params={"code": "google-code", "state": state}
    )

    if cookie_case == "matching":
        assert callback.status_code == 302, callback.text
        assert "personalbestie_session=" in callback.headers["set-cookie"]
        manager.oauth_callback.assert_awaited_once()
        manager.on_after_login.assert_awaited_once()
    else:
        assert callback.status_code == 400, callback.text
        assert callback.json()["detail"] == "OAUTH_INVALID_STATE"
        get_identity.assert_not_awaited()
        manager.oauth_callback.assert_not_awaited()
