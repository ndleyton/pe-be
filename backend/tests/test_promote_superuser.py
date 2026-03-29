import pytest

from src.users.models import User
from src.users.promote_superuser import (
    PromotionResult,
    promote_user_to_superuser,
    main,
)


async def _seed_user(
    db_session,
    *,
    email: str,
    is_superuser: bool = False,
) -> User:
    user = User(
        email=email,
        hashed_password="x",
        is_active=True,
        is_superuser=is_superuser,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio(loop_scope="session")
async def test_promote_user_to_superuser_updates_existing_user(db_session):
    user = await _seed_user(
        db_session,
        email="promote-me@example.com",
        is_superuser=False,
    )

    result = await promote_user_to_superuser(
        db_session,
        email=" Promote-Me@Example.com ",
    )

    assert result == PromotionResult(
        status="promoted",
        email="promote-me@example.com",
        user_id=user.id,
    )

    await db_session.refresh(user)
    assert user.is_superuser is True


@pytest.mark.asyncio(loop_scope="session")
async def test_promote_user_to_superuser_is_idempotent_for_existing_superuser(
    db_session,
):
    user = await _seed_user(
        db_session,
        email="already-admin@example.com",
        is_superuser=True,
    )

    result = await promote_user_to_superuser(
        db_session,
        email="already-admin@example.com",
    )

    assert result == PromotionResult(
        status="already_superuser",
        email="already-admin@example.com",
        user_id=user.id,
    )


@pytest.mark.asyncio(loop_scope="session")
async def test_promote_user_to_superuser_returns_not_found_for_missing_user(db_session):
    result = await promote_user_to_superuser(
        db_session,
        email="missing@example.com",
    )

    assert result == PromotionResult(
        status="not_found",
        email="missing@example.com",
        user_id=None,
    )


def test_main_returns_error_for_missing_user(monkeypatch, capsys):
    async def _fake_run(email: str) -> PromotionResult:
        assert email == "missing@example.com"
        return PromotionResult(
            status="not_found",
            email=email,
            user_id=None,
        )

    def _fake_configure_logging(log_level: str) -> None:
        assert log_level

    monkeypatch.setattr("src.users.promote_superuser.run", _fake_run)
    monkeypatch.setattr(
        "src.users.promote_superuser.configure_logging",
        _fake_configure_logging,
    )

    exit_code = main(["--email", "missing@example.com"])

    captured = capsys.readouterr()
    assert exit_code == 1
    assert captured.out.strip() == "No user found for email missing@example.com."


def test_main_prints_success_message(monkeypatch, capsys):
    async def _fake_run(email: str) -> PromotionResult:
        assert email == "admin@example.com"
        return PromotionResult(
            status="promoted",
            email=email,
            user_id=42,
        )

    def _fake_configure_logging(log_level: str) -> None:
        assert log_level

    monkeypatch.setattr("src.users.promote_superuser.run", _fake_run)
    monkeypatch.setattr(
        "src.users.promote_superuser.configure_logging",
        _fake_configure_logging,
    )

    exit_code = main(["--email", "admin@example.com"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert captured.out.strip() == "Promoted admin@example.com (id=42) to superuser."
