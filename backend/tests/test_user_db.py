import pytest

from src.core.dependencies import AppSQLAlchemyUserDatabase
from src.users.models import OAuthAccount, User


class _CaptureUserDatabase(AppSQLAlchemyUserDatabase):
    def __init__(self):
        super().__init__(session=None, user_table=User, oauth_account_table=OAuthAccount)
        self.statement = None

    async def _get_user(self, statement):
        self.statement = statement
        return None


@pytest.mark.asyncio
async def test_app_user_db_get_avoids_joining_oauth_accounts():
    user_db = _CaptureUserDatabase()

    await user_db.get(123)

    compiled = str(user_db.statement.compile(compile_kwargs={"literal_binds": True}))
    assert "oauth_accounts" not in compiled


def test_oauth_account_user_id_column_is_indexed():
    assert OAuthAccount.__table__.c.user_id.index is True
