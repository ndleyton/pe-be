from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import datetime, timezone
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.admin.schemas import (
    AdminExerciseImageOption,
    AdminExerciseImageOptionSpec,
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
    generate_exercise_phase_pair,
    generate_reference_image_variant,
)

REFERENCE_OPTION_SOURCE = "reference_redraw"
PHASE_FALLBACK_OPTION_SOURCE = "phase_generated"
PHASE_FALLBACK_PIPELINE_KEY = "phase_fallback_v1"
PHASE_FALLBACK_PROMPT_VERSION = "v4"
PHASE_FALLBACK_OPTION_KEY = "phase-generated"
PHASE_FALLBACK_OPTION_LABEL = "Generated Phase Pair"
PHASE_FALLBACK_OPTION_DESCRIPTION = (
    "Two AI-generated instructional images covering the start/eccentric and "
    "end/concentric positions."
)
PHASE_FALLBACK_IMAGES = (
    (0, "__phase__:start-eccentric", "start / eccentric"),
    (1, "__phase__:end-concentric", "end / concentric"),
)


@dataclass(frozen=True)
class AdminImageOptionSpec:
    key: str
    label: str
    description: str
    pipeline_key: str
    option_source: str


def _image_json(image_urls: list[str]) -> str:
    return json.dumps(image_urls)


