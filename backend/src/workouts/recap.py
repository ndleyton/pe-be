import logging
import json
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from google import genai
from google.genai import types

from src.core.config import settings
from src.workouts.crud import get_workout_by_id
from src.exercises.crud import get_exercise_type_stats, get_exercises_for_workout

logger = logging.getLogger(__name__)


class WorkoutRecapService:
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

            # Find the "top set" (highest weight, then highest reps)
            top_set = max(
                current_sets,
                key=lambda s: (s.intensity or 0, s.reps or 0),
                default=None,
            )

            current_max_weight = top_set.intensity or 0 if top_set else 0
            current_top_set_reps = top_set.reps or 0 if top_set else 0
            current_total_sets = len(current_sets)
            current_total_reps = sum(s.reps or 0 for s in current_sets)
            current_total_volume = sum(
                (s.intensity or 0) * (s.reps or 0) for s in current_sets
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
                "current": {
                    "sets": current_total_sets,
                    "total_reps": current_total_reps,
                    "top_set_weight_achieved": float(current_max_weight),
                    "top_set_reps": current_top_set_reps,
                    "total_volume": float(current_total_volume),
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
                    "max_weight": float(prev_session["maxWeight"]),
                    "volume": float(prev_session["totalVolume"]),
                }
                # PR detection: higher weight or higher volume
                if current_max_weight > prev_session["maxWeight"]:
                    metric["is_pr"] = True
                if current_total_volume > prev_session["totalVolume"]:
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
- Use `top_set_weight_achieved` and `top_set_reps` for specific set highlights (e.g. "165 lbs for 6 reps").
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

        try:
            client = genai.Client(api_key=settings.GOOGLE_AI_KEY)
            response = await client.aio.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=[prompt],
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=300,
                ),
            )
            recap_text = (
                response.text.strip() if response.text else "Could not generate recap."
            )

            # 4. Save to workout
            workout.recap = recap_text
            await session.commit()

            return recap_text
        except Exception as e:
            logger.exception("Error generating workout recap")
            return f"Error generating recap: {str(e)}"
