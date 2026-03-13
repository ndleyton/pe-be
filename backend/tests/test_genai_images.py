import pytest
from unittest.mock import patch, MagicMock
from src.genai.google_images import _build_prompt, _generate_image_sync, generate_exercise_phase_image

def test_build_prompt_full_context():
    context = {
        "name": "Squat",
        "description": "A lower body exercise",
        "primary_muscles": ["Quads"],
        "secondary_muscles": ["Glutes", "Hamstrings"]
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

# Mock google.generativeai entirely
@patch("src.genai.google_images.settings")
def test_generate_image_sync_success(mock_settings):
    mock_settings.GOOGLE_AI_KEY = "test_key"
    mock_inline = MagicMock()
    mock_inline.data = "base64encodedimage"
    mock_inline.mime_type = "image/jpeg"
    
    mock_part = MagicMock()
    mock_part.inline_data = mock_inline
    
    mock_candidate = MagicMock()
    mock_candidate.content.parts = [mock_part]
    
    mock_response = MagicMock()
    mock_response.candidates = [mock_candidate]
    
    mock_model = MagicMock()
    mock_model.generate_content.return_value = mock_response
    
    mock_genai = MagicMock()
    mock_genai.GenerativeModel.return_value = mock_model
    
    with patch.dict("sys.modules", {"google.generativeai": mock_genai}):
        result = _generate_image_sync("My test prompt")
        
        mock_genai.configure.assert_called_once_with(api_key="test_key")
        assert result.base64_data == "base64encodedimage"
        assert result.mime_type == "image/jpeg"
        assert result.prompt_summary == "My test prompt"

@patch("src.genai.google_images.settings")
def test_generate_image_sync_no_image_data(mock_settings):
    mock_settings.GOOGLE_AI_KEY = "test_key"
    
    mock_part = MagicMock()
    mock_part.inline_data = None  # No inline data
    
    mock_candidate = MagicMock()
    mock_candidate.content.parts = [mock_part]
    
    mock_response = MagicMock()
    mock_response.candidates = [mock_candidate]
    
    mock_model = MagicMock()
    mock_model.generate_content.return_value = mock_response
    
    mock_genai = MagicMock()
    mock_genai.GenerativeModel.return_value = mock_model
    
    with patch.dict("sys.modules", {"google.generativeai": mock_genai}):
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
