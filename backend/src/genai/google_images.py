from __future__ import annotations

import asyncio
import base64
import hashlib
import logging
from dataclasses import dataclass
from io import BytesIO
from typing import Dict, List
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from google import genai
from google.genai import types
from PIL import Image, ImageSequence, UnidentifiedImageError

from src.core.config import settings
from src.exercises.image_assets import (
    resolve_exercise_image_url,
    storage_path_for_relative_url,
)

DEFAULT_MIME = "image/png"
REFERENCE_PIPELINE_KEY = "reference_redraw_v1"
REFERENCE_PROMPT_VERSION = "v3"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReferenceOptionSpec:
    key: str
    label: str
    description: str
    reference_directive: str
    style_directive: str


REFERENCE_OPTION_SPECS: tuple[ReferenceOptionSpec, ...] = (
    ReferenceOptionSpec(
        key="clean-outline",
        label="Clean Outline",
        description="High-contrast line art with clearer limb and equipment definition.",
        reference_directive=(
            "Use the uploaded reference image as the source of truth for body position "
            "and framing. Preserve the exact exercise pose, silhouette orientation, and "
            "equipment relationship."
        ),
        style_directive=(
            "Redraw the reference as a crisp instructional fitness illustration. "
            "Keep the same pose, camera angle, cropping, and equipment placement. "
            "Use strong outlines, clean edges, a plain light background, and no text."
        ),
    ),
    ReferenceOptionSpec(
        key="anatomy-focus",
        label="Muscle Highlight",
        description="Everkinetic-style muscle highlight on charcoal with simplified equipment.",
        reference_directive=(
            "Use the uploaded reference image as the source of truth for body position "
            "and framing. Preserve the exact exercise pose, silhouette orientation, and "
            "equipment relationship."
        ),
        style_directive=(
            "Recreate the reference as a clean functional exercise diagram with the visual "
            "clarity of Everkinetic. Use a flat deep charcoal background and strip away "
            "unnecessary equipment or scene detail. Render the body in a uniform light "
            "achromatic shade. Highlight the targeted active muscles named in the prompt in "
            "the exact color rgb(255, 51, 102). Reduce equipment to essential outlines or "
            "simple filled shapes in an achromatic tone that clearly contrasts with both the "
            "body and the background. Do not add labels or text."
        ),
    ),
    ReferenceOptionSpec(
        key="minimal-outline",
        label="Minimal Outline",
        description="Centered charcoal composition with minimal outlines and preserved equipment.",
        reference_directive=(
            "Use the uploaded reference image as the source of truth for the exercise phase, "
            "body mechanics, and equipment relationship. You may refine the crop and viewing "
            "angle slightly to better center the exercise and improve clarity, but keep the "
            "movement meaningfully identical to the reference."
        ),
        style_directive=(
            "Redraw the exercise as a minimal outline illustration on a flat deep charcoal "
            "background. Center the athlete and choose the clearest readable angle for the "
            "movement while keeping the same equipment and exercise setup. Render the body in "
            "a light achromatic tone with clean simple outlines and minimal detail. Reduce "
            "equipment to essential outline shapes that remain easy to distinguish from the "
            "body and background. Do not add labels or text."
        ),
    ),
)


@dataclass
class ExerciseImageResult:
    model: str
    mime_type: str
    base64_data: str
    prompt_summary: str


@dataclass
class ReferenceImagePrepared:
    mime_type: str
    image_bytes: bytes


def _build_identity_block(context: Dict) -> str:
    """Shared visual identity spec to anchor both phase images."""
    name = context.get("name", "Exercise")
    equipment = (context.get("equipment") or "").strip()
    instructions = (context.get("instructions") or "").strip()
    category = (context.get("category") or "").strip()
    primary: List[str] = context.get("primary_muscles") or []
    secondary: List[str] = context.get("secondary_muscles") or []

    muscles_line = (
        "Primary: " + ", ".join(primary) if primary else "Primary: (unspecified)"
    )
    if secondary:
        muscles_line += "; Secondary: " + ", ".join(secondary)

    equipment_line = equipment or "Bodyweight only"
    category_line = category or "General"
    instructions_line = instructions or "No detailed instructions provided."

    return (
        f"Exercise: {name}.\n"
        f"Category: {category_line}.\n"
        f"Equipment: {equipment_line}.\n"
        f"Muscles: {muscles_line}.\n"
        f"Instructions: {instructions_line}\n"
    )


