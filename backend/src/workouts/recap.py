import logging
import json
from decimal import Decimal
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from google import genai
from google.genai import types
from langfuse import Langfuse

from src.core.config import settings
from src.workouts.crud import get_workout_by_id
from src.exercises.crud import get_exercise_type_stats, get_exercises_for_workout
from src.exercises.intensity_units import convert_intensity_value

logger = logging.getLogger(__name__)


class WorkoutRecapService:
    @staticmethod
    def _serialize_metric_value(value: Decimal | int | float | None) -> int | float:
        if value is None:
            return 0

        if isinstance(value, Decimal):
            if value == value.to_integral_value():
                return int(value)
            return float(value)

        if isinstance(value, int):
            return value

        if value.is_integer():
            return int(value)
        return value

    @staticmethod
    def _get_display_intensity_unit(stats: dict, current_sets: list) -> str | None:
        intensity_unit = stats.get("intensityUnit") or {}
        abbreviation = intensity_unit.get("abbreviation")
        if abbreviation:
            return abbreviation

        for exercise_set in current_sets:
            set_unit = getattr(exercise_set, "intensity_unit", None)
            set_abbreviation = getattr(set_unit, "abbreviation", None)
            if set_abbreviation:
                return set_abbreviation

        return None

    @staticmethod
    def _get_display_intensity_value(
        exercise_set,
        *,
        target_unit: str | None,
    ) -> Decimal:
        converted_intensity = convert_intensity_value(
            getattr(exercise_set, "intensity", None),
            getattr(exercise_set, "intensity_unit", None),
            target_unit,
        )
        return converted_intensity or Decimal("0")

    @staticmethod
    def _get_langfuse_client() -> Optional[Langfuse]:
        if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
            return Langfuse(
                public_key=settings.LANGFUSE_PUBLIC_KEY,
                secret_key=settings.LANGFUSE_SECRET_KEY,
                host=settings.LANGFUSE_HOST,
            )
        return None

    @staticmethod
    async def generate_recap(
        session: AsyncSession, workout_id: int, user_id: int
    ) -> Optional[str]:
        """Generate an AI recap for a workout and store it."""
        workout = await get_workout_by_id(session, workout_id, user_id)
        if not workout:
            return None

        exercises = await get_exercises_for_workout(session, workout_id)
        if not exercises:
            return "No exercises found for this workout."

        # 1. Gather deterministic metrics
        metrics = []
        for exercise in exercises:
            stats = await get_exercise_type_stats(
                session, exercise.exercise_type_id, user_id
            )

            # Current session stats
            current_sets = [s for s in exercise.exercise_sets if s.deleted_at is None]
            display_intensity_unit = WorkoutRecapService._get_display_intensity_unit(
                stats, current_sets
            )

            current_sets_with_display_intensity = [
                (
                    exercise_set,
                    WorkoutRecapService._get_display_intensity_value(
                        exercise_set,
                        target_unit=display_intensity_unit,
                    ),
                )
                for exercise_set in current_sets
            ]

            # Find the "top set" using the same display unit as the historical stats.
            top_set = max(
                current_sets_with_display_intensity,
                key=lambda item: (item[1], item[0].reps or 0),
                default=None,
            )

            current_top_intensity = top_set[1] if top_set else Decimal("0")
            current_top_set_reps = top_set[0].reps or 0 if top_set else 0
            current_total_sets = len(current_sets)
            current_total_reps = sum(s.reps or 0 for s in current_sets)
            current_total_volume = sum(
                intensity_value * (exercise_set.reps or 0)
                for exercise_set, intensity_value in current_sets_with_display_intensity
            )

            # Historical stats (progressiveOverload list contains historical points)
            history = stats.get("progressiveOverload", [])
            # Filter out current session from history if it's already there
            workout_date_str = workout.start_time.date().isoformat()
            history_excluding_today = [
                h for h in history if h["date"] < workout_date_str
            ]

            prev_session = (
                history_excluding_today[-1] if history_excluding_today else None
            )

            metric = {
                "exercise_name": exercise.exercise_type.name,
                "intensity_unit": display_intensity_unit,
                "current": {
                    "sets": current_total_sets,
                    "total_reps": current_total_reps,
                    "top_set_intensity_achieved": WorkoutRecapService._serialize_metric_value(
                        current_top_intensity
                    ),
                    "top_set_reps": current_top_set_reps,
                    "total_volume": WorkoutRecapService._serialize_metric_value(
                        current_total_volume
                    ),
                },
                "is_pr": False,
            }

            # Include exercise-level notes
            if exercise.notes:
                metric["exercise_notes"] = exercise.notes

            # Include set-level notes if any exist
            set_notes = [s.notes for s in current_sets if s.notes]
            if set_notes:
                metric["set_notes"] = set_notes

            if prev_session:
                metric["previous"] = {
                    "max_intensity": prev_session["maxWeight"],
                    "volume": prev_session["totalVolume"],
                }
                # PR detection: higher weight or higher volume
                if current_top_intensity > Decimal(str(prev_session["maxWeight"])):
                    metric["is_pr"] = True
                if current_total_volume > Decimal(str(prev_session["totalVolume"])):
                    metric["volume_increased"] = True
            else:
                metric["is_new_exercise"] = True

            metrics.append(metric)

        # 2. Build prompt
        prompt = f"""You are a supportive and expert fitness coach. Your task is to provide a short, evidence-linked recap of a user's workout.
Use the following structured metrics to highlight PRs, volume deltas, and progress.

Workout Name: {workout.name}
Workout Notes: {workout.notes or "None"}

Metrics:
{json.dumps(metrics, indent=2)}

Guidelines:
- Keep it concise (2-4 sentences).
- Each exercise metric includes `intensity_unit` when a unit is available. Use that unit for any specific numbers you mention.
- Use `top_set_intensity_achieved` and `top_set_reps` for specific set highlights (e.g. "165 lbs for 6 reps").
- Use `sets` and `total_reps` for general volume highlights.
- Mention specific improvements (e.g., "Volume increased by 10%", "New PR on Bench Press").
- Incorporate qualitative feedback from workout/exercise/set notes if present (e.g., if the user noted a set "felt easy", suggest increasing weight).
- Be encouraging but grounded in data.
- Suggest one actionable small step for next time (e.g., "Try to add 2.5kg to your top set").
- Do not use placeholders.

Recap:"""

        # 3. Call Gemini
        if not settings.GOOGLE_AI_KEY:
            logger.warning("GOOGLE_AI_KEY not configured, cannot generate recap")
            return "AI recap unavailable (API key missing)."

        langfuse = WorkoutRecapService._get_langfuse_client()
        trace = None
        try:
            if langfuse:
                trace = langfuse.trace(
                    name="workout-recap",
                    user_id=str(user_id),
                    metadata={
                        "model": settings.WORKOUT_RECAP_MODEL,
                        "service": "workout-recap",
                        "workout_id": workout_id,
                        "exercise_count": len(exercises),
                        "workout_name": workout.name,
                    },
                )

            client = genai.Client(api_key=settings.GOOGLE_AI_KEY)
            response = await client.aio.models.generate_content(
                model=settings.WORKOUT_RECAP_MODEL,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=300,
                ),
            )
            recap_text = (
                response.text.strip() if response.text else "Could not generate recap."
            )

            if trace:
                trace.generation(
                    name="workout-recap-generation",
                    model=settings.WORKOUT_RECAP_MODEL,
                    input=[{"role": "user", "content": prompt}],
                    output=recap_text,
                    metadata={
                        "temperature": 0.7,
                        "max_tokens": 300,
                    },
                )
                trace.update(
                    output={"recap": recap_text},
                    metadata={"status": "success"},
                )

            # 4. Save to workout
            workout.recap = recap_text
            await session.commit()

            return recap_text
        except Exception as e:
            if trace:
                trace.update(
                    metadata={
                        "status": "error",
                        "error": str(e),
                    }
                )
            logger.exception("Error generating workout recap")
            return f"Error generating recap: {str(e)}"
