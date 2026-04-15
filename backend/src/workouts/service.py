import logging
from typing import Optional, List
import json
from types import SimpleNamespace
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
from google import genai
from google.genai import types
from datetime import datetime, timezone, timedelta
from langfuse import Langfuse

from src.workouts.crud import (
    get_workout_by_id,
    create_workout,
    update_workout,
    get_workout_types,
    create_workout_type,
    get_user_workouts,
    get_latest_workout_for_user,
    get_stale_open_workouts,
)
from src.workouts.models import Workout, WorkoutType
from src.workouts.schemas import (
    WorkoutCreate,
    WorkoutUpdate,
    WorkoutTypeCreate,
    WorkoutParseResponse,
    AddExerciseRequest,
)
from src.core.config import settings
from src.exercises.crud import (
    create_exercise,
    get_exercise_types,
    create_exercise_type,
    get_intensity_units,
)
from src.exercises.models import Exercise
from src.exercises.intensity_units import (
    DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS,
    prefers_duration_for_intensity_unit,
)
from src.exercise_sets.crud import create_exercise_set
from src.exercises.schemas import ExerciseCreate, ExerciseTypeCreate
from src.exercise_sets.schemas import ExerciseSetCreate

logger = logging.getLogger(__name__)


# Seed data defines Strength Training workout type with ID = 4 (see migration 7df0abdd1d04)
DEFAULT_STRENGTH_TRAINING_WORKOUT_TYPE_ID = 4
WORKOUT_REUSE_WINDOW_HOURS = 12


class ChatGoogleGenerativeAI:
    """Compatibility adapter over google.genai used by workout parsing tests."""

    def __init__(
        self,
        *,
        google_api_key: str,
        model: str,
        temperature: float,
        max_output_tokens: int,
    ) -> None:
        self.google_api_key = google_api_key
        self.model = model
        self.temperature = temperature
        self.max_output_tokens = max_output_tokens
        self.client = genai.Client(api_key=google_api_key)

    async def ainvoke(self, messages):
        system_instruction = None
        contents = []

        for message in messages:
            role = getattr(message, "type", None) or getattr(message, "role", "user")
            content = getattr(message, "content", "")

            if role == "system":
                system_instruction = content
                continue

            contents.append(
                types.Content(
                    role="user" if role in {"human", "user"} else "model",
                    parts=[types.Part.from_text(text=content)],
                )
            )

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=self.temperature,
                max_output_tokens=self.max_output_tokens,
                system_instruction=system_instruction,
            ),
        )
        return SimpleNamespace(content=response.text or "")