def _build_prompt(context: Dict, phase_label: str) -> str:
    name = context.get("name", "Exercise")
    description = (context.get("description") or "").strip()

    identity = _build_identity_block(context)

    style = (
        "Style: Instructional fitness illustration. "
        "Use a gender-neutral athletic silhouette with medium build. "
        "Flat neutral background. Strong black outlines, minimal shading. "
        "Show the correct equipment for this specific exercise "
        "with accurate grip positions, pad placements, and points of contact. "
        "Camera angle: 3/4 front view, slightly above eye level. "
        "Frame the full body to show posture and joint alignment clearly."
    )

    phase_directive = (
        f"Phase: {phase_label}.\n"
        f"Render the {name} at the {phase_label} position. "
        f"Show correct joint angles and body positioning for this specific phase."
    )

    description_line = f"Description: {description}\n" if description else ""

    return (
        f"{identity}\n"
        f"{description_line}"
        f"{style}\n\n"
        f"{phase_directive}\n"
        "Do not add text, labels, captions, or watermarks beyond SynthID. "
        "Output only one image."
    )


def _build_anchor_prompt(
    context: Dict,
    source_phase_label: str,
    target_phase_label: str,
    *,
    retry_emphasis: bool = False,
) -> str:
    """Prompt for generating the second phase image using the first as reference."""
    name = context.get("name", "Exercise")

    identity = _build_identity_block(context)

    retry_block = ""
    if retry_emphasis:
        retry_block = (
            "\nPrevious attempt stayed too close to the reference pose. "
            "Push the pose change farther so the result reads as a distinct second keyframe."
        )

    return (
        f"{identity}\n"
        "Use the attached image as the visual reference. "
        "Treat it as the source of truth for person identity, body type, clothing, "
        "equipment, art style, line weight, colour palette, camera angle, and framing. "
        f"The attached image shows the {source_phase_label} phase. "
        f"Do NOT reproduce the {source_phase_label} pose from the reference. "
        f"Instead, render the {target_phase_label} phase as a distinctly different moment in the movement.\n\n"
        f"Target phase: {target_phase_label}.\n"
        f"Render the {name} at the {target_phase_label} position. "
        "Show clearly different joint angles, limb placement, and body/equipment displacement "
        "from the reference while keeping the same exercise setup. "
        "If the output looks like the same pose as the reference, it is incorrect. "
        "The equipment and grip/contact points must remain identical to the reference."
        f"{retry_block}\n"
        "Do not add text, labels, captions, or watermarks beyond SynthID. "
        "Output only one image."
    )


def _build_reference_prompt(context: Dict, option: ReferenceOptionSpec) -> str:
    name = context.get("name", "Exercise")
    instructions = (context.get("instructions") or "").strip()
    equipment = (context.get("equipment") or "").strip()
    category = (context.get("category") or "").strip()
    primary: List[str] = context.get("primary_muscles") or []
    secondary: List[str] = context.get("secondary_muscles") or []

    muscles_line = (
        "Primary: " + ", ".join(primary) if primary else "Primary: (unspecified)"
    )
    if secondary:
        muscles_line += "; Secondary: " + ", ".join(secondary)

    equipment_line = equipment or "Unspecified"
    category_line = category or "Unspecified"
    instructions_line = instructions or "No detailed instructions provided."

    return (
        f"Exercise: {name}.\n"
        f"Category: {category_line}.\n"
        f"Equipment: {equipment_line}.\n"
        f"Muscles: {muscles_line}.\n"
        f"Instructions: {instructions_line}\n\n"
        f"{option.reference_directive}\n"
        f"{option.style_directive}\n"
        "Make the result clearer than the reference for a workout library thumbnail and detail view. "
        "No captions, no watermarks beyond SynthID, no logos, no extra people, and no decorative background. "
        "Output only one image."
    )


_CLIENT: genai.Client | None = None


def _get_client() -> genai.Client:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = genai.Client(api_key=settings.GOOGLE_AI_KEY)
    return _CLIENT


def _inline_data_to_base64(data: bytes | str) -> str:
    if isinstance(data, bytes):
        return base64.b64encode(data).decode("ascii")
    return data


def _inline_data_to_bytes(data: bytes | str) -> bytes:
    if isinstance(data, bytes):
        return data
    return base64.b64decode(data)


def _normalized_image_fingerprint(data: bytes | str) -> str:
    """Return a metadata-insensitive fingerprint for visual comparison."""
    raw_bytes = _inline_data_to_bytes(data)
    try:
        with Image.open(BytesIO(raw_bytes)) as image:
            if getattr(image, "is_animated", False):
                frame = next(ImageSequence.Iterator(image)).copy()
            else:
                frame = image.copy()

        if frame.mode != "RGBA":
            frame = frame.convert("RGBA")

        pixel_hash = hashlib.sha256(frame.tobytes()).hexdigest()
        return f"{frame.width}x{frame.height}:{pixel_hash}"
    except UnidentifiedImageError:
        return f"raw:{hashlib.sha256(raw_bytes).hexdigest()}"


