from fastapi import Depends
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_async_session

# This will be set once User and OAuthAccount models are available
_User = None
_OAuthAccount = None


def set_user_models(user_model, oauth_account_model):
    """Set the user models after they are defined"""
    global _User, _OAuthAccount
    _User = user_model
    _OAuthAccount = oauth_account_model


async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    """FastAPI dependency for user database operations"""
    if _User is None or _OAuthAccount is None:
        raise RuntimeError("User models not set. Call set_user_models() first.")
    yield SQLAlchemyUserDatabase(session, _User, _OAuthAccount)
