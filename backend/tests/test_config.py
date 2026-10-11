import pytest
from pydantic import ValidationError

from src.core.config import Settings


@pytest.mark.parametrize("enabled", [None, "true"])
def test_public_media_orphan_scan_requires_opt_in(monkeypatch, enabled):
    monkeypatch.delenv("JOB_PUBLIC_MEDIA_RECONCILIATION_ENABLED", raising=False)
    if enabled is not None:
        monkeypatch.setenv("JOB_PUBLIC_MEDIA_RECONCILIATION_ENABLED", enabled)

    settings = Settings(_env_file=None)

    assert settings.JOB_PUBLIC_MEDIA_RECONCILIATION_ENABLED is (enabled == "true")


def test_workout_photo_optimized_max_edge_px_must_be_positive():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, WORKOUT_PHOTO_OPTIMIZED_MAX_EDGE_PX=0)


def test_workout_photo_optimized_max_edge_px_defaults_to_1600(monkeypatch):
    monkeypatch.delenv("WORKOUT_PHOTO_OPTIMIZED_MAX_EDGE_PX", raising=False)

    settings = Settings(_env_file=None)

    assert settings.WORKOUT_PHOTO_OPTIMIZED_MAX_EDGE_PX == 1600


def test_workout_photo_max_edge_px_must_be_positive():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, WORKOUT_PHOTO_MAX_EDGE_PX=0)


def test_workout_photo_max_pixels_must_be_positive():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, WORKOUT_PHOTO_MAX_PIXELS=0)


def test_workout_photo_optimized_format_must_be_supported():
    with pytest.raises(
        ValidationError,
        match="WORKOUT_PHOTO_OPTIMIZED_FORMAT must be one of",
    ):
        Settings(_env_file=None, WORKOUT_PHOTO_OPTIMIZED_FORMAT="bmp")


def test_workout_photo_optimized_format_normalizes_jpg_alias():
    settings = Settings(_env_file=None, WORKOUT_PHOTO_OPTIMIZED_FORMAT=" JPG ")

    assert settings.WORKOUT_PHOTO_OPTIMIZED_FORMAT == "jpeg"


def test_media_storage_backend_defaults_to_local(monkeypatch):
    monkeypatch.delenv("MEDIA_STORAGE_BACKEND", raising=False)
    monkeypatch.delenv("MEDIA_PUBLIC_BASE_URL", raising=False)
    monkeypatch.delenv("R2_PUBLIC_BUCKET", raising=False)

    settings = Settings(_env_file=None)

    assert settings.MEDIA_STORAGE_BACKEND == "local"


def test_media_storage_backend_accepts_valid_values_normalized():
    settings_local = Settings(_env_file=None, MEDIA_STORAGE_BACKEND=" LOCAL ")
    assert settings_local.MEDIA_STORAGE_BACKEND == "local"

    settings_r2 = Settings(
        _env_file=None,
        MEDIA_STORAGE_BACKEND=" R2 ",
        R2_PUBLIC_BUCKET="pe-be-public",
        R2_ENDPOINT_URL="https://r2.example.com",
        R2_ACCESS_KEY_ID="access-key",
        R2_SECRET_ACCESS_KEY="secret-key",
    )
    assert settings_r2.MEDIA_STORAGE_BACKEND == "r2"


def test_media_storage_backend_rejects_invalid_values():
    with pytest.raises(
        ValidationError,
        match="MEDIA_STORAGE_BACKEND must be one of: local, r2",
    ):
        Settings(_env_file=None, MEDIA_STORAGE_BACKEND="s3")

    with pytest.raises(
        ValidationError,
        match="MEDIA_STORAGE_BACKEND must be one of: local, r2",
    ):
        Settings(_env_file=None, MEDIA_STORAGE_BACKEND="r-2")


def test_media_storage_backend_r2_requires_r2_public_bucket():
    with pytest.raises(
        ValidationError,
        match="MEDIA_STORAGE_BACKEND='r2' requires R2_PUBLIC_BUCKET to be set",
    ):
        Settings(
            _env_file=None,
            MEDIA_STORAGE_BACKEND="r2",
            R2_PUBLIC_BUCKET="",
        )


def test_media_public_base_url_requires_r2_backend_and_public_bucket():
    with pytest.raises(
        ValidationError,
        match="MEDIA_PUBLIC_BASE_URL requires MEDIA_STORAGE_BACKEND='r2' and R2_PUBLIC_BUCKET",
    ):
        Settings(
            _env_file=None,
            MEDIA_STORAGE_BACKEND="local",
            MEDIA_PUBLIC_BASE_URL="https://media.example.com",
        )


