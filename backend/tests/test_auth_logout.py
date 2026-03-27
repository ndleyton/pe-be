import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_logout_clears_cookie_without_authenticated_session(
    async_client: AsyncClient,
):
    response = await async_client.post("/api/v1/auth/logout")

    assert response.status_code == 204
    set_cookie = response.headers["set-cookie"]
    assert "personalbestie_session=" in set_cookie
    assert "Max-Age=0" in set_cookie
    assert "expires=" in set_cookie.lower()