def _stable_seed(*parts: str) -> int:
    payload = "\u241f".join(str(part) for part in parts).encode("utf-8")
    return int.from_bytes(hashlib.sha256(payload).digest()[:4], "big") or 1


def _extract_inline_result(
    response, prompt: str, model_name: str
) -> ExerciseImageResult:
    try:
        candidate = response.candidates[0]
        if not getattr(candidate, "content", None):
            reason = getattr(candidate, "finish_reason", "UNKNOWN")
            raise ValueError(f"Model did not return content. Finish reason: {reason}")

        inline = next(
            (
                part.inline_data
                for part in candidate.content.parts
                if getattr(part, "inline_data", None)
            ),
            None,
        )
    except Exception as exc:
        if isinstance(exc, ValueError):
            raise
        raise ValueError(f"Unexpected response structure from model: {exc}") from exc

    if not inline or not getattr(inline, "data", None):
        raise ValueError("Model did not return image data")

    base64_data = _inline_data_to_base64(inline.data)
    return ExerciseImageResult(
        model=model_name,
        mime_type=getattr(inline, "mime_type", DEFAULT_MIME) or DEFAULT_MIME,
        base64_data=base64_data,
        prompt_summary=prompt[:200],
    )


async def _generate_image_async(prompt: str) -> ExerciseImageResult:
    client = _get_client()
    model_name = settings.EXERCISE_IMAGE_PHASE_MODEL
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    seed=_stable_seed(model_name, prompt),
                ),
            )
            return _extract_inline_result(response, prompt, model_name)
        except Exception as exc:
            # Check for rate limit (429)
            is_retryable = False
            if hasattr(exc, "code") and exc.code == 429:
                is_retryable = True
            elif "429" in str(exc) or "resourceexhausted" in str(exc).lower():
                is_retryable = True

            if is_retryable and attempt < max_retries - 1:
                wait_time = 15 * (attempt + 1)
                logger.warning(
                    "Gemini API rate limit hit, retrying in %ds... (attempt %d/%d)",
                    wait_time,
                    attempt + 1,
                    max_retries,
                )
                await asyncio.sleep(wait_time)
                continue
            raise

    raise RuntimeError("Gemini image generation retry loop exhausted")


def _open_reference_image(source_image_url: str) -> bytes:
    # 1. Resolve the URL into an absolute path using your CDN prefix
    resolved_url = resolve_exercise_image_url(source_image_url)
    parsed = urlparse(resolved_url)

    # 2. Check if the newly resolved URL is a remote HTTP address
    if parsed.scheme in {"http", "https"}:
        request = Request(
            resolved_url,
            headers={"User-Agent": "PersonalBestie/1.0 exercise-image-pipeline"},
        )
        with urlopen(
            request, timeout=settings.EXERCISE_IMAGE_REFERENCE_TIMEOUT_SECONDS
        ) as response:
            return response.read()

    # 3. Fallback: read directly from the Docker volume disk if it's local
    return storage_path_for_relative_url(source_image_url).read_bytes()


def _normalize_reference_image(source_image_url: str) -> ReferenceImagePrepared:
    raw_bytes = _open_reference_image(source_image_url)

    with Image.open(BytesIO(raw_bytes)) as image:
        if getattr(image, "is_animated", False):
            first_frame = next(ImageSequence.Iterator(image)).copy()
        else:
            first_frame = image.copy()

    if first_frame.mode not in {"RGB", "RGBA"}:
        first_frame = first_frame.convert("RGBA")

    output = BytesIO()
    first_frame.save(output, format="PNG")
    return ReferenceImagePrepared(mime_type="image/png", image_bytes=output.getvalue())


async def _generate_reference_image_async(
    *,
    context: Dict,
    option: ReferenceOptionSpec,
    prepared: ReferenceImagePrepared,
) -> ExerciseImageResult:
    client = _get_client()
    prompt = _build_reference_prompt(context, option)
    model_name = settings.EXERCISE_IMAGE_REFERENCE_MODEL

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(
                        data=prepared.image_bytes,
                        mime_type=prepared.mime_type,
                    ),
                ],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    seed=_stable_seed(model_name, prompt, option.key),
                ),
            )
            return _extract_inline_result(
                response,
                prompt,
                model_name,
            )
        except Exception as exc:
            is_retryable = False
            if hasattr(exc, "code") and exc.code == 429:
                is_retryable = True
            elif "429" in str(exc) or "resourceexhausted" in str(exc).lower():
                is_retryable = True

            if is_retryable and attempt < max_retries - 1:
                wait_time = 15 * (attempt + 1)
                logger.warning(
                    "Gemini API rate limit hit, retrying in %ds... (attempt %d/%d)",
                    wait_time,
                    attempt + 1,
                    max_retries,
                )
                await asyncio.sleep(wait_time)
                continue
            raise

    raise RuntimeError("Gemini reference image generation retry loop exhausted")


