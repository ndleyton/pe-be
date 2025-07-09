from typing import Optional, List
import json
from sqlalchemy.ext.asyncio import AsyncSession
import openai
from datetime import datetime, timezone, date
from langfuse import Langfuse

from src.workouts.crud import (
    get_workout_by_id,
    get_user_workouts,
    create_workout,
    update_workout,
    delete_workout,
    get_workout_types,
    create_workout_type,
    get_latest_workout_for_user,
)
from src.workouts.models import Workout, WorkoutType
from src.workouts.schemas import WorkoutCreate, WorkoutUpdate, WorkoutTypeCreate, WorkoutParseResponse, AddExerciseRequest
from src.core.config import settings
from src.exercises.crud import create_exercise
from src.exercise_sets.crud import create_exercise_set
from src.exercises.schemas import ExerciseCreate
from src.exercise_sets.schemas import ExerciseSetCreate
from src.exercises.crud import get_exercises_for_workout


# ------------------------------------------------------------------------------------
# Seed data defines Strength Training workout type with ID = 4 (see migration 7df0abdd1d04)
DEFAULT_STRENGTH_TRAINING_WORKOUT_TYPE_ID = 4

class WorkoutService:
    """Service layer for workout business logic"""
    
    @staticmethod
    async def get_workout(session: AsyncSession, workout_id: int, user_id: int) -> Optional[Workout]:
        """Get a workout by ID for a specific user"""
        return await get_workout_by_id(session, workout_id, user_id)
    
    @staticmethod
    async def get_my_workouts(session: AsyncSession, user_id: int) -> List[Workout]:
        """Get all workouts for a user"""
        return await get_user_workouts(session, user_id)
    
    @staticmethod
    async def create_new_workout(session: AsyncSession, workout_data: WorkoutCreate, user_id: int) -> Workout:
        """Create a new workout with business logic validation"""
        # Add any business logic here (e.g., validation, default values)
        return await create_workout(session, workout_data, user_id)
    
    @staticmethod
    async def update_workout_data(
        session: AsyncSession, 
        workout_id: int, 
        workout_data: WorkoutUpdate, 
        user_id: int
    ) -> Optional[Workout]:
        """Update workout data with business logic validation"""
        # Add any business logic here (e.g., validation, authorization)
        return await update_workout(session, workout_id, workout_data, user_id)
    
    @staticmethod
    async def remove_workout(session: AsyncSession, workout_id: int, user_id: int) -> bool:
        """Remove a workout with business logic validation"""
        # Add any business logic here (e.g., cascade deletion, authorization)
        return await delete_workout(session, workout_id, user_id)

    @staticmethod
    async def add_exercise_to_current_workout(
        session: AsyncSession,
        user_id: int,
        payload: AddExerciseRequest,
    ) -> Workout:
        """Add an exercise to today's workout for the user, creating workout if necessary.

        1. Fetch latest workout for user.
        2. If not present or not from today (UTC), create new workout with default values.
        3. Create exercise linked to that workout (if exercise not already there).
        4. Optionally add initial set data.
        5. Return the workout with relationships loaded (reusing get_workout).
        """
        # 1. Get latest workout
        workout = await get_latest_workout_for_user(session, user_id)

        today = date.today()
        if not workout or workout.start_time is None or workout.start_time.date() != today:
            # Need to create a new workout for today
            workout_create = WorkoutCreate(
                name=today.strftime("Workout %Y-%m-%d"),
                start_time=datetime.now(timezone.utc),
                workout_type_id=DEFAULT_STRENGTH_TRAINING_WORKOUT_TYPE_ID,  # Default Strength Training
            )
            workout = await create_workout(session, workout_create, user_id)

        # 3. Check if exercise type already exists in workout
        existing_exercises = await get_exercises_for_workout(session, workout.id)
        exercise = next(
            (ex for ex in existing_exercises if ex.exercise_type_id == payload.exercise_type_id),
            None,
        )
        if not exercise:
            # create new exercise
            exercise_create = ExerciseCreate(
                timestamp=datetime.now(timezone.utc),
                exercise_type_id=payload.exercise_type_id,
                workout_id=workout.id,
            )
            exercise = await create_exercise(session, exercise_create)

        # 4. Add initial set if provided
        if payload.initial_set:
            initial_set_create = ExerciseSetCreate(
                reps=payload.initial_set.reps,
                intensity=payload.initial_set.intensity,
                intensity_unit_id=payload.initial_set.intensity_unit_id,
                rest_time_seconds=payload.initial_set.rest_time_seconds,
                exercise_id=exercise.id,
                done=False,  # New set is not done by default
            )
            await create_exercise_set(session, initial_set_create)

        # 5. Return the workout with fresh relationships
        return await get_workout_by_id(session, workout.id, user_id)


