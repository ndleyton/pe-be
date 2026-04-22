from typing import Any

from fastapi import Depends
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from src.core.database import get_async_session
from src.core.observability import traced_span

# This will be set once User and OAuthAccount models are available
_User = None
_OAuthAccount = None


class AppSQLAlchemyUserDatabase(SQLAlchemyUserDatabase):
    """Trim auth lookups to user columns unless OAuth rows are explicitly needed."""

    def _base_user_statement(self):
        statement = select(self.user_table)
        if self.oauth_account_table is not None and hasattr(
            self.user_table, "oauth_accounts"
        ):
            statement = statement.options(noload(self.user_table.oauth_accounts))
        return statement

    async def get(self, id):
        with traced_span("auth.user.lookup_by_id"):
            statement = self._base_user_statement().where(self.user_table.id == id)
            return await self._get_user(statement)

    async def get_by_email(self, email: str):
        email_domain = email.split("@", 1)[1] if "@" in email else None
        with traced_span(
            "auth.oauth.lookup_email",
            attributes={"auth.oauth.email_domain": email_domain},
        ):
            statement = self._base_user_statement().where(
                func.lower(self.user_table.email) == func.lower(email)
            )
            return await self._get_user(statement)

    async def get_by_oauth_account(self, oauth: str, account_id: str):
        if self.oauth_account_table is None:
            raise NotImplementedError()

        with traced_span(
            "auth.oauth.lookup_account",
            attributes={"auth.oauth.provider": oauth},
        ):
            statement = (
                self._base_user_statement()
                .join(self.oauth_account_table)
                .where(self.oauth_account_table.oauth_name == oauth)
                .where(self.oauth_account_table.account_id == account_id)
            )
            return await self._get_user(statement)

    async def create(self, create_dict: dict[str, Any]):
        with traced_span(
            "auth.user.create",
            attributes={
                "auth.oauth.email_domain": (
                    create_dict["email"].split("@", 1)[1]
                    if "email" in create_dict and "@" in create_dict["email"]
                    else None
                ),
            },
        ):
            user = self.user_table(**create_dict)
            self.session.add(user)
            await self.session.commit()
            await self.session.refresh(user)
            return user

    async def add_oauth_account(self, user, create_dict: dict[str, Any]):
        if self.oauth_account_table is None:
            raise NotImplementedError()

        with traced_span(
            "auth.oauth.link_account",
            attributes={"auth.oauth.provider": create_dict.get("oauth_name")},
        ):
            oauth_account = self.oauth_account_table(user_id=user.id, **create_dict)
            self.session.add(oauth_account)
            await self.session.commit()
            return user

    async def update_oauth_account(
        self,
        user,
        oauth_account,
        update_dict: dict[str, Any],
    ):
        with traced_span(
            "auth.oauth.update_account",
            attributes={"auth.oauth.provider": update_dict.get("oauth_name")},
        ):
            for key, value in update_dict.items():
                setattr(oauth_account, key, value)
            self.session.add(oauth_account)
            await self.session.commit()
            return user


def set_user_models(user_model, oauth_account_model):
    """Set the user models after they are defined"""
    global _User, _OAuthAccount
    _User = user_model
    _OAuthAccount = oauth_account_model


async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    """FastAPI dependency for user database operations"""
    if _User is None or _OAuthAccount is None:
        raise RuntimeError("User models not set. Call set_user_models() first.")
    yield AppSQLAlchemyUserDatabase(session, _User, _OAuthAccount)