async def _generate_anchored_image_async(
    *,
    anchor_image_bytes: bytes,
    anchor_mime_type: str,
    prompt: str,
    seed: int | None = None,
) -> ExerciseImageResult:
    """Generate a phase image conditioned on an anchor/reference image."""
    client = _get_client()
    model_name = settings.EXERCISE_IMAGE_PHASE_MODEL
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(
                        data=anchor_image_bytes,
                        mime_type=anchor_mime_type,
                    ),
                ],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    seed=seed if seed is not None else _stable_seed(model_name, prompt),
                ),
            )
            return _extract_inline_result(response, prompt, model_name)
        except Exception as exc:
            is_retryable = False
            if hasattr(exc, "code") and exc.code == 429:
                is_retryable = True
            elif "429" in str(exc) or "resourceexhausted" in str(exc).lower():
                is_retryable = True

            if is_retryable and attempt < max_retries - 1:
                wait_time = 15 * (attempt + 1)
                logger.warning(
                    "Gemini API rate limit hit, retrying in %ds... (attempt %d/%d)",
                    wait_time,
                    attempt + 1,
                    max_retries,
                )
                await asyncio.sleep(wait_time)
                continue
            raise

    raise RuntimeError("Gemini anchored image generation retry loop exhausted")


async def generate_exercise_phase_image(
    context: Dict, phase_label: str
) -> ExerciseImageResult:
    prompt = _build_prompt(context, phase_label)
    return await _generate_image_async(prompt)


async def generate_exercise_phase_pair(
    context: Dict,
    *,
    first_phase_label: str = "start / eccentric",
    second_phase_label: str = "end / concentric",
) -> tuple[ExerciseImageResult, ExerciseImageResult]:
    """Generate a consistent pair: first phase from text, second from anchor.

    The first image is generated from scratch. The second image uses the first
    as a visual reference so that equipment, style, and body type are consistent.
    """
    # Step 1: generate anchor image (first phase)
    first_result = await generate_exercise_phase_image(context, first_phase_label)

    # Step 2: generate second phase using anchor
    anchor_bytes = decode_generated_image(first_result)
    anchor_fingerprint = _normalized_image_fingerprint(anchor_bytes)
    anchor_mime = first_result.mime_type or DEFAULT_MIME
    second_result: ExerciseImageResult | None = None
    max_anchor_attempts = 2

    for attempt in range(max_anchor_attempts):
        attempt_seed = _stable_seed(
            context.get("name", "Exercise"),
            first_phase_label,
            second_phase_label,
            str(attempt),
        )
        second_prompt = _build_anchor_prompt(
            context,
            first_phase_label,
            second_phase_label,
            retry_emphasis=attempt > 0,
        )
        second_result = await _generate_anchored_image_async(
            anchor_image_bytes=anchor_bytes,
            anchor_mime_type=anchor_mime,
            prompt=second_prompt,
            seed=attempt_seed,
        )
        if (
            _normalized_image_fingerprint(decode_generated_image(second_result))
            != anchor_fingerprint
        ):
            break

        logger.warning(
            "Anchored phase generation repeated the anchor image for '%s' "
            "(source phase '%s', target phase '%s', attempt %d/%d)",
            context.get("name", "Exercise"),
            first_phase_label,
            second_phase_label,
            attempt + 1,
            max_anchor_attempts,
        )

    if second_result is None:
        raise RuntimeError("Anchored phase generation did not return a result")

    if (
        _normalized_image_fingerprint(decode_generated_image(second_result))
        == anchor_fingerprint
    ):
        raise RuntimeError(
            "Anchored phase generation produced the same image as the anchor after retries"
        )

    return first_result, second_result


async def generate_reference_image_variant(
    *,
    context: Dict,
    option: ReferenceOptionSpec,
    source_image_url: str,
) -> ExerciseImageResult:
    prepared = await asyncio.to_thread(_normalize_reference_image, source_image_url)
    return await _generate_reference_image_async(
        context=context,
        option=option,
        prepared=prepared,
    )


def decode_generated_image(result: ExerciseImageResult) -> bytes:
    return _inline_data_to_bytes(result.base64_data)
