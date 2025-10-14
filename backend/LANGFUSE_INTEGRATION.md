# Langfuse Integration - Parser-to-JSON

This document explains the Langfuse integration for the workout parser-to-json functionality.

## Overview

The `WorkoutParsingService` now includes Langfuse observability and prompt management features:

- **Prompt Management**: Fetches prompts from Langfuse with fallback to hardcoded prompts
- **Observability**: Tracks LLM calls, tokens usage, and parsing results
- **Error Handling**: Comprehensive error tracking and logging
- **Backward Compatibility**: Works with or without Langfuse configuration

## Configuration

Add these environment variables to your `.env` file:

```bash
# Langfuse Configuration
LANGFUSE_PUBLIC_KEY=your-langfuse-public-key
LANGFUSE_SECRET_KEY=your-langfuse-secret-key
LANGFUSE_HOST=https://cloud.langfuse.com
```

## Langfuse Setup

### 1. Create the Prompt in Langfuse

In your Langfuse dashboard, create a prompt named `parser-to-json` with the following content:

```
You are a fitness expert assistant that parses workout descriptions into structured data.

Given a workout description, extract:
1. A suitable workout name (if not provided, generate one based on the exercises)
2. Workout type: must be one of these IDs:
   - 1: Low Intensity Cardio
   - 2: HIIT
   - 3: Sports
   - 4: Strength Training
   - 5: Mobility
3. Optional notes about the workout
4. List of exercises with:
   - Exercise name (standardized, e.g., "Bench Press", "Squat", "Deadlift")
   - Exercise notes (optional)
   - Sets with reps, weight/intensity, and intensity unit

Intensity units should be one of: "kg", "lbs", "km/h", "mph", "BW" (bodyweight)

Return ONLY valid JSON in this exact format:
{
  "name": "string",
  "notes": "string or null",
  "workout_type_id": number,
  "exercises": [
    {
      "exercise_type_name": "string",
      "notes": "string or null",
      "sets": [
        {
          "reps": number or null,
          "intensity": number or null,
          "intensity_unit": "string",
          "rest_time_seconds": number or null
        }
      ]
    }
  ]
}
```

### 2. Set Labels

Create labels for your prompt:
- `production`: For production usage
- `latest`: For the latest version
- Add version numbers as needed

## Features

### Prompt Management

```python
from langfuse import Langfuse

# Initialize Langfuse client
langfuse = Langfuse()

# Get production prompt
prompt = langfuse.get_prompt("parser-to-json", label="production")

# Get latest version
prompt = langfuse.get_prompt("parser-to-json", label="latest")

# Get specific version
prompt = langfuse.get_prompt("parser-to-json", version=1)
```

### Observability Features

The integration provides:

1. **Trace Logging**: Each parsing request is logged as a trace
2. **Generation Tracking**: OpenAI API calls are tracked with usage metrics
3. **Error Tracking**: Failures are logged with error details
4. **Metadata**: Includes model, service, and request information

### Usage Example

```python
from src.workouts.service import WorkoutParsingService

# Parse workout text (automatically uses Langfuse if configured)
result = await WorkoutParsingService.parse_workout_text(workout_text)
```

## Testing

Run the test script to verify the integration:

```bash
cd backend
python test_langfuse_integration.py
```

This will:
- Check if Langfuse is configured
- Test the parsing functionality
- Display results and any errors

## Fallback Behavior

If Langfuse is not configured or unavailable:
- Uses hardcoded fallback prompt
- Continues normal OpenAI API functionality
- No observability data is collected

## API Endpoint

The existing `/api/v1/workouts/parse` endpoint automatically uses the new Langfuse integration:

```typescript
// Frontend usage remains unchanged
const response = await api.post('/workouts/parse', {
  workout_text: userInput
});
```

## Dependencies

Added to `pyproject.toml`:
```toml
langfuse = "^2.0.0"
```

## Architecture

```
Frontend Chat → API Endpoint → WorkoutParsingService → Langfuse + OpenAI
                                    ↓
                              WorkoutParseResponse
```

## Benefits

1. **Prompt Management**: Centralized prompt versioning and updates
2. **Observability**: Track LLM performance and usage
3. **A/B Testing**: Easy prompt experimentation
4. **Error Monitoring**: Comprehensive error tracking
5. **Cost Tracking**: Monitor OpenAI API usage and costs

## Next Steps

1. Set up Langfuse account and configure environment variables
2. Create the `parser-to-json` prompt in Langfuse
3. Test the integration using the test script
4. Deploy and monitor in production

## Troubleshooting

### Common Issues

1. **Prompt not found**: Ensure prompt name is exactly `parser-to-json`
2. **Authentication failed**: Check your Langfuse keys
3. **Fallback mode**: Service continues without Langfuse if not configured

### Debug Mode

Set logging level to DEBUG to see detailed Langfuse interactions:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```
