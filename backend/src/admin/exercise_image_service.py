from __future__ import annotations

import asyncio
import hashlib
import json

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.admin.schemas import (
    AdminExerciseImageOption,
    AdminExerciseImageOptionsResponse,
)
from src.exercises.image_assets import (
    parse_image_url_list,
    resolve_exercise_image_url,
    resolve_exercise_image_urls,
    storage_path_for_relative_url,
)
from src.exercises.models import ExerciseImageCandidate, ExerciseType
from src.genai.google_images import (
    REFERENCE_OPTION_SPECS,
    REFERENCE_PIPELINE_KEY,
    REFERENCE_PROMPT_VERSION,
    decode_generated_image,
    generate_reference_image_variant,
)


def _image_json(image_urls: list[str]) -> str:
    return json.dumps(image_urls)


def _build_generation_key(
    *,
    exercise_type_id: int,
    source_image_url: str,
    source_image_index: int,
    option_key: str,
    model_name: str,
) -> str:
    payload = {
        "exercise_type_id": exercise_type_id,
        "source_image_url": source_image_url,
        "source_image_index": source_image_index,
        "pipeline_key": REFERENCE_PIPELINE_KEY,
        "option_key": option_key,
        "prompt_version": REFERENCE_PROMPT_VERSION,
        "model_name": model_name,
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode("utf-8")
    ).hexdigest()


def _storage_path_for_candidate(
    exercise_type_id: int,
    option_key: str,
    source_image_index: int,
    generation_key: str,
) -> str:
    return (
        f"generated/exercise-type-{exercise_type_id}/{option_key}/"
        f"{source_image_index}-{generation_key}.png"
    )


def _published_storage_path_for_candidate(
    exercise_type_id: int,
    option_key: str,
    source_image_index: int,
    generation_key: str,
) -> str:
    return (
        f"published/exercise-type-{exercise_type_id}/{option_key}/"
        f"{source_image_index}-{generation_key}.png"
    )