class WorkoutTypeService:
    """Service layer for workout type business logic"""
    
    @staticmethod
    async def get_all_workout_types(session: AsyncSession) -> List[WorkoutType]:
        """Get all workout types"""
        return await get_workout_types(session)
    
    @staticmethod
    async def create_new_workout_type(session: AsyncSession, workout_type_data: WorkoutTypeCreate) -> WorkoutType:
        """Create a new workout type with business logic validation"""
        # Add any business logic here (e.g., validation, default values)
        return await create_workout_type(session, workout_type_data)


class WorkoutParsingService:
    """Service layer for workout text parsing using LLM with Langfuse observability"""
    
    @staticmethod
    def _get_langfuse_client() -> Optional[Langfuse]:
        """Get initialized Langfuse client if configured"""
        if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
            return Langfuse(
                public_key=settings.LANGFUSE_PUBLIC_KEY,
                secret_key=settings.LANGFUSE_SECRET_KEY,
                host=settings.LANGFUSE_HOST
            )
        return None
    
    @staticmethod
    async def parse_workout_text(workout_text: str) -> WorkoutParseResponse:
        """Parse raw workout text using OpenAI LLM with Langfuse observability"""
        if not settings.OPENAI_API_KEY:
            raise ValueError("OpenAI API key not configured")
        
        langfuse = WorkoutParsingService._get_langfuse_client()
        trace = None
        
        try:
            # Initialize Langfuse trace if available
            if langfuse:
                trace = langfuse.trace(
                    name="workout-parsing",
                    metadata={"model": "gpt-3.5-turbo", "service": "parser-to-json"}
                )
            
            # Get prompt from Langfuse if available, otherwise use hardcoded prompt
            if langfuse:
                try:
                    prompt = langfuse.get_prompt("parser-to-json", label="production")
                    system_prompt = prompt.prompt
                    
                    # Log prompt usage
                    if trace:
                        trace.generation(
                            name="prompt-fetch",
                            prompt=prompt.prompt,
                            metadata={"prompt_name": "parser-to-json", "label": "production"}
                        )
                except Exception as e:
                    # Fallback to hardcoded prompt if Langfuse fails
                    print(f"Warning: Could not fetch prompt from Langfuse: {e}")
                    system_prompt = WorkoutParsingService._get_fallback_prompt()
            else:
                system_prompt = WorkoutParsingService._get_fallback_prompt()
            
            # Set up OpenAI client
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            
            # Call OpenAI API
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Parse this workout:\n\n{workout_text}"}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            # Parse the response
            response_text = response.choices[0].message.content.strip()
            
            # Log generation to Langfuse
            if trace:
                trace.generation(
                    name="workout-parsing-generation",
                    model="gpt-3.5-turbo",
                    input=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Parse this workout:\n\n{workout_text}"}
                    ],
                    output=response_text,
                    metadata={
                        "temperature": 0.1,
                        "max_tokens": 1000,
                        "usage": {
                            "prompt_tokens": response.usage.prompt_tokens,
                            "completion_tokens": response.usage.completion_tokens,
                            "total_tokens": response.usage.total_tokens
                        }
                    }
                )
            
            # Try to extract JSON if there's extra text
            if response_text.startswith('```json'):
                response_text = response_text.replace('```json', '').replace('```', '').strip()
            elif response_text.startswith('```'):
                response_text = response_text.replace('```', '').strip()
            
            # Parse JSON response
            parsed_data = json.loads(response_text)
            
            # Validate and return as Pydantic model
            result = WorkoutParseResponse(**parsed_data)
            
            # Log successful parsing
            if trace:
                trace.update(
                    output=result.model_dump(),
                    metadata={"status": "success", "workout_name": result.name}
                )
            
            return result
            
        except json.JSONDecodeError as e:
            error_msg = f"Failed to parse LLM response as JSON: {e}"
            if trace:
                trace.update(metadata={"status": "error", "error": error_msg})
            raise ValueError(error_msg)
        except openai.OpenAIError as e:
            error_msg = f"OpenAI API error: {e}"
            if trace:
                trace.update(metadata={"status": "error", "error": error_msg})
            raise ValueError(error_msg)
        except Exception as e:
            error_msg = f"Error parsing workout: {e}"
            if trace:
                trace.update(metadata={"status": "error", "error": error_msg})
            raise ValueError(error_msg)
    
    @staticmethod
    def _get_fallback_prompt() -> str:
        """Get fallback system prompt if Langfuse is not available"""
        return """You are a fitness expert assistant that parses workout descriptions into structured data.

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
}"""