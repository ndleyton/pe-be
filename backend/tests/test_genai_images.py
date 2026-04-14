from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.genai.google_images import (
    REFERENCE_OPTION_SPECS,
    ReferenceOptionSpec,
    _build_reference_prompt,
    _build_prompt,
    _generate_image_async,
    _generate_reference_image_async,
    generate_exercise_phase_image,
)


def test_build_prompt_full_context():
    context = {
        "name": "Squat",
        "description": "A lower body exercise",
        "equipment": "Barbell",
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


def test_build_prompt_empty_context():
    prompt = _build_prompt({}, "start")
    assert "Exercise: Exercise." in prompt
    assert "Primary: (unspecified)" in prompt
    assert "Equipment:" not in prompt
    assert "Description: No extra description provided." in prompt


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


@pytest.mark.asyncio
@patch("src.genai.google_images.settings")
@patch("src.genai.google_images._get_client")
async def test_generate_image_async_success(mock_get_client, mock_settings):
    mock_settings.GOOGLE_AI_KEY = "test_key"
    mock_inline = MagicMock()
    mock_inline.data = "base64encodedimage"
    mock_inline.mime_type = "image/jpeg"

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

    assert result.base64_data == "base64encodedimage"
    assert result.mime_type == "image/jpeg"
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


@pytest.mark.asyncio
@patch("src.genai.google_images.settings")
@patch("src.genai.google_images._get_client")
async def test_generate_reference_image_async_success(mock_get_client, mock_settings):
    mock_settings.EXERCISE_IMAGE_REFERENCE_MODEL = "ref-model"
    mock_settings.GOOGLE_AI_KEY = "test_key"

    # Mocking normalization result
    mock_prepared = MagicMock()
    mock_prepared.image_bytes = b"refbytes"
    mock_prepared.mime_type = "image/png"

    mock_inline = MagicMock()
    mock_inline.data = "base64redrawn"
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

    assert result.base64_data == "base64redrawn"
    assert result.mime_type == "image/png"


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
