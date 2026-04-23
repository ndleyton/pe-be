import pytest

from src.core import dependencies
from src.core.dependencies import AppSQLAlchemyUserDatabase
from src.users.models import OAuthAccount, User


class _CaptureUserDatabase(AppSQLAlchemyUserDatabase):
    def __init__(self):
        super().__init__(
            session=None, user_table=User, oauth_account_table=OAuthAccount
        )
        self.statement = None

    async def _get_user(self, statement):
        self.statement = statement
        return None


class _SessionStub:
    def __init__(self):
        self.added = []
        self.commit_calls = 0
        self.refresh_calls = 0

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commit_calls += 1

    async def refresh(self, value):
        self.refresh_calls += 1


class _SpanStub:
    def __init__(self, name: str, attributes: dict[str, object] | None):
        self.name = name
        self.attributes = dict(attributes or {})


class _CaptureSpan:
    def __init__(self, spans: list[_SpanStub], name: str, *, attributes=None):
        self.span = _SpanStub(name, attributes)
        spans.append(self.span)

    def __enter__(self):
        return self.span

    def __exit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_app_user_db_get_avoids_joining_oauth_accounts():
    user_db = _CaptureUserDatabase()

    await user_db.get(123)

    compiled = str(user_db.statement.compile(compile_kwargs={"literal_binds": True}))
    assert "oauth_accounts" not in compiled


def test_oauth_account_user_id_column_is_indexed():
    assert OAuthAccount.__table__.c.user_id.index is True


@pytest.mark.asyncio
async def test_app_user_db_add_oauth_account_skips_refresh_and_links_by_user_id():
    session = _SessionStub()
    user_db = AppSQLAlchemyUserDatabase(session, User, OAuthAccount)
    user = User(
        id=123,
        email="new.user@example.com",
        hashed_password="hashed",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )

    result = await user_db.add_oauth_account(
        user,
        {
            "oauth_name": "google",
            "access_token": "access-token",
            "account_id": "people/123",
            "account_email": "new.user@example.com",
            "expires_at": 123,
            "refresh_token": "refresh-token",
        },
    )

    assert result is user
    assert session.refresh_calls == 0
    assert session.commit_calls == 1
    assert len(session.added) == 1
    oauth_account = session.added[0]
    assert oauth_account.user_id == 123
    assert oauth_account.oauth_name == "google"


@pytest.mark.asyncio
async def test_app_user_db_update_oauth_account_preserves_provider_when_missing_in_update(
    monkeypatch,
):
    spans: list[_SpanStub] = []
    session = _SessionStub()
    user_db = AppSQLAlchemyUserDatabase(session, User, OAuthAccount)
    user = User(
        id=123,
        email="new.user@example.com",
        hashed_password="hashed",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    oauth_account = OAuthAccount(
        user_id=123,
        oauth_name="google",
        access_token="old-token",
        account_id="people/123",
        account_email="new.user@example.com",
    )

    monkeypatch.setattr(
        dependencies,
        "traced_span",
        lambda name, *, attributes=None: _CaptureSpan(
            spans, name, attributes=attributes
        ),
    )

    result = await user_db.update_oauth_account(
        user,
        oauth_account,
        {
            "access_token": "new-token",
            "refresh_token": "refresh-token",
        },
    )

    assert result is user
    assert oauth_account.access_token == "new-token"
    assert oauth_account.refresh_token == "refresh-token"
    assert spans[0].name == "auth.oauth.update_account"
    assert spans[0].attributes["auth.oauth.provider"] == "google"
