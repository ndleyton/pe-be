from io import BytesIO

import pytest
from PIL import Image, UnidentifiedImageError

from src.shared.image_uploads import ImageUploadValidationError, sanitize_image_upload


def _png_bytes(size: tuple[int, int] = (8, 8)) -> bytes:
    output = BytesIO()
    Image.new("RGB", size, color="red").save(output, format="PNG")
    return output.getvalue()


def test_sanitize_image_upload_rejects_large_dimensions_before_decode(monkeypatch):
    image_bytes = _png_bytes(size=(12, 8))

    def fail_load(self):
        raise AssertionError("image.load should not run for oversized images")

    monkeypatch.setattr(Image.Image, "load", fail_load)

    with pytest.raises(
        ImageUploadValidationError,
        match="Uploaded image dimensions are too large",
    ):
        sanitize_image_upload(
            image_bytes,
            declared_mime_type="image/png",
            allowed_mime_types=("image/png",),
            max_bytes=1024 * 1024,
            max_pixels=1024 * 1024,
            max_edge_px=10,
        )


def test_sanitize_image_upload_wraps_pil_decode_errors(monkeypatch):
    image_bytes = _png_bytes()

    def fail_load(self):
        raise OSError("decode failed")

    monkeypatch.setattr(Image.Image, "load", fail_load)

    with pytest.raises(
        ImageUploadValidationError,
        match="Uploaded file is not a valid image",
    ):
        sanitize_image_upload(
            image_bytes,
            declared_mime_type="image/png",
            allowed_mime_types=("image/png",),
            max_bytes=1024 * 1024,
            max_pixels=1024 * 1024,
        )


def test_sanitize_image_upload_wraps_unidentified_images():
    with pytest.raises(ImageUploadValidationError) as exc_info:
        sanitize_image_upload(
            b"not an image",
            declared_mime_type="image/png",
            allowed_mime_types=("image/png",),
            max_bytes=1024 * 1024,
            max_pixels=1024 * 1024,
        )

    assert isinstance(exc_info.value.__cause__, UnidentifiedImageError)
