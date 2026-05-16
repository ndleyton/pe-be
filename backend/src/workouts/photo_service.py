import asyncio
import hashlib
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from PIL import Image, UnidentifiedImageError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.workouts.crud import (
    get_active_primary_workout_photo,
    get_workout_by_id,
    replace_primary_workout_photo,
)
from src.workouts.models import WorkoutPhoto


class WorkoutPhotoService:
    def __init__(self, *, user_id: int, session: AsyncSession) -> None:
        self.user_id = user_id
        self.session = session

    async def save_uploaded_photo(
        self,
        *,
        workout_id: int,
        filename: str,
        content_type: str,
        data: bytes,
    ) -> WorkoutPhoto:
        if not data:
            raise ValueError("Uploaded file is empty")

        if len(data) > settings.WORKOUT_PHOTO_MAX_BYTES:
            raise ValueError("Uploaded file exceeds size limit")

        workout = await get_workout_by_id(self.session, workout_id, self.user_id)
        if workout is None:
            raise LookupError("Workout not found")

        declared_mime_type = (content_type or "").split(";")[0].strip().lower()
        width, height, detected_mime_type = self._inspect_image(data)
        if detected_mime_type not in settings.WORKOUT_PHOTO_ALLOWED_MIME_TYPES:
            raise ValueError("Unsupported image type")
        if declared_mime_type and declared_mime_type != detected_mime_type:
            raise ValueError("Uploaded file content does not match MIME type")

        # Optimize image: resize and convert to WebP
        optimized_data, width, height, final_mime_type = await asyncio.to_thread(
            self._optimize_image, data
        )

        suffix = f".{settings.WORKOUT_PHOTO_OPTIMIZED_FORMAT}"
        storage_key = self._storage_key(
            workout_id=workout_id,
            suffix=suffix,
        )
        file_path = self._photo_file_path(storage_key)
        await asyncio.to_thread(self._write_photo_bytes, file_path, optimized_data)

        try:
            return await replace_primary_workout_photo(
                self.session,
                workout_id=workout_id,
                user_id=self.user_id,
                original_filename=filename or "upload",
                storage_key=storage_key,
                mime_type=final_mime_type,
                size_bytes=len(optimized_data),
                sha256=hashlib.sha256(optimized_data).hexdigest(),
                width=width,
                height=height,
            )
        except Exception:
            file_path.unlink(missing_ok=True)
            raise

    async def get_primary_photo(self, workout_id: int) -> WorkoutPhoto:
        photo = await get_active_primary_workout_photo(
            self.session,
            workout_id=workout_id,
            user_id=self.user_id,
        )
        if photo is None:
            raise LookupError("Workout photo not found")
        return photo

    def photo_file_path(self, storage_key: str) -> Path:
        return self._photo_file_path(storage_key)

    def _write_photo_bytes(self, file_path: Path, data: bytes) -> None:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)

    def _photo_storage_dir(self) -> Path:
        return Path(settings.WORKOUT_PHOTO_STORAGE_DIR).expanduser().resolve()

    def _photo_file_path(self, storage_key: str) -> Path:
        storage_dir = self._photo_storage_dir()
        file_path = (storage_dir / storage_key).resolve()
        if storage_dir not in file_path.parents:
            raise ValueError("Invalid workout photo storage key")
        return file_path

    def _storage_key(self, *, workout_id: int, suffix: str) -> str:
        return f"user-{self.user_id}/workout-{workout_id}/{uuid4().hex}{suffix.lower()}"

    def _inspect_image(self, data: bytes) -> tuple[int, int, str]:
        try:
            with Image.open(BytesIO(data)) as image:
                image.verify()
            with Image.open(BytesIO(data)) as image:
                image.load()
                mime_type = Image.MIME.get(image.format or "")
                if not mime_type:
                    raise ValueError("Unsupported image type")
                width, height = image.size
                return width, height, mime_type.lower()
        except (UnidentifiedImageError, OSError) as exc:
            raise ValueError("Uploaded file is not a valid image") from exc

    def _optimize_image(self, data: bytes) -> tuple[bytes, int, int, str]:
        try:
            with Image.open(BytesIO(data)) as img:
                # Fix orientation from EXIF
                from PIL import ImageOps

                img = ImageOps.exif_transpose(img)

                # Ensure RGB mode for WebP conversion
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                # Calculate new size maintaining aspect ratio
                width, height = img.size
                max_edge = settings.WORKOUT_PHOTO_OPTIMIZED_MAX_EDGE_PX

                if width > max_edge or height > max_edge:
                    if width > height:
                        new_width = max_edge
                        new_height = int(height * (max_edge / width))
                    else:
                        new_height = max_edge
                        new_width = int(width * (max_edge / height))
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    width, height = new_width, new_height

                # Save to buffer as WebP
                buffer = BytesIO()
                img.save(
                    buffer,
                    format=settings.WORKOUT_PHOTO_OPTIMIZED_FORMAT.upper(),
                    quality=80,
                    method=6,  # Highest compression efficiency
                )
                return (
                    buffer.getvalue(),
                    width,
                    height,
                    f"image/{settings.WORKOUT_PHOTO_OPTIMIZED_FORMAT}",
                )
        except Exception as exc:
            raise ValueError(f"Failed to optimize image: {str(exc)}") from exc

    def _suffix_for_mime_type(self, mime_type: str) -> str:
        return {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/webp": ".webp",
        }.get(mime_type, ".bin")
