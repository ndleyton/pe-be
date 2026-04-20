import base64
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.genai.google_images import (
    ExerciseImageResult,
    REFERENCE_OPTION_SPECS,
    ReferenceOptionSpec,
    _build_anchor_prompt,
    _build_identity_block,
    _build_reference_prompt,
    _build_prompt,
    _generate_anchored_image_async,
    _generate_image_async,
    _generate_reference_image_async,
    generate_exercise_phase_image,
    generate_exercise_phase_pair,
)


# ---------------------------------------------------------------------------
# _build_identity_block
# ---------------------------------------------------------------------------


def test_build_identity_block_full_context():
    context = {
        "name": "Squat",
        "equipment": "Barbell",
        "instructions": "Stand with feet shoulder-width apart.",
        "category": "Legs",
        "primary_muscles": ["Quads"],
        "secondary_muscles": ["Glutes", "Hamstrings"],
    }
    block = _build_identity_block(context)
    assert "Exercise: Squat." in block
    assert "Equipment: Barbell." in block
    assert "Category: Legs." in block
    assert "Primary: Quads; Secondary: Glutes, Hamstrings" in block
    assert "Stand with feet shoulder-width apart." in block


def test_build_identity_block_empty_context():
    block = _build_identity_block({})
    assert "Exercise: Exercise." in block
    assert "Equipment: Bodyweight only." in block
    assert "Category: General." in block
    assert "Primary: (unspecified)" in block
    assert "No detailed instructions provided." in block


# ---------------------------------------------------------------------------
# _build_prompt (v4)
# ---------------------------------------------------------------------------


def test_build_prompt_full_context():
    context = {
        "name": "Squat",
        "description": "A lower body exercise",
        "equipment": "Barbell",
        "category": "Legs",
        "instructions": "Bend at the knees.",
        "primary_muscles": ["Quads"],
        "secondary_muscles": ["Glutes", "Hamstrings"],
    }
    prompt = _build_prompt(context, "eccentric / bottom")
    assert "Exercise: Squat." in prompt
    assert "Phase: eccentric / bottom." in prompt
    assert "Primary: Quads; Secondary: Glutes, Hamstrings" in prompt
    assert "Equipment: Barbell." in prompt
    assert "Description: A lower body exercise" in prompt
    assert "Render the Squat at the eccentric / bottom position." in prompt
    # v4 style directives
    assert "Instructional fitness illustration" in prompt
    assert "accurate grip positions" in prompt
    assert "Output only one image." in prompt


def test_build_prompt_empty_context():
    prompt = _build_prompt({}, "start")
    assert "Exercise: Exercise." in prompt
    assert "Primary: (unspecified)" in prompt
    assert "Equipment: Bodyweight only." in prompt
    # Empty description should not produce a description line
    assert "Description:" not in prompt


def test_build_prompt_no_description():
    context = {
        "name": "Push Up",
        "equipment": "Bodyweight",
    }
    prompt = _build_prompt(context, "start")
    assert "Description:" not in prompt


# ---------------------------------------------------------------------------
# _build_anchor_prompt
# ---------------------------------------------------------------------------


def test_build_anchor_prompt():
    context = {
        "name": "Bench Press",
        "equipment": "Barbell",
        "category": "Chest",
        "primary_muscles": ["Pectorals"],
    }
    prompt = _build_anchor_prompt(
        context,
        "start / eccentric",
        "end / concentric",
    )
    assert "Exercise: Bench Press." in prompt
    assert "Use the attached image as the visual reference." in prompt
    assert "source of truth for person identity" in prompt
    assert "The attached image shows the start / eccentric phase." in prompt
    assert "Do NOT reproduce the start / eccentric pose" in prompt
    assert "Target phase: end / concentric." in prompt
    assert "Render the Bench Press at the end / concentric position." in prompt
    assert (
        "If the output looks like the same pose as the reference, it is incorrect."
        in prompt
    )
    assert "grip/contact points must remain identical" in prompt
    assert "Output only one image." in prompt


# ---------------------------------------------------------------------------
# _build_reference_prompt (unchanged, verify existing)
# ---------------------------------------------------------------------------


def test_build_reference_prompt_for_muscle_highlight_option():
    option = next(
        spec for spec in REFERENCE_OPTION_SPECS if spec.key == "anatomy-focus"
    )
    prompt = _build_reference_prompt(
        {
            "name": "Lat Pulldown",
            "description": "Upper body pull",
            "instructions": "Drive elbows down.",
            "equipment": "Cable machine",
            "category": "Back",
            "primary_muscles": ["Lats"],
            "secondary_muscles": ["Biceps"],
        },
        option,
    )

    assert "Exercise: Lat Pulldown." in prompt
    assert "Use the uploaded reference image as the source of truth" in prompt
    assert "deep charcoal background" in prompt
    assert "rgb(255, 51, 102)" in prompt
    assert "Everkinetic" in prompt
    assert "Do not add labels or text." in prompt


