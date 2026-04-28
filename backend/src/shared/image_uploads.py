from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError


@dataclass(frozen=True)
class SanitizedImageUpload:
    data: bytes
    mime_type: str
    extension: str
    width: int
    height: int


class ImageUploadValidationError(ValueError):
    pass


def sanitize_image_upload(
    data: bytes,
    *,
    declared_mime_type: str = "",
    allowed_mime_types: tuple[str, ...],
    max_bytes: int,
    max_pixels: int,
    max_edge_px: int = 4096,
) -> SanitizedImageUpload:
    if not data:
        raise ImageUploadValidationError("Uploaded file is empty")
    if len(data) > max_bytes:
        raise ImageUploadValidationError("Uploaded file exceeds size limit")

    declared_mime_type = (declared_mime_type or "").split(";")[0].strip().lower()
    try:
        with Image.open(BytesIO(data)) as image:
            detected_mime_type = (Image.MIME.get(image.format or "") or "").lower()
            if not detected_mime_type:
                raise ImageUploadValidationError("Unsupported image type")
            if detected_mime_type not in allowed_mime_types:
                raise ImageUploadValidationError("Unsupported image type")
            if declared_mime_type and declared_mime_type != detected_mime_type:
                raise ImageUploadValidationError(
                    "Uploaded file content does not match MIME type"
                )

            image.load()
            normalized = ImageOps.exif_transpose(image)
            width, height = normalized.size
            if width <= 0 or height <= 0:
                raise ImageUploadValidationError("Uploaded file is not a valid image")
            if width > max_edge_px or height > max_edge_px:
                raise ImageUploadValidationError(
                    "Uploaded image dimensions are too large"
                )
            if width * height > max_pixels:
                raise ImageUploadValidationError("Uploaded image has too many pixels")

            output = BytesIO()
            save_format = _save_format_for_mime_type(detected_mime_type)
            image_to_save = _prepare_image_for_format(normalized, detected_mime_type)
            save_kwargs = {"format": save_format}
            if detected_mime_type == "image/jpeg":
                save_kwargs.update({"quality": 95, "optimize": True})
            if detected_mime_type == "image/webp":
                save_kwargs.update({"quality": 95, "method": 6})
            image_to_save.save(output, **save_kwargs)

            return SanitizedImageUpload(
                data=output.getvalue(),
                mime_type=detected_mime_type,
                extension=_extension_for_mime_type(detected_mime_type),
                width=width,
                height=height,
            )
    except UnidentifiedImageError as exc:
        raise ImageUploadValidationError("Uploaded file is not a valid image") from exc


def _save_format_for_mime_type(mime_type: str) -> str:
    return {
        "image/png": "PNG",
        "image/jpeg": "JPEG",
        "image/webp": "WEBP",
    }[mime_type]


def _extension_for_mime_type(mime_type: str) -> str:
    return {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
    }[mime_type]


def _prepare_image_for_format(image: Image.Image, mime_type: str) -> Image.Image:
    if mime_type == "image/jpeg" and image.mode not in ("RGB", "L"):
        return image.convert("RGB")
    return image.copy()
