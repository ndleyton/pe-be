import pytest

from src.users.crud import (
    get_user_by_id,
    get_user_by_email,
    create_user,
    update_user,
    delete_user,
)
from src.users.models import User
from src.users.schemas import UserUpdate
from src.users.service import UserService


pytestmark = pytest.mark.asyncio(loop_scope="session")


class _CreatePayload:
    """Simple payload with DB-ready fields for create_user tests."""

    def __init__(
        self,
        *,
        email: str,
        hashed_password: str = "hashed",
        is_active: bool = True,
        is_superuser: bool = False,
        is_verified: bool = True,
    ):
        self.email = email
        self.hashed_password = hashed_password
        self.is_active = is_active
        self.is_superuser = is_superuser
        self.is_verified = is_verified

    def model_dump(self):
        return {
            "email": self.email,
            "hashed_password": self.hashed_password,
            "is_active": self.is_active,
            "is_superuser": self.is_superuser,
            "is_verified": self.is_verified,
        }


async def _seed_user(db_session, email: str) -> User:
    user = User(
        email=email,
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def test_users_crud_happy_paths(db_session):
    created = await create_user(
        db_session,
        _CreatePayload(email="crud-create@example.com"),
    )
    assert created.id is not None

    by_id = await get_user_by_id(db_session, created.id)
    assert by_id is not None
    assert by_id.email == "crud-create@example.com"

    by_email = await get_user_by_email(db_session, "crud-create@example.com")
    assert by_email is not None
    assert by_email.id == created.id

    updated = await update_user(
        db_session,
        created.id,
        UserUpdate(name="Updated Name", is_active=True),
    )
    assert updated is not None
    assert updated.name == "Updated Name"

    deleted = await delete_user(db_session, created.id)
    assert deleted is True
    assert await get_user_by_id(db_session, created.id) is None


async def test_users_crud_not_found_paths(db_session):
    assert await get_user_by_id(db_session, 99999) is None
    assert await get_user_by_email(db_session, "missing@example.com") is None
    assert await update_user(db_session, 99999, UserUpdate(name="Nope")) is None
    assert await delete_user(db_session, 99999) is False


async def test_user_service_delegates_to_crud(monkeypatch, db_session):
    user = await _seed_user(db_session, "svc@example.com")

    async def _fake_get_user_by_id(session, user_id):
        assert session is db_session
        assert user_id == user.id
        return user

    async def _fake_get_user_by_email(session, email):
        assert session is db_session
        assert email == "svc@example.com"
        return user

    async def _fake_create_user(session, user_data):
        assert session is db_session
        assert isinstance(user_data, _CreatePayload)
        return user

    async def _fake_update_user(session, user_id, user_data):
        assert session is db_session
        assert user_id == user.id
        assert isinstance(user_data, UserUpdate)
        return user

    async def _fake_delete_user(session, user_id):
        assert session is db_session
        assert user_id == user.id
        return True

    monkeypatch.setattr("src.users.service.get_user_by_id", _fake_get_user_by_id)
    monkeypatch.setattr("src.users.service.get_user_by_email", _fake_get_user_by_email)
    monkeypatch.setattr("src.users.service.create_user", _fake_create_user)
    monkeypatch.setattr("src.users.service.update_user", _fake_update_user)
    monkeypatch.setattr("src.users.service.delete_user", _fake_delete_user)

    assert await UserService.get_user(db_session, user.id) == user
    assert (
        await UserService.get_user_by_email_address(db_session, "svc@example.com")
        == user
    )
    assert (
        await UserService.create_new_user(
            db_session, _CreatePayload(email="svc-create@example.com")
        )
        == user
    )
    assert await UserService.update_user_data(
        db_session,
        user.id,
        UserUpdate(name="Updated"),
    ) == user
    assert await UserService.remove_user(db_session, user.id) is True