def test_build_reference_prompt_for_minimal_outline_option():
    option = next(
        spec for spec in REFERENCE_OPTION_SPECS if spec.key == "minimal-outline"
    )
    prompt = _build_reference_prompt(
        {
            "name": "Chest Supported Row",
            "description": "Upper body pull",
            "instructions": "Drive elbows back.",
            "equipment": "Bench and dumbbells",
            "category": "Back",
            "primary_muscles": ["Upper Back"],
            "secondary_muscles": ["Biceps"],
        },
        option,
    )

    assert "Exercise: Chest Supported Row." in prompt
    assert "flat deep charcoal background" in prompt
    assert "better center the exercise" in prompt
    assert "viewing angle slightly" in prompt
    assert "same equipment and exercise setup" in prompt
    assert "Do not add labels or text." in prompt


# ---------------------------------------------------------------------------
# _generate_image_async tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@patch("src.genai.google_images.settings")
@patch("src.genai.google_images._get_client")
async def test_generate_image_async_success(mock_get_client, mock_settings):
    mock_settings.GOOGLE_AI_KEY = "test_key"
    mock_inline = MagicMock()
    mock_inline.data = TINY_PNG_RED_B64
    mock_inline.mime_type = "image/png"

    mock_part = MagicMock()
    mock_part.inline_data = mock_inline

    mock_candidate = MagicMock()
    mock_candidate.content.parts = [mock_part]

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=MagicMock(candidates=[mock_candidate])
    )
    mock_get_client.return_value = mock_client

    result = await _generate_image_async("My test prompt")

    mock_client.aio.models.generate_content.assert_called_once()
    _, kwargs = mock_client.aio.models.generate_content.call_args
    config = kwargs["config"]
    assert config.response_modalities == ["IMAGE"]

    assert result.base64_data == TINY_PNG_RED_B64
    assert result.mime_type == "image/png"
    assert result.prompt_summary == "My test prompt"


@pytest.mark.asyncio
@patch("src.genai.google_images.settings")
@patch("src.genai.google_images._get_client")
async def test_generate_image_async_no_image_data(mock_get_client, mock_settings):
    mock_settings.GOOGLE_AI_KEY = "test_key"

    mock_part = MagicMock()
    mock_part.inline_data = None

    mock_candidate = MagicMock()
    mock_candidate.content.parts = [mock_part]

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=MagicMock(candidates=[mock_candidate])
    )
    mock_get_client.return_value = mock_client

    with pytest.raises(ValueError, match="Model did not return image data"):
        await _generate_image_async("My test prompt")


@pytest.mark.asyncio
@patch("src.genai.google_images._generate_image_async")
async def test_generate_exercise_phase_image_async(mock_async_gen):
    mock_result = MagicMock()
    mock_async_gen.return_value = mock_result

    result = await generate_exercise_phase_image({"name": "Bench Press"}, "end")

    assert result == mock_result
    mock_async_gen.assert_called_once()


# ---------------------------------------------------------------------------
# _generate_anchored_image_async tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@patch("src.genai.google_images.settings")
@patch("src.genai.google_images._get_client")
async def test_generate_anchored_image_async_success(mock_get_client, mock_settings):
    mock_settings.EXERCISE_IMAGE_PHASE_MODEL = "phase-model"
    mock_settings.GOOGLE_AI_KEY = "test_key"

    mock_inline = MagicMock()
    mock_inline.data = TINY_PNG_BLUE_B64
    mock_inline.mime_type = "image/png"

    mock_part = MagicMock()
    mock_part.inline_data = mock_inline

    mock_candidate = MagicMock()
    mock_candidate.content.parts = [mock_part]

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=MagicMock(candidates=[mock_candidate])
    )
    mock_get_client.return_value = mock_client

    red_bytes = base64.b64decode(TINY_PNG_RED_B64)
    result = await _generate_anchored_image_async(
        anchor_image_bytes=red_bytes,
        anchor_mime_type="image/png",
        prompt="Generate concentric phase",
    )

    mock_client.aio.models.generate_content.assert_called_once()
    _, kwargs = mock_client.aio.models.generate_content.call_args
    assert kwargs["model"] == "phase-model"
    config = kwargs["config"]
    assert config.response_modalities == ["IMAGE"]
    # Should have text + image parts in contents
    contents = kwargs["contents"]
    assert len(contents) == 2

    assert result.base64_data == TINY_PNG_BLUE_B64
    assert result.mime_type == "image/png"


# ---------------------------------------------------------------------------
# generate_exercise_phase_pair tests
# ---------------------------------------------------------------------------


