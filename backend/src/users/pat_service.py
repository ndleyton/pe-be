from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.users.models import User
from src.users.pat_models import PersonalAccessToken
from src.users.pat_schemas import (
    PATPrincipal,
    PersonalAccessTokenCreate,
    PersonalAccessTokenCreated,
    PersonalAccessTokenSummary,
)


class PATAuthenticationError(ValueError):
    pass


class PATNotFoundError(LookupError):
    pass


def _token_hash(token: str) -> str:
    return hmac.new(
        settings.MCP_PAT_PEPPER.encode(), token.encode(), hashlib.sha256
    ).hexdigest()


def _parse_token(token: str) -> tuple[str, str]:
    parts = token.split("_", 3)
    if len(parts) != 4 or parts[0:2] != ["pebe", "pat"]:
        raise PATAuthenticationError("Invalid personal access token")
    prefix, secret = parts[2], parts[3]
    if len(prefix) != 12 or len(secret) < 32:
        raise PATAuthenticationError("Invalid personal access token")
    return prefix, secret


def _summary(record: PersonalAccessToken) -> PersonalAccessTokenSummary:
    return PersonalAccessTokenSummary.model_validate(record, from_attributes=True)


async def create_personal_access_token(
    session: AsyncSession,
    user_id: int,
    payload: PersonalAccessTokenCreate,
) -> PersonalAccessTokenCreated:
    expiry_days = payload.expires_in_days or settings.MCP_PAT_DEFAULT_EXPIRY_DAYS
    if expiry_days > settings.MCP_PAT_MAX_EXPIRY_DAYS:
        raise ValueError(
            f"expires_in_days cannot exceed {settings.MCP_PAT_MAX_EXPIRY_DAYS}"
        )

    prefix = secrets.token_hex(6)
    secret = secrets.token_urlsafe(32)
    plaintext = f"pebe_pat_{prefix}_{secret}"
    record = PersonalAccessToken(
        user_id=user_id,
        name=payload.name,
        token_prefix=prefix,
        token_hash=_token_hash(plaintext),
        scopes=list(payload.scopes),
        expires_at=datetime.now(timezone.utc) + timedelta(days=expiry_days),
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return PersonalAccessTokenCreated(**_summary(record).model_dump(), token=plaintext)


async def list_personal_access_tokens(
    session: AsyncSession, user_id: int
) -> list[PersonalAccessTokenSummary]:
    result = await session.execute(
        select(PersonalAccessToken)
        .where(PersonalAccessToken.user_id == user_id)
        .order_by(PersonalAccessToken.created_at.desc())
    )
    return [_summary(record) for record in result.scalars().all()]


async def revoke_personal_access_token(
    session: AsyncSession, user_id: int, token_id: int
) -> None:
    result = await session.execute(
        select(PersonalAccessToken).where(
            PersonalAccessToken.id == token_id,
            PersonalAccessToken.user_id == user_id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise PATNotFoundError("Personal access token not found")
    if record.revoked_at is None:
        record.revoked_at = datetime.now(timezone.utc)
        await session.commit()


async def verify_personal_access_token(
    session: AsyncSession, token: str
) -> PATPrincipal:
    prefix, _secret = _parse_token(token)
    result = await session.execute(
        select(PersonalAccessToken, User)
        .join(User, User.id == PersonalAccessToken.user_id)
        .where(PersonalAccessToken.token_prefix == prefix)
    )
    now = datetime.now(timezone.utc)
    matched: tuple[PersonalAccessToken, User] | None = None
    for record, user in result.unique().all():
        if hmac.compare_digest(record.token_hash, _token_hash(token)):
            matched = (record, user)
            break

    if matched is None:
        raise PATAuthenticationError("Invalid personal access token")
    record, user = matched
    if record.revoked_at is not None or record.expires_at <= now or not user.is_active:
        raise PATAuthenticationError("Invalid personal access token")

    update_interval = timedelta(
        minutes=settings.MCP_PAT_LAST_USED_UPDATE_INTERVAL_MINUTES
    )
    if record.last_used_at is None or record.last_used_at <= now - update_interval:
        record.last_used_at = now
        await session.commit()

    return PATPrincipal(
        user_id=user.id,
        credential_id=record.id,
        scopes=frozenset(record.scopes),
    )
