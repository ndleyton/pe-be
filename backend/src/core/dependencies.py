from fastapi import Depends
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from src.core.database import get_async_session

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
        statement = self._base_user_statement().where(self.user_table.id == id)
        return await self._get_user(statement)


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