def _build_generation_key(
    *,
    exercise_type_id: int,
    source_image_url: str,
    source_image_index: int,
    option_key: str,
    pipeline_key: str,
    prompt_version: str,
    model_name: str,
) -> str:
    payload = {
        "exercise_type_id": exercise_type_id,
        "source_image_url": source_image_url,
        "source_image_index": source_image_index,
        "pipeline_key": pipeline_key,
        "option_key": option_key,
        "prompt_version": prompt_version,
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


def _should_promote_current_images_to_reference(current_images: list[str]) -> bool:
    # Only seed reference_images_url from pre-existing library assets, not from
    # images we previously generated or published through this pipeline.
    if not current_images:
        return False
    generated_prefixes = ("generated/", "published/")
    return not all(image.startswith(generated_prefixes) for image in current_images)


def _ensure_reference_images(exercise_type: ExerciseType) -> list[str]:
    reference_images = parse_image_url_list(exercise_type.reference_images_url)
    if reference_images:
        return reference_images

    current_images = parse_image_url_list(exercise_type.images_url)
    if _should_promote_current_images_to_reference(current_images):
        exercise_type.reference_images_url = exercise_type.images_url
        return current_images
    return []


def _option_specs() -> tuple[AdminImageOptionSpec, ...]:
    reference_specs = tuple(
        AdminImageOptionSpec(
            key=option.key,
            label=option.label,
            description=option.description,
            pipeline_key=REFERENCE_PIPELINE_KEY,
            option_source=REFERENCE_OPTION_SOURCE,
        )
        for option in REFERENCE_OPTION_SPECS
    )
    return reference_specs + (
        AdminImageOptionSpec(
            key=PHASE_FALLBACK_OPTION_KEY,
            label=PHASE_FALLBACK_OPTION_LABEL,
            description=PHASE_FALLBACK_OPTION_DESCRIPTION,
            pipeline_key=PHASE_FALLBACK_PIPELINE_KEY,
            option_source=PHASE_FALLBACK_OPTION_SOURCE,
        ),
    )


def _available_option_specs(
    reference_images: list[str],
) -> list[AdminExerciseImageOptionSpec]:
    expected_source = (
        REFERENCE_OPTION_SOURCE if reference_images else PHASE_FALLBACK_OPTION_SOURCE
    )
    return [
        AdminExerciseImageOptionSpec(
            key=option.key,
            label=option.label,
            description=option.description,
            option_source=option.option_source,
        )
        for option in _option_specs()
        if option.option_source == expected_source
    ]


def _expected_candidate_count(*, pipeline_key: str, reference_images: list[str]) -> int:
    if pipeline_key == REFERENCE_PIPELINE_KEY:
        return len(reference_images)
    if pipeline_key == PHASE_FALLBACK_PIPELINE_KEY:
        return len(PHASE_FALLBACK_IMAGES)
    return 0


def _published_option_images(
    exercise_type_id: int, candidates: list[ExerciseImageCandidate]
) -> list[str]:
    return [
        resolve_exercise_image_url(
            _published_storage_path_for_candidate(
                exercise_type_id,
                candidate.option_key,
                candidate.source_image_index,
                candidate.generation_key,
            )
        )
        for candidate in candidates
    ]


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


async def _load_candidates_by_keys(
    session: AsyncSession, generation_keys: list[str]
) -> list[ExerciseImageCandidate]:
    if not generation_keys:
        return []
    result = await session.execute(
        select(ExerciseImageCandidate).where(
            ExerciseImageCandidate.generation_key.in_(generation_keys)
        )
    )
    return result.scalars().all()


def _candidate_groups(
    *,
    exercise_type_id: int,
    candidates: list[ExerciseImageCandidate],
    current_images: list[str],
    reference_images: list[str],
) -> list[AdminExerciseImageOption]:
    current_resolved = resolve_exercise_image_urls(current_images)
    options: list[AdminExerciseImageOption] = []

    for option in _option_specs():
        option_candidates = [
            candidate
            for candidate in candidates
            if candidate.option_key == option.key
            and candidate.pipeline_key == option.pipeline_key
        ]
        expected_count = _expected_candidate_count(
            pipeline_key=option.pipeline_key,
            reference_images=reference_images,
        )
        if expected_count == 0 or len(option_candidates) != expected_count:
            continue

        option_candidates.sort(key=lambda candidate: candidate.source_image_index)
        option_images = [
            resolve_exercise_image_url(candidate.storage_path)
            for candidate in option_candidates
        ]
        live_images = _published_option_images(exercise_type_id, option_candidates)
        options.append(
            AdminExerciseImageOption(
                key=option.key,
                label=option.label,
                description=option.description,
                option_source=option.option_source,
                images=option_images,
                candidate_ids=[candidate.id for candidate in option_candidates],
                source_images=(
                    [
                        resolve_exercise_image_url(candidate.source_image_url)
                        for candidate in option_candidates
                    ]
                    if option.option_source == REFERENCE_OPTION_SOURCE
                    else []
                ),
                is_current=live_images == current_resolved,
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
        supports_revert_to_reference=bool(reference_images),
        available_options=_available_option_specs(reference_images),
        options=_candidate_groups(
            exercise_type_id=exercise_type.id,
            candidates=candidates,
            current_images=parse_image_url_list(exercise_type.images_url),
            reference_images=reference_images,
        ),
    )


async def generate_reference_image_options(
    session: AsyncSession,
    exercise_type: ExerciseType,
    *,
    option_key: str | None = None,
) -> AdminExerciseImageOptionsResponse:
    reference_images = _ensure_reference_images(exercise_type)
    if not reference_images:
        if option_key and option_key != PHASE_FALLBACK_OPTION_KEY:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Specific option selection requires preserved reference images",
            )
        return await _generate_phase_fallback_image_options(session, exercise_type)

    reference_option_specs = REFERENCE_OPTION_SPECS
    if option_key:
        matching_option = next(
            (option for option in REFERENCE_OPTION_SPECS if option.key == option_key),
            None,
        )
        if not matching_option:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unknown reference image option",
            )
        reference_option_specs = (matching_option,)
    context = _exercise_context(exercise_type)
    model_name = exercise_type_reference_model()

    all_potential_keys = []
    for source_image_index, source_image_url in enumerate(reference_images):
        for option in reference_option_specs:
            key = _build_generation_key(
                exercise_type_id=exercise_type.id,
                source_image_url=source_image_url,
                source_image_index=source_image_index,
                option_key=option.key,
                pipeline_key=REFERENCE_PIPELINE_KEY,
                prompt_version=REFERENCE_PROMPT_VERSION,
                model_name=model_name,
            )
            all_potential_keys.append(key)

    existing_candidates = {
        candidate.generation_key: candidate
        for candidate in await _load_candidates_by_keys(session, all_potential_keys)
    }

    pending_jobs: list[
        tuple[
            int,
            str,
            object,
            str,
            str,
            ExerciseImageCandidate | None,
        ]
    ] = []
    for source_image_index, source_image_url in enumerate(reference_images):
        for option in reference_option_specs:
            generation_key = _build_generation_key(
                exercise_type_id=exercise_type.id,
                source_image_url=source_image_url,
                source_image_index=source_image_index,
                option_key=option.key,
                pipeline_key=REFERENCE_PIPELINE_KEY,
                prompt_version=REFERENCE_PROMPT_VERSION,
                model_name=model_name,
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

    async def _generate_job(source_image_url: str, option: object):
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

        new_candidate_rows: list[dict[str, object]] = []
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
            now = datetime.now(timezone.utc)

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
                existing.updated_at = now
            else:
                new_candidate_rows.append(
                    {
                        "exercise_type_id": exercise_type.id,
                        "generation_key": generation_key,
                        "pipeline_key": REFERENCE_PIPELINE_KEY,
                        "option_key": option.key,
                        "option_label": option.label,
                        "option_description": option.description,
                        "source_image_index": source_image_index,
                        "source_image_url": source_image_url,
                        "model_name": result.model,
                        "prompt_version": REFERENCE_PROMPT_VERSION,
                        "prompt_summary": result.prompt_summary,
                        "mime_type": result.mime_type,
                        "storage_path": storage_path,
                        "created_at": now,
                        "updated_at": now,
                    }
                )

        if new_candidate_rows:
            insert_stmt = insert(ExerciseImageCandidate).values(new_candidate_rows)
            excluded = insert_stmt.excluded
            await session.execute(
                insert_stmt.on_conflict_do_update(
                    index_elements=[ExerciseImageCandidate.generation_key],
                    set_={
                        "exercise_type_id": excluded.exercise_type_id,
                        "pipeline_key": excluded.pipeline_key,
                        "option_key": excluded.option_key,
                        "option_label": excluded.option_label,
                        "option_description": excluded.option_description,
                        "source_image_index": excluded.source_image_index,
                        "source_image_url": excluded.source_image_url,
                        "model_name": excluded.model_name,
                        "prompt_version": excluded.prompt_version,
                        "prompt_summary": excluded.prompt_summary,
                        "mime_type": excluded.mime_type,
                        "storage_path": excluded.storage_path,
                        "updated_at": excluded.updated_at,
                    },
                )
            )

    await session.commit()
    await session.refresh(exercise_type)
    return await build_image_options_response(session, exercise_type)


async def _generate_phase_fallback_image_options(
    session: AsyncSession,
    exercise_type: ExerciseType,
) -> AdminExerciseImageOptionsResponse:
    context = _exercise_context(exercise_type)
    model_name = exercise_type_phase_model()

    all_potential_keys = [
        _build_generation_key(
            exercise_type_id=exercise_type.id,
            source_image_url=source_image_url,
            source_image_index=source_image_index,
            option_key=PHASE_FALLBACK_OPTION_KEY,
            pipeline_key=PHASE_FALLBACK_PIPELINE_KEY,
            prompt_version=PHASE_FALLBACK_PROMPT_VERSION,
            model_name=model_name,
        )
        for source_image_index, source_image_url, _ in PHASE_FALLBACK_IMAGES
    ]
    existing_candidates = {
        candidate.generation_key: candidate
        for candidate in await _load_candidates_by_keys(session, all_potential_keys)
    }

    # Check if all candidates already exist on disk
    all_exist = True
    for gen_key in all_potential_keys:
        existing = existing_candidates.get(gen_key)
        if not existing or not _candidate_file_exists(existing.storage_path):
            all_exist = False
            break

    if not all_exist:
        # Generate the pair sequentially (anchor-then-edit)
        eccentric_result, concentric_result = await generate_exercise_phase_pair(
            context,
            first_phase_label="start / eccentric",
            second_phase_label="end / concentric",
        )
        phase_results = [eccentric_result, concentric_result]

        for (
            source_image_index,
            source_image_url,
            _phase_label,
        ), result in zip(PHASE_FALLBACK_IMAGES, phase_results, strict=True):
            generation_key = _build_generation_key(
                exercise_type_id=exercise_type.id,
                source_image_url=source_image_url,
                source_image_index=source_image_index,
                option_key=PHASE_FALLBACK_OPTION_KEY,
                pipeline_key=PHASE_FALLBACK_PIPELINE_KEY,
                prompt_version=PHASE_FALLBACK_PROMPT_VERSION,
                model_name=model_name,
            )
            storage_path = _storage_path_for_candidate(
                exercise_type.id,
                PHASE_FALLBACK_OPTION_KEY,
                source_image_index,
                generation_key,
            )
            existing = existing_candidates.get(generation_key)

            output_bytes = decode_generated_image(result)
            _write_candidate_bytes(storage_path, output_bytes)

            if existing:
                existing.option_label = PHASE_FALLBACK_OPTION_LABEL
                existing.option_description = PHASE_FALLBACK_OPTION_DESCRIPTION
                existing.source_image_url = source_image_url
                existing.source_image_index = source_image_index
                existing.model_name = result.model
                existing.prompt_version = PHASE_FALLBACK_PROMPT_VERSION
                existing.prompt_summary = result.prompt_summary
                existing.mime_type = result.mime_type
                existing.storage_path = storage_path
            else:
                session.add(
                    ExerciseImageCandidate(
                        exercise_type_id=exercise_type.id,
                        generation_key=generation_key,
                        pipeline_key=PHASE_FALLBACK_PIPELINE_KEY,
                        option_key=PHASE_FALLBACK_OPTION_KEY,
                        option_label=PHASE_FALLBACK_OPTION_LABEL,
                        option_description=PHASE_FALLBACK_OPTION_DESCRIPTION,
                        source_image_index=source_image_index,
                        source_image_url=source_image_url,
                        model_name=result.model,
                        prompt_version=PHASE_FALLBACK_PROMPT_VERSION,
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


def exercise_type_phase_model() -> str:
    from src.core.config import settings

    return settings.EXERCISE_IMAGE_PHASE_MODEL


async def apply_reference_or_option(
    session: AsyncSession,
    exercise_type: ExerciseType,
    *,
    option_key: str | None,
    use_reference: bool,
) -> AdminExerciseImageOptionsResponse:
    reference_images = _ensure_reference_images(exercise_type)
    if use_reference and not reference_images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercise type does not have any reference images",
        )

    if use_reference:
        exercise_type.images_url = _image_json(reference_images)
    else:
        candidates = await _load_candidates(session, exercise_type.id)
        option_candidates = [c for c in candidates if c.option_key == option_key]
        if not option_candidates:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requested image option is incomplete or missing",
            )
        option_candidates.sort(key=lambda candidate: candidate.source_image_index)
        expected_count = _expected_candidate_count(
            pipeline_key=option_candidates[0].pipeline_key,
            reference_images=reference_images,
        )
        if expected_count == 0 or len(option_candidates) != expected_count:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requested image option is incomplete or missing",
            )
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
        exercise_type.images_url = _image_json(published_paths)

    await session.commit()
    await session.refresh(exercise_type)
    return await build_image_options_response(session, exercise_type)