class WorkoutService:
    """Service layer for workout business logic"""

    @staticmethod
    async def get_workout(
        session: AsyncSession, workout_id: int, user_id: int
    ) -> Optional[Workout]:
        """Get a workout by ID for a specific user"""
        return await get_workout_by_id(session, workout_id, user_id)

    @staticmethod
    async def get_my_workouts(
        session: AsyncSession,
        user_id: int,
        limit: int = 100,
        cursor: Optional[int] = None,
    ) -> List[Workout]:
        """Get workouts for a user using keyset pagination"""
        return await get_user_workouts(session, user_id, limit, cursor)

    @staticmethod
    async def create_new_workout(
        session: AsyncSession, workout_data: WorkoutCreate, user_id: int
    ) -> Workout:
        """Create a new workout with business logic validation"""
        # Add any business logic here (e.g., validation, default values)
        return await create_workout(session, workout_data, user_id)

    @staticmethod
    async def update_workout_data(
        session: AsyncSession,
        workout_id: int,
        workout_data: WorkoutUpdate,
        user_id: int,
    ) -> Optional[Workout]:
        """Update workout data with business logic validation"""
        # Add any business logic here (e.g., validation, authorization)
        return await update_workout(session, workout_id, workout_data, user_id)

    @staticmethod
    async def close_stale_open_workouts(
        session: AsyncSession,
        *,
        max_age_hours: int = 24,
    ) -> int:
        """Auto-close open workouts whose start time is older than the max age.

        The close timestamp is capped at `start_time + max_age_hours` so the
        stored workout duration does not grow indefinitely while the workout is
        left open.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        workouts = await get_stale_open_workouts(session, older_than=cutoff)
        if not workouts:
            return 0

        close_delta = timedelta(hours=max_age_hours)
        closed_count = 0
        for workout in workouts:
            if workout.start_time is None:
                continue
            workout.end_time = workout.start_time + close_delta
            closed_count += 1

        if closed_count == 0:
            return 0

        await session.commit()
        return closed_count

    @staticmethod
    async def remove_workout(
        session: AsyncSession, workout_id: int, user_id: int
    ) -> bool:
        """Remove a workout idempotently (204 semantics at router).

        Performs a conditional DELETE filtered by owner to avoid leaking
        existence and to make retries safe. Returns True regardless of
        prior state.
        """
        await session.execute(
            delete(Workout).where(Workout.id == workout_id, Workout.owner_id == user_id)
        )
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        return True

    @staticmethod
    async def add_exercise_to_current_workout(
        session: AsyncSession,
        user_id: int,
        payload: AddExerciseRequest,
    ) -> Workout:
        """Add an exercise to the current workout, creating one if necessary.

        Heuristic: Reuses the latest workout if it was started within the last 12 hours.
        Otherwise, creates a new workout with a default name based on the current UTC date.
        """
        # 1. Check if the latest workout is "recent enough" and NOT finished
        now = datetime.now(timezone.utc)
        workout = await get_latest_workout_for_user(session, user_id)

        # A workout is "current" if:
        # 1. It exists
        # 2. It hasn't been finished (end_time is None)
        # 3. It was started within the last X hours
        is_current = (
            workout
            and workout.end_time is None
            and (now - workout.start_time) < timedelta(hours=WORKOUT_REUSE_WINDOW_HOURS)
        )

        if not is_current:
            # Need to create a new workout
            workout_create = WorkoutCreate(
                name=now.strftime("Workout %Y-%m-%d"),
                start_time=now,
                workout_type_id=DEFAULT_STRENGTH_TRAINING_WORKOUT_TYPE_ID,  # Default Strength Training
            )
            workout = await create_workout(session, workout_create, user_id)

        # 3. Check if exercise type already exists in workout with a narrow lookup.
        exercise_id = await session.scalar(
            select(Exercise.id)
            .where(
                Exercise.workout_id == workout.id,
                Exercise.exercise_type_id == payload.exercise_type_id,
                Exercise.deleted_at.is_(None),
            )
            .order_by(Exercise.id.asc())
            .limit(1)
        )
        if exercise_id is None:
            # create new exercise
            exercise_create = ExerciseCreate(
                timestamp=datetime.now(timezone.utc),
                exercise_type_id=payload.exercise_type_id,
                workout_id=workout.id,
            )
            exercise = await create_exercise(
                session,
                exercise_create,
                user_id=user_id,
            )
            exercise_id = exercise.id

        # 4. Add initial set if provided
        if payload.initial_set:
            initial_set_create = ExerciseSetCreate(
                reps=payload.initial_set.reps,
                duration_seconds=payload.initial_set.duration_seconds,
                intensity=payload.initial_set.intensity,
                rpe=payload.initial_set.rpe,
                rir=payload.initial_set.rir,
                intensity_unit_id=payload.initial_set.intensity_unit_id,
                rest_time_seconds=payload.initial_set.rest_time_seconds,
                exercise_id=exercise_id,
                done=False,  # New set is not done by default
            )
            await create_exercise_set(session, initial_set_create)

        # 5. Return the workout with fresh relationships
        return await get_workout_by_id(session, workout.id, user_id)

    @staticmethod
    async def create_workout_from_parsed(
        session: AsyncSession, user_id: int, parsed: WorkoutParseResponse
    ) -> Workout:
        """Create a full workout (workout + exercises + sets) from a parsed payload.

        - Creates a new workout using parsed name/notes/type
        - For each parsed exercise:
          - Finds or creates the exercise type by name
          - Creates the exercise attached to the workout
          - Creates its sets, mapping intensity_unit (string) to intensity_unit_id
        """
        # 1) Create the workout
        workout_create = WorkoutCreate(
            name=parsed.name,
            notes=parsed.notes,
            start_time=datetime.now(timezone.utc),
            workout_type_id=parsed.workout_type_id,
        )
        workout = await create_workout(session, workout_create, user_id)

        # Preload intensity units for mapping
        intensity_units = await get_intensity_units(session)
        if intensity_units is None:
            intensity_units = []

        def resolve_intensity_unit_id(unit_text: Optional[str]) -> Optional[int]:
            if not unit_text:
                return None
            text = unit_text.strip().lower()

            # Simple normalization / synonyms
            synonyms = {
                "min": "time-based",
                "mins": "time-based",
                "minute": "time-based",
                "minutes": "time-based",
                "sec": "time-based",
                "secs": "time-based",
                "second": "time-based",
                "seconds": "time-based",
                "hr": "time-based",
                "hour": "time-based",
                "hours": "time-based",
                # Common weight units
                "kg": "kg",
                "kilograms": "kg",
                "lbs": "lbs",
                "pounds": "lbs",
                # Distance (if present in your units)
                "miles": "miles",
                "mile": "miles",
                "km": "km",
                "kilometers": "km",
                # Speed (if present)
                "mph": "mph",
                "km/h": "km/h",
                # Bodyweight
                "bw": "bodyweight",
                "bodyweight": "bodyweight",
                # Generic
                "time": "time-based",
            }

            canonical = synonyms.get(text, text)

            # Match by name OR abbreviation
            for unit in intensity_units:
                if (
                    unit.name.lower() == canonical
                    or unit.abbreviation.lower() == canonical
                ):
                    return unit.id

            # Fallback: try to find time-based if minutes-like
            if canonical in {
                "time-based",
                "minutes",
                "minute",
                "min",
                "mins",
                "seconds",
                "second",
                "sec",
                "secs",
                "hour",
                "hours",
            }:
                for unit in intensity_units:
                    if unit.name.lower() == "time-based":
                        return unit.id

            # As a last resort, return the first unit to avoid NULL constraint issues
            return intensity_units[0].id if intensity_units else None

        # 2) Create exercises and sets
        for parsed_ex in parsed.exercises:
            # Attempt to find an existing exercise type (fuzzy search already supported)
            exercise_types = await get_exercise_types(
                session,
                name=parsed_ex.exercise_type_name,
                limit=1,
                user_id=user_id,
            )
            exercise_type = None
            if exercise_types.data:
                # Prefer exact case-insensitive match if available among returned
                exact = next(
                    (
                        et
                        for et in exercise_types.data
                        if et.name.lower() == parsed_ex.exercise_type_name.lower()
                    ),
                    None,
                )
                exercise_type = exact or exercise_types.data[0]
            else:
                # Need to create a new exercise type. Use the first set's unit as default if available
                first_unit_id = None
                if parsed_ex.sets:
                    first_unit_id = resolve_intensity_unit_id(
                        parsed_ex.sets[0].intensity_unit
                    )
                if first_unit_id is None:
                    # fallback to a reasonable default if available, otherwise fail fast
                    if intensity_units:
                        first_unit_id = intensity_units[0].id
                    else:
                        raise ValueError(
                            "Cannot create exercise type: no intensity units are configured in the database."
                        )

                exercise_type = await create_exercise_type(
                    session,
                    ExerciseTypeCreate(
                        name=parsed_ex.exercise_type_name,
                        description="Created from chat parsed workout",
                        default_intensity_unit=first_unit_id,
                    ),
                    owner_id=user_id,
                )

            # Create the exercise row
            exercise_create = ExerciseCreate(
                timestamp=datetime.now(timezone.utc),
                notes=parsed_ex.notes,
                exercise_type_id=exercise_type.id,
                workout_id=workout.id,
            )
            exercise = await create_exercise(
                session,
                exercise_create,
                user_id=user_id,
            )

            # Create sets
            for parsed_set in parsed_ex.sets:
                unit_id = resolve_intensity_unit_id(parsed_set.intensity_unit)
                if unit_id is None:
                    if not intensity_units:
                        raise ValueError(
                            "Cannot create exercise set: no intensity units are configured in the database."
                        )
                    unit_id = intensity_units[0].id

                duration_seconds = parsed_set.duration_seconds
                if (
                    duration_seconds is None
                    and parsed_set.reps is None
                    and prefers_duration_for_intensity_unit(parsed_set.intensity_unit)
                ):
                    duration_seconds = DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS

                set_create = ExerciseSetCreate(
                    reps=parsed_set.reps,
                    duration_seconds=duration_seconds,
                    intensity=parsed_set.intensity,
                    rpe=parsed_set.rpe,
                    rir=parsed_set.rir,
                    intensity_unit_id=unit_id,
                    rest_time_seconds=parsed_set.rest_time_seconds,
                    notes=parsed_set.notes,
                    exercise_id=exercise.id,
                    done=True,
                )
                await create_exercise_set(session, set_create)

        # Return the completed workout with relationships
        return await get_workout_by_id(session, workout.id, user_id)


class WorkoutTypeService:
    """Service layer for workout type business logic"""

    @staticmethod
    async def get_all_workout_types(session: AsyncSession) -> List[WorkoutType]:
        """Get all workout types"""
        return await get_workout_types(session)

    @staticmethod
    async def create_new_workout_type(
        session: AsyncSession, workout_type_data: WorkoutTypeCreate
    ) -> WorkoutType:
        """Create a new workout type with business logic validation"""
        # Add any business logic here (e.g., validation, default values)
        return await create_workout_type(session, workout_type_data)


class WorkoutParsingService:
    """Service layer for workout text parsing using LLM with Langfuse observability"""

    @staticmethod
    def _prompt_to_string(prompt_obj) -> str:
        """Normalize Langfuse Prompt object or arbitrary structure to a plain string.

        Handles:
        - Prompt objects with a `.to_string()` helper
        - `.prompt` attribute containing str/list/dict
        - lists of parts with nested {type: "text", text: "..."}
        - generic str() fallback
        """
        try:
            # Prefer a dedicated conversion if present
            if hasattr(prompt_obj, "to_string") and callable(prompt_obj.to_string):
                return prompt_obj.to_string()

            raw = getattr(prompt_obj, "prompt", prompt_obj)
            if isinstance(raw, str):
                return raw

            if isinstance(raw, list):
                parts: List[str] = []
                for part in raw:
                    if isinstance(part, dict):
                        content = part.get("content")
                        if isinstance(content, str):
                            parts.append(content)
                        elif isinstance(content, list):
                            for item in content:
                                if (
                                    isinstance(item, dict)
                                    and item.get("type") == "text"
                                    and "text" in item
                                ):
                                    parts.append(item["text"])
                                elif isinstance(item, str):
                                    parts.append(item)
                    elif isinstance(part, str):
                        parts.append(part)
                return "\n".join(parts)

            # Handle dict with content field
            if isinstance(raw, dict):
                content = raw.get("content")
                if isinstance(content, str):
                    return content
                if isinstance(content, list):
                    return "\n".join(str(x) for x in content)

            return str(raw)
        except Exception:
            return str(prompt_obj)

    @staticmethod
    def _get_langfuse_client() -> Optional[Langfuse]:
        """Get initialized Langfuse client if configured"""
        if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
            return Langfuse(
                public_key=settings.LANGFUSE_PUBLIC_KEY,
                secret_key=settings.LANGFUSE_SECRET_KEY,
                host=settings.LANGFUSE_HOST,
            )
        return None

    @staticmethod
    async def parse_workout_text(workout_text: str) -> WorkoutParseResponse:
        """Parse raw workout text using Gemini LLM with Langfuse observability"""
        if not settings.GOOGLE_AI_KEY:
            raise ValueError("Google AI API key not configured")

        langfuse = WorkoutParsingService._get_langfuse_client()
        trace = None

        try:
            # Initialize Langfuse trace if available
            if langfuse:
                trace = langfuse.trace(
                    name="workout-parsing",
                    metadata={
                        "model": settings.WORKOUT_PARSER_MODEL,
                        "service": "parser-to-json",
                    },
                )

            # Get prompt from Langfuse if available, otherwise use hardcoded prompt
            if langfuse:
                try:
                    prompt = langfuse.get_prompt("parser-to-json", label="production")
                    system_prompt = WorkoutParsingService._prompt_to_string(prompt)

                    # Log prompt usage. Pass the Prompt object, not its internal content list/string
                    if trace:
                        trace.generation(
                            name="prompt-fetch",
                            prompt=prompt,
                            metadata={
                                "prompt_name": "parser-to-json",
                                "label": "production",
                            },
                        )
                except Exception:
                    # Fallback to hardcoded prompt if Langfuse fails
                    logger.warning(
                        "Could not fetch workout parser prompt from Langfuse; using fallback prompt",
                        exc_info=True,
                    )
                    system_prompt = WorkoutParsingService._get_fallback_prompt()
            else:
                system_prompt = WorkoutParsingService._get_fallback_prompt()

            llm = ChatGoogleGenerativeAI(
                google_api_key=settings.GOOGLE_AI_KEY,
                model=settings.WORKOUT_PARSER_MODEL,
                temperature=0.1,
                max_output_tokens=1000,
            )

            messages = [
                SimpleNamespace(type="system", content=system_prompt),
                SimpleNamespace(
                    type="human",
                    content=f"Parse this workout:\n\n{workout_text}",
                ),
            ]

            response = await llm.ainvoke(messages)
            response_text = response.content or ""

            # Log generation to Langfuse
            if trace:
                trace.generation(
                    name="workout-parsing-generation",
                    model=settings.WORKOUT_PARSER_MODEL,
                    input=[
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user",
                            "content": f"Parse this workout:\n\n{workout_text}",
                        },
                    ],
                    output=response_text,
                    metadata={
                        "temperature": 0.1,
                        "max_tokens": 1000,
                    },
                )

            # Try to extract JSON if there's extra text
            if response_text.startswith("```json"):
                response_text = (
                    response_text.replace("```json", "").replace("```", "").strip()
                )
            elif response_text.startswith("```"):
                response_text = response_text.replace("```", "").strip()

            # Parse JSON response
            parsed_data = json.loads(response_text)

            # Validate and return as Pydantic model
            result = WorkoutParseResponse(**parsed_data)

            # Log successful parsing
            if trace:
                trace.update(
                    output=result.model_dump(),
                    metadata={"status": "success", "workout_name": result.name},
                )

            return result

        except json.JSONDecodeError as e:
            error_msg = f"Failed to parse LLM response as JSON: {e}"
            if trace:
                trace.update(metadata={"status": "error", "error": error_msg})
            raise ValueError(error_msg)
        except Exception as e:
            error_msg = f"Error parsing workout with Gemini: {e}"
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
   - 6: Other
3. Optional notes about the workout
4. List of exercises with:
   - Exercise name (standardized, e.g., "Bench Press", "Squat", "Deadlift")
   - Exercise notes (optional)
   - Sets with reps or duration_seconds, weight/intensity, intensity unit, and optional set notes

Intensity units should be one of: "kg", "lbs", "km/h", "mph", "BW" (bodyweight)
For "km/h" and "mph", prefer duration_seconds over reps when the set is time-based.

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
          "duration_seconds": number or null,
          "intensity": number or null,
          "rpe": number or null,
          "rir": number or null,
          "intensity_unit": "string",
          "rest_time_seconds": number or null,
          "notes": "string or null"
        }
      ]
    }
  ]
}"""
