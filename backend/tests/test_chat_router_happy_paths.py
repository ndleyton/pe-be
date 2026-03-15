import pytest
import pytest_asyncio
from httpx import AsyncClient
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

from PIL import Image
from src.chat.router import (
    create_new_conversation,
    get_conversations,
    update_conversation_endpoint,
)
from src.core.rate_limit import rate_limiter
from src.chat.schemas import ConversationCreate, ConversationUpdate
from src.main import app
from src.users.models import User
from src.users.router import current_active_user


pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture
async def authenticated_user(db_session):
    user = User(
        email="chat-router@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    async def _override_user():
        return user

    app.dependency_overrides[current_active_user] = _override_user
    try:
        yield user
    finally:
        app.dependency_overrides.pop(current_active_user, None)


async def test_chat_endpoint_happy_path(
    async_client: AsyncClient, authenticated_user, monkeypatch
):
    captured = {}

    class FakeChatService:
        def __init__(self, user_id, session):
            captured["user_id"] = user_id
            captured["session"] = session

        async def generate_response(self, messages, conversation_id, save_to_db):
            captured["messages"] = messages
            captured["conversation_id"] = conversation_id
            captured["save_to_db"] = save_to_db
            return {"message": "Plan updated.", "conversation_id": 321}

    monkeypatch.setattr("src.chat.router.ChatService", FakeChatService)

    response = await async_client.post(
        "/api/v1/chat",
        json={
            "messages": [{"role": "user", "content": "Summarize my last workout"}],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"message": "Plan updated.", "conversation_id": 321}
    assert captured["user_id"] == authenticated_user.id
    assert captured["conversation_id"] is None
    assert captured["save_to_db"] is True
    assert captured["messages"] == [
        {"role": "user", "content": "Summarize my last workout"}
    ]


async def test_conversation_router_happy_flow(
    async_client: AsyncClient, authenticated_user
):
    create_resp = await async_client.post(
        "/api/v1/conversations/",
        json={"title": "Progress chat"},
    )
    assert create_resp.status_code == 200, create_resp.text
    created = create_resp.json()
    conversation_id = created["id"]
    assert created["title"] == "Progress chat"
    assert created["is_active"] is True

    list_resp = await async_client.get("/api/v1/conversations?limit=20&offset=0")
    assert list_resp.status_code == 200, list_resp.text
    listed = list_resp.json()
    assert listed["total"] == 1
    assert listed["conversations"][0]["id"] == conversation_id

    get_resp = await async_client.get(f"/api/v1/conversations/{conversation_id}")
    assert get_resp.status_code == 200, get_resp.text
    assert get_resp.json()["title"] == "Progress chat"

    update_resp = await async_client.put(
        f"/api/v1/conversations/{conversation_id}",
        json={"title": "Progress chat renamed"},
    )
    assert update_resp.status_code == 200, update_resp.text
    assert update_resp.json()["title"] == "Progress chat renamed"

    delete_resp = await async_client.delete(f"/api/v1/conversations/{conversation_id}")
    assert delete_resp.status_code == 204, delete_resp.text

    # Idempotent delete behavior
    second_delete_resp = await async_client.delete(
        f"/api/v1/conversations/{conversation_id}"
    )
    assert second_delete_resp.status_code == 204, second_delete_resp.text

    list_after_delete = await async_client.get("/api/v1/conversations")
    assert list_after_delete.status_code == 200, list_after_delete.text
    after = list_after_delete.json()
    assert after["total"] == 0
    assert after["conversations"] == []


async def test_chat_attachment_upload_and_download(
    async_client: AsyncClient,
    authenticated_user,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        "src.chat.service.settings.CHAT_ATTACHMENT_STORAGE_DIR",
        str(tmp_path),
        raising=False,
    )

    buffer = BytesIO()
    Image.new("RGB", (4, 4), color="red").save(buffer, format="PNG")
    buffer.seek(0)

    upload_response = await async_client.post(
        "/api/v1/chat/attachments",
        files={"file": ("pose.png", buffer.getvalue(), "image/png")},
    )
    assert upload_response.status_code == 200, upload_response.text
    payload = upload_response.json()
    assert payload["mime_type"] == "image/png"
    assert payload["width"] == 4
    assert payload["height"] == 4

    download_response = await async_client.get(
        f"/api/v1/chat/attachments/{payload['attachment_id']}"
    )
    assert download_response.status_code == 200, download_response.text
    assert download_response.headers["content-type"] == "image/png"
    assert download_response.content


async def test_chat_attachment_upload_rejects_mime_mismatch(
    async_client: AsyncClient,
    authenticated_user,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        "src.chat.service.settings.CHAT_ATTACHMENT_STORAGE_DIR",
        str(tmp_path),
        raising=False,
    )

    buffer = BytesIO()
    Image.new("RGB", (4, 4), color="blue").save(buffer, format="PNG")
    buffer.seek(0)

    response = await async_client.post(
        "/api/v1/chat/attachments",
        files={"file": ("pose.png", buffer.getvalue(), "image/jpeg")},
    )
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "Uploaded file content does not match MIME type"


async def test_chat_endpoint_rate_limit(
    async_client: AsyncClient, authenticated_user, monkeypatch
):
    await rate_limiter.reset()
    monkeypatch.setattr(
        "src.chat.router.settings.CHAT_RATE_LIMIT_MAX_REQUESTS", 1, raising=False
    )
    monkeypatch.setattr(
        "src.chat.router.settings.CHAT_RATE_LIMIT_WINDOW_SECONDS", 60, raising=False
    )

    class FakeChatService:
        def __init__(self, user_id, session):
            self.user_id = user_id
            self.session = session

        async def generate_response(self, messages, conversation_id, save_to_db):
            return {"message": "ok", "conversation_id": 1}

    monkeypatch.setattr("src.chat.router.ChatService", FakeChatService)

    first = await async_client.post(
        "/api/v1/chat",
        json={"messages": [{"role": "user", "content": "one"}]},
    )
    second = await async_client.post(
        "/api/v1/chat",
        json={"messages": [{"role": "user", "content": "two"}]},
    )

    assert first.status_code == 200, first.text
    assert second.status_code == 429, second.text
    assert second.headers["retry-after"] == "60"

    await rate_limiter.reset()


async def test_chat_attachment_rate_limit(
    async_client: AsyncClient, authenticated_user, monkeypatch, tmp_path
):
    await rate_limiter.reset()
    monkeypatch.setattr(
        "src.chat.router.settings.CHAT_ATTACHMENT_RATE_LIMIT_MAX_REQUESTS",
        1,
        raising=False,
    )
    monkeypatch.setattr(
        "src.chat.router.settings.CHAT_ATTACHMENT_RATE_LIMIT_WINDOW_SECONDS",
        60,
        raising=False,
    )
    monkeypatch.setattr(
        "src.chat.service.settings.CHAT_ATTACHMENT_STORAGE_DIR",
        str(tmp_path),
        raising=False,
    )

    buffer = BytesIO()
    Image.new("RGB", (4, 4), color="green").save(buffer, format="PNG")
    payload = buffer.getvalue()

    first = await async_client.post(
        "/api/v1/chat/attachments",
        files={"file": ("pose.png", payload, "image/png")},
    )
    second = await async_client.post(
        "/api/v1/chat/attachments",
        files={"file": ("pose.png", payload, "image/png")},
    )

    assert first.status_code == 200, first.text
    assert second.status_code == 429, second.text
    assert second.headers["retry-after"] == "60"

    await rate_limiter.reset()


async def test_direct_router_calls_for_coverage():
    mock_session = AsyncMock()
    mock_user = MagicMock(id=1)

    # Mock crud
    mock_conv = MagicMock(id=1, title="Test", is_active=True, messages=[])

    with patch("src.chat.router.create_conversation", new_callable=AsyncMock) as mock_create, \
         patch("src.chat.router.update_conversation", new_callable=AsyncMock) as mock_update, \
         patch("src.chat.router.get_user_conversations", new_callable=AsyncMock) as mock_get, \
         patch("src.chat.router.count_user_conversations", new_callable=AsyncMock) as mock_count:

        mock_create.return_value = mock_conv
        mock_update.return_value = mock_conv
        mock_get.return_value = [mock_conv]
        mock_count.return_value = 1

        # Call create
        res1 = await create_new_conversation(ConversationCreate(title="Test"), mock_user, mock_session)
        assert res1.id == 1

        # Call update
        res2 = await update_conversation_endpoint(1, ConversationUpdate(title="Test updated"), mock_user, mock_session)
        assert res2.id == 1

        # Call get list
        res3 = await get_conversations(20, 0, mock_user, mock_session)
        assert res3.total == 1
