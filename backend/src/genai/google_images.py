from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Dict, List

from src.core.config import settings


MODEL_NAME = "gemini-2.5-flash-image"
DEFAULT_MIME = "image/png"


@dataclass
class ExerciseImageResult:
    model: str
    mime_type: str
    base64_data: str
    prompt_summary: str


def _build_prompt(context: Dict, phase_label: str) -> str:
    name = context.get("name", "Exercise")
    description = (context.get("description") or "").strip()
    primary: List[str] = context.get("primary_muscles") or []
    secondary: List[str] = context.get("secondary_muscles") or []

    muscles_line = "Primary: " + ", ".join(primary) if primary else "Primary: (unspecified)"
    if secondary:
        muscles_line += "; Secondary: " + ", ".join(secondary)

    style = (
        "Create a simple instructional 2D line-art style image on a neutral background. "
        "Clear human silhouette, no text, no logos, no background clutter. "
        "High contrast outlines, minimal shading, clean anatomy hints. "
        "Focus on correct joint alignment and body positioning."
    )

    # Explicitly specify the requested phase to minimize ambiguity
    phase_directive = (
        f"Render the {name} at the {phase_label} position."
    )

    prompt = (
        f"Exercise: {name}.\n"
        f"Phase: {phase_label}.\n"
        f"Muscles: {muscles_line}.\n"
        f"Description: {description or 'No extra description provided.'}\n\n"
        f"{style}\n"
        f"{phase_directive}\n"
        "Frame the full body as needed to show posture clearly. "
        "If equipment is typical for this exercise (e.g., barbell, dumbbells, cable), include a minimal representation. "
        "Avoid captions and text. Output only an image."
    )
    return prompt


def _generate_image_sync(prompt: str) -> ExerciseImageResult:
    try:
        # Import locally to avoid failing module import at startup if the package is missing
        from google import generativeai as genai  # type: ignore
    except Exception as e:  # pragma: no cover - import-time environment dependent
        raise RuntimeError(
            "google-generativeai package not available. Please ensure it is installed "
            "(it is typically installed via langchain-google-genai)."
        ) from e

    genai.configure(api_key=settings.GOOGLE_AI_KEY)
    model = genai.GenerativeModel(MODEL_NAME)

    # Request a PNG image response
    response = model.generate_content(
        [prompt],
        generation_config={"response_mime_type": DEFAULT_MIME},
    )

    # Navigate the response to find inline image data
    try:
        candidate = response.candidates[0]
        parts = candidate.content.parts
        inline = next((p.inline_data for p in parts if getattr(p, "inline_data", None)), None)
    except Exception as e:  # pragma: no cover - defensive path
        raise ValueError(f"Unexpected response structure from model: {e}") from e

    if not inline or not getattr(inline, "data", None):
        raise ValueError("Model did not return image data")

    return ExerciseImageResult(
        model=MODEL_NAME,
        mime_type=getattr(inline, "mime_type", DEFAULT_MIME) or DEFAULT_MIME,
        base64_data=inline.data,
        prompt_summary=prompt[:200],
    )


async def generate_exercise_phase_image(context: Dict, phase_label: str) -> ExerciseImageResult:
    """
    Generate a single exercise image for the specified phase using Gemini.

    Runs the blocking client in a thread to avoid blocking the event loop.
    """
    prompt = _build_prompt(context, phase_label)
    return await asyncio.to_thread(_generate_image_sync, prompt)
