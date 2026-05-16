import pytest
from pydantic import ValidationError

from src.core.config import Settings


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
