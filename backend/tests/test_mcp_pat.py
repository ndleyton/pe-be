from datetime import datetime, timedelta, timezone

import pytest

from src.users.models import User
from src.users.pat_models import PersonalAccessToken
from src.users.pat_service import (
    PATAuthenticationError,
    _token_hash,
    verify_personal_access_token,
)


class _Rows:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _Session:
    def __init__(self, rows):
        self.rows = rows
        self.commits = 0

    async def execute(self, _statement):
        return _Rows(self.rows)

    async def commit(self):
        self.commits += 1


def _credential(token: str):
    prefix = token.split("_")[2]
    record = PersonalAccessToken(
        id=12,
        user_id=34,
        name="Desktop",
        token_prefix=prefix,
        token_hash=_token_hash(token),
        scopes=["trainer:read", "trainer:write"],
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    user = User(
        id=34,
        email="mcp@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    return record, user


@pytest.mark.asyncio(loop_scope="session")
async def test_pat_verification_resolves_scoped_principal_and_tracks_use():
    token = "pebe_pat_0123456789ab_abcdefghijklmnopqrstuvwxyz012345"
    record, user = _credential(token)
    session = _Session([(record, user)])

    principal = await verify_personal_access_token(session, token)

    assert principal.user_id == 34
    assert principal.credential_id == 12
    assert principal.scopes == frozenset({"trainer:read", "trainer:write"})
    assert record.last_used_at is not None
    assert session.commits == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_pat_verification_rejects_wrong_secret_and_revoked_token():
    token = "pebe_pat_0123456789ab_abcdefghijklmnopqrstuvwxyz012345"
    record, user = _credential(token)
    session = _Session([(record, user)])

    with pytest.raises(PATAuthenticationError):
        await verify_personal_access_token(
            session,
            "pebe_pat_0123456789ab_abcdefghijklmnopqrstuvwxyz999999",
        )

    record.revoked_at = datetime.now(timezone.utc)
    with pytest.raises(PATAuthenticationError):
        await verify_personal_access_token(session, token)