# Valid tiny PNGs (8x8) to exercise the Pillow-normalized fingerprint path
TINY_PNG_RED_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8DwnwEPYMInOXwUAAASWwIOH0pJXQAAAABJRU5ErkJggg=="
TINY_PNG_BLUE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGNkYPj/nwEPYMInOXwUAAAQXQIOZWZ6QQAAAABJRU5ErkJggg=="


@pytest.mark.asyncio
@patch("src.genai.google_images._generate_anchored_image_async")
@patch("src.genai.google_images.generate_exercise_phase_image")
async def test_generate_exercise_phase_pair(mock_phase_gen, mock_anchored_gen):

    red_bytes = base64.b64decode(TINY_PNG_RED_B64)
    blue_bytes = base64.b64decode(TINY_PNG_BLUE_B64)

    first_result = ExerciseImageResult(
        model="phase-model",
        mime_type="image/png",
        base64_data=TINY_PNG_RED_B64,
        prompt_summary="start",
    )
    mock_phase_gen.return_value = first_result

    second_result = ExerciseImageResult(
        model="phase-model",
        mime_type="image/png",
        base64_data=TINY_PNG_BLUE_B64,
        prompt_summary="end",
    )
    mock_anchored_gen.return_value = second_result

    context = {"name": "Bench Press", "equipment": "Barbell"}
    eccentric, concentric = await generate_exercise_phase_pair(context)

    # First image generated from scratch
    mock_phase_gen.assert_called_once_with(context, "start / eccentric")

    # Second image generated using anchor
    mock_anchored_gen.assert_called_once()
    _, kwargs = mock_anchored_gen.call_args
    assert kwargs["anchor_image_bytes"] == red_bytes
    assert kwargs["anchor_mime_type"] == "image/png"
    assert "end / concentric" in kwargs["prompt"]
    assert "start / eccentric" in kwargs["prompt"]
    assert "Use the attached image as the visual reference" in kwargs["prompt"]

    assert eccentric == first_result
    assert concentric == second_result


@pytest.mark.asyncio
@patch("src.genai.google_images._generate_anchored_image_async")
@patch("src.genai.google_images.generate_exercise_phase_image")
async def test_generate_exercise_phase_pair_custom_labels(
    mock_phase_gen, mock_anchored_gen
):
    first_result = ExerciseImageResult(
        model="phase-model",
        mime_type="image/png",
        base64_data=TINY_PNG_RED_B64,
        prompt_summary="bottom",
    )
    mock_phase_gen.return_value = first_result

    second_result = ExerciseImageResult(
        model="phase-model",
        mime_type="image/png",
        base64_data=TINY_PNG_BLUE_B64,
        prompt_summary="top",
    )
    mock_anchored_gen.return_value = second_result

    context = {"name": "Curl"}
    await generate_exercise_phase_pair(
        context,
        first_phase_label="bottom",
        second_phase_label="top",
    )

    mock_phase_gen.assert_called_once_with(context, "bottom")
    _, kwargs = mock_anchored_gen.call_args
    assert "top" in kwargs["prompt"]
    assert "bottom" in kwargs["prompt"]


@pytest.mark.asyncio
@patch("src.genai.google_images._generate_anchored_image_async")
@patch("src.genai.google_images.generate_exercise_phase_image")
async def test_generate_exercise_phase_pair_retries_when_anchor_is_duplicated(
    mock_phase_gen, mock_anchored_gen
):
    first_result = ExerciseImageResult(
        model="phase-model",
        mime_type="image/png",
        base64_data=TINY_PNG_RED_B64,
        prompt_summary="start",
    )
    retry_result = ExerciseImageResult(
        model="phase-model",
        mime_type="image/png",
        base64_data=TINY_PNG_BLUE_B64,
        prompt_summary="end",
    )

    mock_phase_gen.return_value = first_result
    mock_anchored_gen.side_effect = [first_result, retry_result]

    eccentric, concentric = await generate_exercise_phase_pair(
        {"name": "Bench Press"},
        first_phase_label="start / eccentric",
        second_phase_label="end / concentric",
    )

    assert eccentric == first_result
    assert concentric == retry_result
    assert mock_anchored_gen.await_count == 2

    first_call = mock_anchored_gen.await_args_list[0].kwargs
    second_call = mock_anchored_gen.await_args_list[1].kwargs
    assert (
        "Previous attempt stayed too close to the reference pose."
        not in first_call["prompt"]
    )
    assert (
        "Previous attempt stayed too close to the reference pose."
        in second_call["prompt"]
    )


