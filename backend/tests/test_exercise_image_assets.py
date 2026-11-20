import pytest

from src.core.config import settings
from src.exercises.image_assets import (
    is_private_exercise_image_url,
    parse_public_image_url_list,
)

APP_HOST = "app.example.com"


@pytest.fixture(autouse=True)
def app_host(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_URL", f"https://{APP_HOST}")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", f"https://{APP_HOST}/cb")


@pytest.mark.parametrize(
    "image_url",
    [
        "generated/a.png",
        "uploads/exercise-type-candidates/ref.png",
        "/api/v1/exercises/assets/generated/a.png",
        f"https://{APP_HOST}/api/v1/exercises/assets/generated/a.png",
        f"https://{APP_HOST}/api/v1/exercises/assets/uploads/x.png",
        f"//{APP_HOST}/api/v1/exercises/assets/uploads/x.png",
    ],
)
def test_private_asset_urls_are_private(image_url):
    assert is_private_exercise_image_url(image_url)


@pytest.mark.parametrize(
    "image_url",
    [
        "published/a.png",
        f"https://{APP_HOST}/api/v1/exercises/assets/published/a.png",
        "https://cdn.other.com/api/v1/exercises/assets/uploads/x.png",
        "https://cdn.other.com/uploads/x.png",
        "https://cdn.other.com/a.png",
    ],
)
def test_public_and_external_urls_are_kept(image_url):
    assert not is_private_exercise_image_url(image_url)


def test_public_list_drops_only_private_absolute_urls():
    raw = [
        f"https://{APP_HOST}/api/v1/exercises/assets/uploads/x.png",
        f"https://{APP_HOST}/api/v1/exercises/assets/published/p.png",
        "https://cdn.other.com/a.png",
    ]
    assert parse_public_image_url_list(raw) == raw[1:]