def test_media_storage_backend_r2_with_valid_configuration():
    settings = Settings(
        _env_file=None,
        MEDIA_STORAGE_BACKEND="r2",
        R2_PUBLIC_BUCKET="pe-be-public",
        R2_ENDPOINT_URL="https://r2.example.com",
        R2_ACCESS_KEY_ID="access-key",
        R2_SECRET_ACCESS_KEY="secret-key",
        MEDIA_PUBLIC_BASE_URL="https://media.example.com",
        MEDIA_PURGE_BASE_URL="https://media.example.com",
        CLOUDFLARE_ZONE_ID="zone",
        CLOUDFLARE_CACHE_PURGE_TOKEN="token",
    )
    assert settings.MEDIA_STORAGE_BACKEND == "r2"
    assert settings.R2_PUBLIC_BUCKET == "pe-be-public"
    assert settings.MEDIA_PUBLIC_BASE_URL == "https://media.example.com"


def test_media_public_base_url_requires_purge_base_url():
    with pytest.raises(
        ValidationError,
        match="MEDIA_PUBLIC_BASE_URL requires MEDIA_PURGE_BASE_URL",
    ):
        Settings(
            _env_file=None,
            MEDIA_STORAGE_BACKEND="r2",
            R2_PUBLIC_BUCKET="pe-be-public",
            R2_ENDPOINT_URL="https://r2.example.com",
            R2_ACCESS_KEY_ID="access-key",
            R2_SECRET_ACCESS_KEY="secret-key",
            MEDIA_PUBLIC_BASE_URL="https://media.example.com",
        )


@pytest.mark.parametrize("public_url", ["", "https://media.example.com"])
@pytest.mark.parametrize(
    "missing", ["CLOUDFLARE_ZONE_ID", "CLOUDFLARE_CACHE_PURGE_TOKEN"]
)
@pytest.mark.parametrize("empty", ["", "   "])
def test_media_cdn_urls_require_purge_credentials(public_url, missing, empty):
    values = {
        "MEDIA_STORAGE_BACKEND": "r2",
        "R2_PUBLIC_BUCKET": "pe-be-public",
        "R2_ENDPOINT_URL": "https://r2.example.com",
        "R2_ACCESS_KEY_ID": "access-key",
        "R2_SECRET_ACCESS_KEY": "secret-key",
        "MEDIA_PUBLIC_BASE_URL": public_url,
        "MEDIA_PURGE_BASE_URL": "https://media.example.com",
        "CLOUDFLARE_ZONE_ID": "zone",
        "CLOUDFLARE_CACHE_PURGE_TOKEN": "token",
    }
    values[missing] = empty
    with pytest.raises(
        ValidationError, match=f"Configured media CDN URLs require {missing}"
    ):
        Settings(_env_file=None, **values)


def test_media_rollback_with_purge_credentials_is_valid():
    settings = Settings(
        _env_file=None,
        MEDIA_STORAGE_BACKEND="r2",
        R2_PUBLIC_BUCKET="pe-be-public",
        R2_ENDPOINT_URL="https://r2.example.com",
        R2_ACCESS_KEY_ID="access-key",
        R2_SECRET_ACCESS_KEY="secret-key",
        MEDIA_PUBLIC_BASE_URL="",
        MEDIA_PURGE_BASE_URL="https://media.example.com",
        CLOUDFLARE_ZONE_ID="zone",
        CLOUDFLARE_CACHE_PURGE_TOKEN="token",
    )
    assert settings.MEDIA_PUBLIC_BASE_URL == ""
    assert settings.MEDIA_PURGE_BASE_URL == "https://media.example.com"


@pytest.mark.parametrize(
    "missing", ["R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
)
@pytest.mark.parametrize("empty", ["", "   "])
def test_r2_requires_connection_settings_at_startup(missing, empty):
    values = {
        "MEDIA_STORAGE_BACKEND": "r2",
        "R2_PUBLIC_BUCKET": "pe-be-public",
        "R2_ENDPOINT_URL": "https://r2.example.com",
        "R2_ACCESS_KEY_ID": "access-key",
        "R2_SECRET_ACCESS_KEY": "secret-key",
    }
    values[missing] = empty
    with pytest.raises(ValidationError, match=f"requires {missing} to be set"):
        Settings(_env_file=None, **values)