@pytest.mark.asyncio
@patch("src.genai.google_images._generate_anchored_image_async")
@patch("src.genai.google_images.generate_exercise_phase_image")
async def test_generate_exercise_phase_pair_raises_when_anchor_stays_identical(
    mock_phase_gen, mock_anchored_gen
):
    first_result = ExerciseImageResult(
        model="phase-model",
        mime_type="image/png",
        base64_data=TINY_PNG_RED_B64,
        prompt_summary="start",
    )

    mock_phase_gen.return_value = first_result
    mock_anchored_gen.side_effect = [first_result, first_result]

    with pytest.raises(RuntimeError, match="same image as the anchor"):
        await generate_exercise_phase_pair(
            {"name": "Bench Press"},
            first_phase_label="start / eccentric",
            second_phase_label="end / concentric",
        )

    assert mock_anchored_gen.await_count == 2


# ---------------------------------------------------------------------------
# Reference image tests (unchanged)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@patch("src.genai.google_images.settings")
@patch("src.genai.google_images._get_client")
async def test_generate_reference_image_async_success(mock_get_client, mock_settings):
    mock_settings.EXERCISE_IMAGE_REFERENCE_MODEL = "ref-model"
    mock_settings.GOOGLE_AI_KEY = "test_key"

    # Mocking normalization result
    mock_prepared = MagicMock()
    mock_prepared.image_bytes = base64.b64decode(TINY_PNG_RED_B64)
    mock_prepared.mime_type = "image/png"

    mock_inline = MagicMock()
    mock_inline.data = TINY_PNG_BLUE_B64
    mock_inline.mime_type = "image/png"

    mock_part = MagicMock()
    mock_part.inline_data = mock_inline

    mock_candidate = MagicMock()
    mock_candidate.content.parts = [mock_part]

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=MagicMock(candidates=[mock_candidate])
    )
    mock_get_client.return_value = mock_client

    option = ReferenceOptionSpec(
        key="test",
        label="Test",
        description="Desc",
        reference_directive="Reference",
        style_directive="Direct",
    )

    result = await _generate_reference_image_async(
        context={"name": "Push Up"},
        option=option,
        prepared=mock_prepared,
    )

    mock_client.aio.models.generate_content.assert_called_once()
    _, kwargs = mock_client.aio.models.generate_content.call_args
    assert kwargs["model"] == "ref-model"
    config = kwargs["config"]
    assert config.response_modalities == ["IMAGE"]

    assert result.base64_data == TINY_PNG_BLUE_B64
    assert result.mime_type == "image/png"


# ---------------------------------------------------------------------------
# Retry logic tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@patch("src.genai.google_images.asyncio.sleep", new_callable=AsyncMock)
@patch("src.genai.google_images.settings")
@patch("src.genai.google_images._get_client")
async def test_generate_image_retry_on_429_async(
    mock_get_client, mock_settings, mock_sleep
):
    mock_settings.GOOGLE_AI_KEY = "test_key"

    # Mock an error that looks like a 429
    mock_error = Exception("Resource Exhausted (429)")
    mock_error.code = 429

    mock_inline = MagicMock()
    mock_inline.data = "success_data"
    mock_inline.mime_type = "image/png"
    mock_part = MagicMock()
    mock_part.inline_data = mock_inline
    mock_candidate = MagicMock()
    mock_candidate.content.parts = [mock_part]
    mock_response = MagicMock(candidates=[mock_candidate])

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        side_effect=[mock_error, mock_response]
    )
    mock_get_client.return_value = mock_client

    result = await _generate_image_async("retry test")

    assert mock_client.aio.models.generate_content.call_count == 2
    assert mock_sleep.call_count == 1
    assert result.base64_data == "success_data"


@pytest.mark.asyncio
@patch("src.genai.google_images.asyncio.sleep", new_callable=AsyncMock)
@patch("src.genai.google_images.settings")
@patch("src.genai.google_images._get_client")
async def test_generate_image_fails_after_max_retries_async(
    mock_get_client, mock_settings, mock_sleep
):
    mock_settings.GOOGLE_AI_KEY = "test_key"

    def fake_generate_raise(*args, **kwargs):
        mock_error = Exception("Resource Exhausted (429)")
        mock_error.code = 429
        raise mock_error

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(side_effect=fake_generate_raise)
    mock_get_client.return_value = mock_client

    with pytest.raises(Exception) as excinfo:
        await _generate_image_async("perma-fail")

    assert "429" in str(excinfo.value)
    assert mock_client.aio.models.generate_content.call_count == 3
    assert mock_sleep.call_count == 2
    # attempt 0: fail, wait(15), attempt 1: fail, wait(30), attempt 2: fail, raise
    # wait, loop is:
    # for attempt in range(max_retries): [0, 1, 2]
    # attempt 0: fail, wait 15, continue
    # attempt 1: fail, wait 30, continue
    # attempt 2: fail, raise (since 2 < 3-1 is false)
    # So 2 sleeps. Correct.
