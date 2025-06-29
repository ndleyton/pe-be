from typing import Optional, List
import json
from sqlalchemy.ext.asyncio import AsyncSession
import openai

from src.workouts.crud import (
    get_workout_by_id,
    get_user_workouts,
    create_workout,
    update_workout,
    delete_workout,
    get_workout_types,
    create_workout_type
)
from src.workouts.models import Workout, WorkoutType
from src.workouts.schemas import WorkoutCreate, WorkoutUpdate, WorkoutTypeCreate, WorkoutParseResponse
from src.core.config import settings


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


class WorkoutTypeService:
    """Service layer for workout type business logic"""
    
    @staticmethod
    async def get_all_workout_types(session: AsyncSession) -> List[WorkoutType]:
        """Get all workout types"""
        return await get_workout_types(session)
    
    @staticmethod
    async def create_new_workout_type(session: AsyncSession, workout_type_data: WorkoutTypeCreate) -> WorkoutType:
        """Create a new workout type with business logic validation"""
        # Add any business logic here (e.g., validation, duplicate checking)
        return await create_workout_type(session, workout_type_data)


class WorkoutParsingService:
    """Service layer for workout text parsing using LLM"""
    
    @staticmethod
    async def parse_workout_text(workout_text: str) -> WorkoutParseResponse:
        """Parse raw workout text using OpenAI LLM"""
        if not settings.OPENAI_API_KEY:
            raise ValueError("OpenAI API key not configured")
        
        # Set up OpenAI client
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        
        # Define the system prompt for workout parsing
        system_prompt = """You are a fitness expert assistant that parses workout descriptions into structured data.

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

        try:
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
            
            # Try to extract JSON if there's extra text
            if response_text.startswith('```json'):
                response_text = response_text.replace('```json', '').replace('```', '').strip()
            elif response_text.startswith('```'):
                response_text = response_text.replace('```', '').strip()
            
            # Parse JSON response
            parsed_data = json.loads(response_text)
            
            # Validate and return as Pydantic model
            return WorkoutParseResponse(**parsed_data)
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse LLM response as JSON: {e}")
        except openai.OpenAIError as e:
            raise ValueError(f"OpenAI API error: {e}")
        except Exception as e:
            raise ValueError(f"Error parsing workout: {e}")