from unittest.mock import MagicMock, patch

import pytest

from src.genai.google_images import (
    ReferenceOptionSpec,
    _build_prompt,
    _generate_image_sync,
    _generate_reference_image_sync,
    errors,
    generate_exercise_phase_image,
)


def test_build_prompt_full_context():
    context = {
        "name": "Squat",
        "description": "A lower body exercise",
        "primary_muscles": ["Quads"],
        "secondary_muscles": ["Glutes", "Hamstrings"],
    }
    prompt = _build_prompt(context, "eccentric / bottom")
    assert "Exercise: Squat." in prompt
    assert "Phase: eccentric / bottom." in prompt
    assert "Primary: Quads; Secondary: Glutes, Hamstrings" in prompt
    assert "Description: A lower body exercise" in prompt
    assert "Render the Squat at the eccentric / bottom position." in prompt


def test_build_prompt_empty_context():
    prompt = _build_prompt({}, "start")
    assert "Exercise: Exercise." in prompt
    assert "Primary: (unspecified)" in prompt
    assert "Description: No extra description provided." in prompt


@patch("src.genai.google_images.settings")
@patch("src.genai.google_images.genai.Client")
def test_generate_image_sync_success(mock_client_class, mock_settings):
    mock_settings.GOOGLE_AI_KEY = "test_key"
    mock_inline = MagicMock()
    mock_inline.data = "base64encodedimage"
    mock_inline.mime_type = "image/jpeg"

    mock_part = MagicMock()
    mock_part.inline_data = mock_inline

    mock_candidate = MagicMock()
    mock_candidate.content.parts = [mock_part]

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = MagicMock(
        candidates=[mock_candidate]
    )
    mock_client_class.return_value = mock_client

    result = _generate_image_sync("My test prompt")

    mock_client.models.generate_content.assert_called_once()
    _, kwargs = mock_client.models.generate_content.call_args
    config = kwargs["config"]
    assert config.response_modalities == ["IMAGE"]
    # The fix ensures we don't pass response_mime_type for IMAGE modality
    assert getattr(config, "response_mime_type", None) is None

    assert result.base64_data == "base64encodedimage"
    assert result.mime_type == "image/jpeg"
    assert result.prompt_summary == "My test prompt"


@patch("src.genai.google_images.settings")
@patch("src.genai.google_images.genai.Client")
def test_generate_image_sync_no_image_data(mock_client_class, mock_settings):
    mock_settings.GOOGLE_AI_KEY = "test_key"

    mock_part = MagicMock()
    mock_part.inline_data = None

    mock_candidate = MagicMock()
    mock_candidate.content.parts = [mock_part]

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = MagicMock(
        candidates=[mock_candidate]
    )
    mock_client_class.return_value = mock_client

    with pytest.raises(ValueError, match="Model did not return image data"):
        _generate_image_sync("My test prompt")


@pytest.mark.asyncio
@patch("src.genai.google_images._generate_image_sync")
async def test_generate_exercise_phase_image_async(mock_sync):
    mock_result = MagicMock()
    mock_sync.return_value = mock_result

    result = await generate_exercise_phase_image({"name": "Bench Press"}, "end")

    assert result == mock_result
    mock_sync.assert_called_once()


@patch("src.genai.google_images.settings")
@patch("src.genai.google_images.genai.Client")
@patch("src.genai.google_images._normalize_reference_image")
def test_generate_reference_image_sync_success(
    mock_normalize, mock_client_class, mock_settings
):
    mock_settings.EXERCISE_IMAGE_REFERENCE_MODEL = "ref-model"
    mock_settings.GOOGLE_AI_KEY = "test_key"

    # Mocking normalization result
    mock_prepared = MagicMock()
    mock_prepared.image_bytes = b"refbytes"
    mock_prepared.mime_type = "image/png"
    mock_normalize.return_value = mock_prepared

    mock_inline = MagicMock()
    mock_inline.data = "base64redrawn"
    mock_inline.mime_type = "image/png"

    mock_part = MagicMock()
    mock_part.inline_data = mock_inline

    mock_candidate = MagicMock()
    mock_candidate.content.parts = [mock_part]

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = MagicMock(
        candidates=[mock_candidate]
    )
    mock_client_class.return_value = mock_client

    option = ReferenceOptionSpec(
        key="test",
        label="Test",
        description="Desc",
        style_directive="Direct",
    )

    result = _generate_reference_image_sync(
        context={"name": "Push Up"},
        option=option,
        source_image_url="exercises/old.png",
    )

    mock_client.models.generate_content.assert_called_once()
    _, kwargs = mock_client.models.generate_content.call_args
    assert kwargs["model"] == "ref-model"
    config = kwargs["config"]
    assert config.response_modalities == ["IMAGE"]
    assert getattr(config, "response_mime_type", None) is None

    assert result.base64_data == "base64redrawn"
    assert result.mime_type == "image/png"


@patch("src.genai.google_images.time.sleep")
@patch("src.genai.google_images.settings")
@patch("src.genai.google_images.genai.Client")
def test_generate_image_retry_on_429(mock_client_class, mock_settings, mock_sleep):
    mock_settings.GOOGLE_AI_KEY = "test_key"

    # Mock ClientError with code 429 and a dummy response
    mock_error = errors.ClientError("Resource Exhausted", MagicMock())
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
    mock_client.models.generate_content.side_effect = [mock_error, mock_response]
    mock_client_class.return_value = mock_client

    result = _generate_image_sync("retry test")

    assert mock_client.models.generate_content.call_count == 2
    assert mock_sleep.call_count == 1
    assert result.base64_data == "success_data"


@patch("src.genai.google_images.time.sleep")
@patch("src.genai.google_images.settings")
@patch("src.genai.google_images.genai.Client")
def test_generate_image_fails_after_max_retries(
    mock_client_class, mock_settings, mock_sleep
):
    mock_settings.GOOGLE_AI_KEY = "test_key"

    def fake_generate_raise(*args, **kwargs):
        mock_error = errors.ClientError("Resource Exhausted", MagicMock())
        mock_error.code = 429
        raise mock_error

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = fake_generate_raise
    mock_client_class.return_value = mock_client

    with pytest.raises(errors.ClientError) as excinfo:
        _generate_image_sync("perma-fail")

    assert excinfo.value.code == 429
    assert mock_client.models.generate_content.call_count == 3
    assert mock_sleep.call_count == 2
    # attempt 0: fail, wait(15), attempt 1: fail, wait(30), attempt 2: fail, raise
    # wait, loop is:
    # for attempt in range(max_retries): [0, 1, 2]
    # attempt 0: fail, wait 15, continue
    # attempt 1: fail, wait 30, continue
    # attempt 2: fail, raise (since 2 < 3-1 is false)
    # So 2 sleeps. Correct.
