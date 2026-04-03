import logging
import json
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from google import genai
from google.genai import types
from langfuse import Langfuse

from src.core.config import settings
from src.workouts.crud import get_workout_by_id
from src.exercises.crud import get_exercise_type_stats, get_exercises_for_workout

logger = logging.getLogger(__name__)


class WorkoutRecapService:
    @staticmethod
    def _prompt_to_string(prompt: object) -> str:
        if hasattr(prompt, "to_string") and callable(prompt.to_string):
            return prompt.to_string()

        raw_prompt = getattr(prompt, "prompt", prompt)
        if isinstance(raw_prompt, str):
            return raw_prompt
        if isinstance(raw_prompt, list):
            parts: list[str] = []
            for part in raw_prompt:
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
        return str(raw_prompt)

    @staticmethod
    def _get_fallback_prompt_template() -> str:
        return """You are a supportive and expert fitness coach. Your task is to provide a short, evidence-linked recap of a user's workout.
Use the following structured metrics to highlight PRs, volume deltas, and progress.

Workout Name: {workout_name}
Workout Notes: {workout_notes}

Metrics:
{metrics_json}

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

    @staticmethod
    def _render_prompt(template: str, *, workout_name: str, workout_notes: str, metrics_json: str) -> str:
        return template.format(
            workout_name=workout_name,
            workout_notes=workout_notes,
            metrics_json=metrics_json,
        )

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

        # 3. Call Gemini
        if not settings.GOOGLE_AI_KEY:
            logger.warning("GOOGLE_AI_KEY not configured, cannot generate recap")
            return "AI recap unavailable (API key missing)."

        langfuse = WorkoutRecapService._get_langfuse_client()
        trace = None
        prompt = None
        prompt_context = {
            "workout_name": workout.name,
            "workout_notes": workout.notes or "None",
            "metrics_json": json.dumps(metrics, indent=2),
        }
        try:
            if langfuse:
                trace = langfuse.trace(
                    name="workout-recap",
                    user_id=str(user_id),
                    metadata={
                        "model": "gemini-2.5-flash-lite",
                        "service": "workout-recap",
                        "workout_id": workout_id,
                        "exercise_count": len(exercises),
                        "workout_name": workout.name,
                    },
                )

            prompt_template = WorkoutRecapService._get_fallback_prompt_template()
            if langfuse:
                try:
                    langfuse_prompt = langfuse.get_prompt(
                        "workout-recap", label="production"
                    )
                    prompt_template = WorkoutRecapService._prompt_to_string(
                        langfuse_prompt
                    )

                    if trace:
                        trace.generation(
                            name="prompt-fetch",
                            prompt=langfuse_prompt,
                            metadata={
                                "prompt_name": "workout-recap",
                                "label": "production",
                            },
                        )
                except Exception:
                    logger.warning(
                        "Could not fetch workout recap prompt from Langfuse; using fallback prompt",
                        exc_info=True,
                    )

            try:
                prompt = WorkoutRecapService._render_prompt(
                    prompt_template, **prompt_context
                )
            except Exception:
                logger.warning(
                    "Could not render workout recap prompt template; using fallback prompt",
                    exc_info=True,
                )
                prompt = WorkoutRecapService._render_prompt(
                    WorkoutRecapService._get_fallback_prompt_template(),
                    **prompt_context,
                )

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

            if trace:
                trace.generation(
                    name="workout-recap-generation",
                    model="gemini-2.5-flash-lite",
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