def _write_candidate_bytes(relative_path: str, image_bytes: bytes) -> None:
    output_path = storage_path_for_relative_url(relative_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(image_bytes)


def _candidate_file_exists(relative_path: str) -> bool:
    try:
        return storage_path_for_relative_url(relative_path).is_file()
    except ValueError:
        return False


def _copy_relative_asset(source_relative_path: str, target_relative_path: str) -> None:
    source_path = storage_path_for_relative_url(source_relative_path)
    target_path = storage_path_for_relative_url(target_relative_path)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(source_path.read_bytes())


def _exercise_context(exercise_type: ExerciseType) -> dict:
    primary_muscles: list[str] = []
    secondary_muscles: list[str] = []

    for exercise_muscle in exercise_type.exercise_muscles or []:
        muscle_name = getattr(getattr(exercise_muscle, "muscle", None), "name", None)
        if not muscle_name:
            continue
        if getattr(exercise_muscle, "is_primary", False):
            primary_muscles.append(muscle_name)
        else:
            secondary_muscles.append(muscle_name)

    return {
        "name": exercise_type.name,
        "description": exercise_type.description or "",
        "instructions": exercise_type.instructions or "",
        "equipment": exercise_type.equipment or "",
        "category": exercise_type.category or "",
        "primary_muscles": primary_muscles,
        "secondary_muscles": secondary_muscles,
    }


def _ensure_reference_images(exercise_type: ExerciseType) -> list[str]:
    reference_images = parse_image_url_list(exercise_type.reference_images_url)
    if reference_images:
        return reference_images

    current_images = parse_image_url_list(exercise_type.images_url)
    if current_images:
        exercise_type.reference_images_url = exercise_type.images_url
    return current_images


async def _load_candidates(
    session: AsyncSession, exercise_type_id: int
) -> list[ExerciseImageCandidate]:
    result = await session.execute(
        select(ExerciseImageCandidate)
        .where(ExerciseImageCandidate.exercise_type_id == exercise_type_id)
        .order_by(
            ExerciseImageCandidate.option_key.asc(),
            ExerciseImageCandidate.source_image_index.asc(),
            ExerciseImageCandidate.id.asc(),
        )
    )
    return result.scalars().all()


def _candidate_groups(
    *,
    candidates: list[ExerciseImageCandidate],
    current_images: list[str],
    reference_images: list[str],
) -> list[AdminExerciseImageOption]:
    current_resolved = resolve_exercise_image_urls(current_images)
    options: list[AdminExerciseImageOption] = []

    for option in REFERENCE_OPTION_SPECS:
        option_candidates = [c for c in candidates if c.option_key == option.key]
        if len(option_candidates) != len(reference_images):
            continue

        option_images = [
            resolve_exercise_image_url(candidate.storage_path)
            for candidate in option_candidates
        ]
        options.append(
            AdminExerciseImageOption(
                key=option.key,
                label=option.label,
                description=option.description,
                images=option_images,
                candidate_ids=[candidate.id for candidate in option_candidates],
                source_images=[
                    resolve_exercise_image_url(candidate.source_image_url)
                    for candidate in option_candidates
                ],
                is_current=option_images == current_resolved,
            )
        )

    return options


async def build_image_options_response(
    session: AsyncSession,
    exercise_type: ExerciseType,
) -> AdminExerciseImageOptionsResponse:
    reference_images = _ensure_reference_images(exercise_type)
    if exercise_type.reference_images_url is None and reference_images:
        await session.flush()

    candidates = await _load_candidates(session, exercise_type.id)

    return AdminExerciseImageOptionsResponse(
        exercise_type_id=exercise_type.id,
        exercise_name=exercise_type.name,
        current_images=resolve_exercise_image_urls(
            parse_image_url_list(exercise_type.images_url)
        ),
        reference_images=resolve_exercise_image_urls(reference_images),
        options=_candidate_groups(
            candidates=candidates,
            current_images=parse_image_url_list(exercise_type.images_url),
            reference_images=reference_images,
        ),
    )


async def generate_reference_image_options(
    session: AsyncSession,
    exercise_type: ExerciseType,
) -> AdminExerciseImageOptionsResponse:
    reference_images = _ensure_reference_images(exercise_type)
    if not reference_images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercise type does not have any reference images",
        )

    context = _exercise_context(exercise_type)
    existing_candidates = {
        candidate.generation_key: candidate
        for candidate in await _load_candidates(session, exercise_type.id)
    }

    pending_jobs: list[tuple[int, str, object, str, str, ExerciseImageCandidate | None]] = []
    for source_image_index, source_image_url in enumerate(reference_images):
        for option in REFERENCE_OPTION_SPECS:
            generation_key = _build_generation_key(
                exercise_type_id=exercise_type.id,
                source_image_url=source_image_url,
                source_image_index=source_image_index,
                option_key=option.key,
                model_name=exercise_type_reference_model(),
            )
            storage_path = _storage_path_for_candidate(
                exercise_type.id,
                option.key,
                source_image_index,
                generation_key,
            )
            existing = existing_candidates.get(generation_key)
            if existing and _candidate_file_exists(existing.storage_path):
                continue

            pending_jobs.append(
                (
                    source_image_index,
                    source_image_url,
                    option,
                    generation_key,
                    storage_path,
                    existing,
                )
            )

    semaphore = asyncio.Semaphore(3)

    async def _generate_job(
        source_image_url: str,
        option,
    ):
        async with semaphore:
            return await generate_reference_image_variant(
                context=context,
                option=option,
                source_image_url=source_image_url,
            )

    if pending_jobs:
        results = await asyncio.gather(
            *[
                _generate_job(source_image_url, option)
                for _, source_image_url, option, _, _, _ in pending_jobs
            ]
        )

        for (
            source_image_index,
            source_image_url,
            option,
            generation_key,
            storage_path,
            existing,
        ), result in zip(pending_jobs, results, strict=True):
            output_bytes = decode_generated_image(result)
            _write_candidate_bytes(storage_path, output_bytes)

            if existing:
                existing.option_label = option.label
                existing.option_description = option.description
                existing.source_image_url = source_image_url
                existing.source_image_index = source_image_index
                existing.model_name = result.model
                existing.prompt_version = REFERENCE_PROMPT_VERSION
                existing.prompt_summary = result.prompt_summary
                existing.mime_type = result.mime_type
                existing.storage_path = storage_path
            else:
                session.add(
                    ExerciseImageCandidate(
                        exercise_type_id=exercise_type.id,
                        generation_key=generation_key,
                        pipeline_key=REFERENCE_PIPELINE_KEY,
                        option_key=option.key,
                        option_label=option.label,
                        option_description=option.description,
                        source_image_index=source_image_index,
                        source_image_url=source_image_url,
                        model_name=result.model,
                        prompt_version=REFERENCE_PROMPT_VERSION,
                        prompt_summary=result.prompt_summary,
                        mime_type=result.mime_type,
                        storage_path=storage_path,
                    )
                )

    await session.commit()
    await session.refresh(exercise_type)
    return await build_image_options_response(session, exercise_type)


def exercise_type_reference_model() -> str:
    from src.core.config import settings

    return settings.EXERCISE_IMAGE_REFERENCE_MODEL


async def apply_reference_or_option(
    session: AsyncSession,
    exercise_type: ExerciseType,
    *,
    option_key: str | None,
    use_reference: bool,
) -> AdminExerciseImageOptionsResponse:
    reference_images = _ensure_reference_images(exercise_type)
    if not reference_images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercise type does not have any reference images",
        )

    if use_reference:
        exercise_type.images_url = _image_json(reference_images)
    else:
        candidates = await _load_candidates(session, exercise_type.id)
        option_candidates = [c for c in candidates if c.option_key == option_key]
        if len(option_candidates) != len(reference_images):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requested image option is incomplete or missing",
            )
        option_candidates.sort(key=lambda candidate: candidate.source_image_index)
        published_paths: list[str] = []
        for candidate in option_candidates:
            published_path = _published_storage_path_for_candidate(
                exercise_type.id,
                candidate.option_key,
                candidate.source_image_index,
                candidate.generation_key,
            )
            _copy_relative_asset(candidate.storage_path, published_path)
            published_paths.append(published_path)
        exercise_type.images_url = _image_json(
            published_paths
        )

    await session.commit()
    await session.refresh(exercise_type)
    return await build_image_options_response(session, exercise_type)
