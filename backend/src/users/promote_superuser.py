from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from typing import Literal, Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import async_session_maker
from src.core.logging import configure_logging
from src.core.config import settings
from src.users.models import User


PromotionStatus = Literal["promoted", "already_superuser", "not_found"]


@dataclass(frozen=True)
class PromotionResult:
    status: PromotionStatus
    email: str
    user_id: int | None


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not normalized:
        raise ValueError("email must not be empty")
    return normalized


def _load_model_registry() -> None:
    # Standalone CLIs do not import the FastAPI app, so load model modules
    # explicitly before the first ORM query to resolve string relationships.
    import src.chat.models  # noqa: F401
    import src.exercise_sets.models  # noqa: F401
    import src.exercises.models  # noqa: F401
    import src.routines.models  # noqa: F401
    import src.users.models  # noqa: F401
    import src.workouts.models  # noqa: F401


async def promote_user_to_superuser(
    session: AsyncSession, *, email: str
) -> PromotionResult:
    normalized_email = _normalize_email(email)
    result = await session.execute(
        select(User).where(func.lower(User.email) == normalized_email)
    )
    user = result.unique().scalar_one_or_none()

    if user is None:
        return PromotionResult(
            status="not_found",
            email=normalized_email,
            user_id=None,
        )

    if user.is_superuser:
        return PromotionResult(
            status="already_superuser",
            email=user.email,
            user_id=user.id,
        )

    user.is_superuser = True
    await session.commit()
    await session.refresh(user)
    return PromotionResult(
        status="promoted",
        email=user.email,
        user_id=user.id,
    )


async def run(email: str) -> PromotionResult:
    _load_model_registry()
    async with async_session_maker() as session:
        return await promote_user_to_superuser(session, email=email)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Promote an existing user account to superuser."
    )
    parser.add_argument(
        "--email",
        required=True,
        help="Exact email address for the existing user account.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    configure_logging(settings.LOG_LEVEL)
    result = asyncio.run(run(args.email))

    if result.status == "not_found":
        print(f"No user found for email {result.email}.")
        return 1

    if result.status == "already_superuser":
        print(f"User {result.email} (id={result.user_id}) is already a superuser.")
        return 0

    print(f"Promoted {result.email} (id={result.user_id}) to superuser.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
