import hashlib
import logging
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, ClassVar, Dict, List, Optional
from uuid import uuid4

from langfuse import Langfuse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from src.chat.crud import (
    add_message_to_conversation,
    create_conversation,
    create_chat_attachment,
    get_stale_orphaned_chat_attachments,
    get_chat_attachment_by_id,
    get_conversation_by_id,
    get_user_conversations,
    update_chat_attachment_provider_ref,
)
from src.chat.llm_client import (
    ContentPart,
    ConversationMessage,
    GeminiGenAIClient,
    LLMClient,
    ToolDefinition,
)
from src.chat.schemas import (
    ChatRoutineCreatedEvent,
    ChatRoutineEventRoutine,
    ChatMessage,
    ChatMessagePart,
    ChatWorkoutCreatedEvent,
    ChatWorkoutEventWorkout,
    ConversationCreate,
    ConversationMessageCreate,
)
from src.core.config import settings
from src.exercises.crud import (
    get_exercise_type_stats,
    get_exercise_types,
    get_intensity_units,
)
from src.exercises.intensity_units import (
    DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS,
    prefers_duration_for_intensity_unit,
)
from src.exercises.crud import get_exercises_for_workout
from src.exercises.set_display import format_set_summary
from src.routines.models import Routine
from src.routines.schemas import (
    AdminRoutineCreate,
    ExerciseTemplateCreate,
    SetTemplateCreate,
)
from src.routines.service import routine_service
from src.workouts.crud import (
    get_latest_workout_for_user,
    get_workout_by_date,
    get_workout_types,
)

logger = logging.getLogger(__name__)


class LastExercisePerformanceArgs(BaseModel):
    exercise_name: str


class WorkoutSummaryByDateArgs(BaseModel):
    workout_date: str


class PersonalizedRoutineSetArgs(BaseModel):
    reps: int | None = Field(default=None, ge=1)
    duration_seconds: int | None = Field(default=None, ge=1)
    intensity: Decimal | None = None
    rpe: Decimal | None = None
    intensity_unit: str | None = Field(default=None, min_length=1)

    TIME_KEYWORDS: ClassVar[tuple[str, ...]] = (
        "min",
        "mins",
        "minute",
        "minutes",
        "sec",
        "secs",
        "second",
        "seconds",
        "hr",
        "hrs",
        "hour",
        "hours",
    )

    @staticmethod
    def _extract_numbers(value: str) -> list[Decimal]:
        return [Decimal(match) for match in re.findall(r"\d+(?:\.\d+)?", value)]

    @classmethod
    def _extract_duration_seconds(cls, value: str) -> int | None:
        lowered = value.casefold()
        numbers = cls._extract_numbers(lowered)
        if not numbers:
            return None

        upper_bound = numbers[-1]
        if any(keyword in lowered for keyword in ("hour", "hr")):
            return int(upper_bound * Decimal("3600"))
        if any(keyword in lowered for keyword in ("min", "minute")):
            return int(upper_bound * Decimal("60"))
        if any(keyword in lowered for keyword in ("sec", "second")):
            return int(upper_bound)
        return None

    @classmethod
    def _normalize_reps_text(cls, value: str) -> int | None:
        lowered = value.strip().casefold()
        if not lowered:
            return None

        if any(keyword in lowered for keyword in cls.TIME_KEYWORDS):
            return None

        numbers = cls._extract_numbers(lowered)
        if not numbers:
            return None

        # The routine schema stores a single rep target, so preserve the upper
        # bound when the model emits a range such as 6-8.
        return int(numbers[-1])

    @classmethod
    def _normalize_optional_int(cls, value: Any) -> int | None:
        if value is None or isinstance(value, int):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return None
            if stripped.isdigit():
                return int(stripped)
        return value

    @classmethod
    def _normalize_optional_decimal(cls, value: Any) -> Decimal | None | Any:
        if value is None or isinstance(value, (Decimal, int, float)):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return None

            numbers = cls._extract_numbers(stripped)
            if not numbers:
                return value

            return numbers[-1]
        return value

    @staticmethod
    def _normalize_optional_string(value: Any) -> str | None | Any:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @model_validator(mode="before")
    @classmethod
    def normalize_set_prescription(cls, obj: Any) -> Any:
        if not isinstance(obj, dict):
            return obj

        normalized = dict(obj)
        normalized["duration_seconds"] = cls._normalize_optional_int(
            normalized.get("duration_seconds")
        )
        normalized["intensity"] = cls._normalize_optional_decimal(
            normalized.get("intensity")
        )
        normalized["rpe"] = cls._normalize_optional_decimal(normalized.get("rpe"))
        normalized["intensity_unit"] = cls._normalize_optional_string(
            normalized.get("intensity_unit")
        )
        reps = normalized.get("reps")
        if isinstance(reps, str):
            normalized_reps = cls._normalize_reps_text(reps)
            normalized["reps"] = normalized_reps
            if normalized.get("duration_seconds") is None and normalized_reps is None:
                normalized["duration_seconds"] = cls._extract_duration_seconds(reps)

        return normalized


class PersonalizedRoutineExerciseArgs(BaseModel):
    exercise_type_name: str = Field(..., min_length=1)
    sets: list[PersonalizedRoutineSetArgs] = Field(..., min_length=1)


class PersonalizedRoutineArgs(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    goal_summary: str = Field(..., min_length=1)
    intended_use: str | None = None
    equipment_notes: str = Field(..., min_length=1)
    restrictions: str | None = None
    exercises: list[PersonalizedRoutineExerciseArgs] = Field(..., min_length=1)

    @model_validator(mode="before")
    @classmethod
    def normalize_optional_strings(cls, obj: Any) -> Any:
        if not isinstance(obj, dict):
            return obj

        normalized = dict(obj)
        for field_name in ("description", "intended_use", "restrictions"):
            value = normalized.get(field_name)
            if isinstance(value, str):
                stripped = value.strip()
                normalized[field_name] = stripped or None
        return normalized


class ChatService:
    _LOOKUP_TOKEN_RE = re.compile(r"[^a-z0-9]+")

    @staticmethod
    def _is_provider_busy_error(error_message: str) -> bool:
        lowered = error_message.casefold()
        busy_markers = (
            "429",
            "resourceexhausted",
            "503",
            "unavailable",
            "high demand",
            "try again later",
        )
        return any(marker in lowered for marker in busy_markers)

    @staticmethod
    def _format_optional_notes(label: str, notes: Optional[str]) -> str:
        if not notes:
            return ""
        return f"{label}: {notes}\n"

    def _default_success_message_from_events(self) -> str | None:
        if not self._pending_chat_events:
            return None

        latest_event = self._pending_chat_events[-1]
        if isinstance(latest_event, ChatRoutineCreatedEvent):
            return "I created a routine for you. You can review it below."
        if isinstance(latest_event, ChatWorkoutCreatedEvent):
            return "I logged your workout. You can open it below."
        return None

    @classmethod
    def _format_set_summary(cls, exercise_set: Any) -> str:
        intensity_unit = getattr(exercise_set, "intensity_unit", None)
        rendered_summary = format_set_summary(
            reps=getattr(exercise_set, "reps", None),
            duration_seconds=getattr(exercise_set, "duration_seconds", None),
            intensity=getattr(exercise_set, "intensity", None),
            rpe=getattr(exercise_set, "rpe", None),
            intensity_unit_abbreviation=getattr(intensity_unit, "abbreviation", None),
        )
        summary = f"  - Set {exercise_set.id}: {rendered_summary}\n"
        summary += cls._format_optional_notes(
            "    Set notes", getattr(exercise_set, "notes", None)
        )
        return summary

    @classmethod
    def _format_workout_with_exercises(
        cls, intro: str, workout: Any, exercises: List[Any]
    ) -> str:
        summary = f"{intro}\n"
        summary += cls._format_optional_notes(
            "Workout notes", getattr(workout, "notes", None)
        )

        for exercise in exercises:
            summary += f"- {exercise.exercise_type.name}\n"
            summary += cls._format_optional_notes(
                "  Exercise notes", getattr(exercise, "notes", None)
            )
            for exercise_set in exercise.exercise_sets:
                summary += cls._format_set_summary(exercise_set)

        return summary

    def __init__(
        self,
        user_id: int,
        session: Optional[AsyncSession] = None,
        llm_client: Optional[LLMClient] = None,
    ):
        self.user_id = user_id
        self.session = session
        self.langfuse = self._get_langfuse_client()
        self._llm_client = llm_client
        self._workout_saved_this_request = False
        self._routine_created_this_request = False
        self._pending_chat_events: list[
            ChatWorkoutCreatedEvent | ChatRoutineCreatedEvent
        ] = []

    @classmethod
    def _normalize_lookup_value(cls, value: str) -> str:
        return cls._LOOKUP_TOKEN_RE.sub(" ", value.strip().casefold()).strip()

    @classmethod
    def _normalize_compact_lookup_value(cls, value: str) -> str:
        return cls._LOOKUP_TOKEN_RE.sub("", value.strip().casefold())

    @classmethod
    def _normalize_workout_type_value(cls, value: str) -> str:
        tokens = [
            token
            for token in cls._normalize_lookup_value(value).split()
            if token not in {"training", "workout", "session", "routine"}
        ]
        return " ".join(tokens)

    @classmethod
    def _resolve_single_name_match(
        cls,
        *,
        requested_name: str,
        candidates: list[Any],
        candidate_name_getter,
        entity_label: str,
        compact_match: bool = False,
    ) -> Any:
        normalized_requested = cls._normalize_lookup_value(requested_name)
        normalized_compact_requested = cls._normalize_compact_lookup_value(
            requested_name
        )

        exact_matches = [
            candidate
            for candidate in candidates
            if cls._normalize_lookup_value(candidate_name_getter(candidate))
            == normalized_requested
            or (
                compact_match
                and cls._normalize_compact_lookup_value(
                    candidate_name_getter(candidate)
                )
                == normalized_compact_requested
            )
        ]
        unique_exact_matches = {candidate.id: candidate for candidate in exact_matches}
        if len(unique_exact_matches) == 1:
            return next(iter(unique_exact_matches.values()))
        if len(unique_exact_matches) > 1:
            candidate_names = ", ".join(
                sorted(candidate_name_getter(candidate) for candidate in exact_matches)
            )
            raise ValueError(
                f"Ambiguous {entity_label} '{requested_name}'. Matches: {candidate_names}."
            )

        raise ValueError(f"Unknown {entity_label} '{requested_name}'.")

    async def _resolve_workout_type(self, workout_type_name: str) -> Any:
        if not self.session:
            raise ValueError("Database session not available.")

        requested = workout_type_name.strip()
        workout_types = await get_workout_types(self.session)
        if not workout_types:
            raise ValueError("No workout types are configured.")

        raw_normalized_requested = self._normalize_lookup_value(requested)
        raw_exact_matches = [
            workout_type
            for workout_type in workout_types
            if self._normalize_lookup_value(workout_type.name) == raw_normalized_requested
        ]
        unique_raw_exact_matches = {
            workout_type.id: workout_type for workout_type in raw_exact_matches
        }
        if len(unique_raw_exact_matches) == 1:
            return next(iter(unique_raw_exact_matches.values()))
        if len(unique_raw_exact_matches) > 1:
            names = ", ".join(
                sorted(
                    workout_type.name
                    for workout_type in unique_raw_exact_matches.values()
                )
            )
            raise ValueError(f"Ambiguous workout type '{requested}'. Matches: {names}.")

        normalized_requested = self._normalize_workout_type_value(requested)
        exact_matches = [
            workout_type
            for workout_type in workout_types
            if self._normalize_workout_type_value(workout_type.name)
            == normalized_requested
        ]
        unique_exact_matches = {
            workout_type.id: workout_type for workout_type in exact_matches
        }
        if len(unique_exact_matches) == 1:
            return next(iter(unique_exact_matches.values()))
        if len(unique_exact_matches) > 1:
            names = ", ".join(
                sorted(
                    workout_type.name for workout_type in unique_exact_matches.values()
                )
            )
            raise ValueError(f"Ambiguous workout type '{requested}'. Matches: {names}.")

        contains_matches = [
            workout_type
            for workout_type in workout_types
            if normalized_requested
            and normalized_requested
            in self._normalize_workout_type_value(workout_type.name)
        ]
        unique_contains_matches = {
            workout_type.id: workout_type for workout_type in contains_matches
        }
        if len(unique_contains_matches) == 1:
            return next(iter(unique_contains_matches.values()))

        available_types = ", ".join(
            sorted(workout_type.name for workout_type in workout_types)
        )
        raise ValueError(
            f"Unknown workout type '{requested}'. Available workout types: {available_types}."
        )

    async def _resolve_or_default_workout_type(
        self, workout_type_name: str | None
    ) -> Any:
        if workout_type_name:
            return await self._resolve_workout_type(workout_type_name)

        if not self.session:
            raise ValueError("Database session not available.")

        workout_types = await get_workout_types(self.session)
        if not workout_types:
            raise ValueError("No workout types are configured.")

        def priority(workout_type: Any) -> tuple[int, str]:
            raw = self._normalize_lookup_value(workout_type.name)
            normalized = self._normalize_workout_type_value(workout_type.name)
            if raw == "strength training":
                return (0, raw)
            if raw == "strength":
                return (1, raw)
            if normalized == "strength":
                return (2, raw)
            if "strength" in normalized.split():
                return (3, raw)
            return (4, raw)

        return min(workout_types, key=priority)

    async def _resolve_exercise_type(self, exercise_type_name: str) -> Any:
        if not self.session:
            raise ValueError("Database session not available.")

        response = await get_exercise_types(
            self.session,
            name=exercise_type_name,
            limit=10,
            user_id=self.user_id,
        )
        if not response.data:
            raise ValueError(
                f"Unknown exercise type '{exercise_type_name}'. Please choose a canonical exercise name."
            )

        return self._resolve_single_name_match(
            requested_name=exercise_type_name,
            candidates=list(response.data),
            candidate_name_getter=lambda candidate: candidate.name,
            entity_label="exercise type",
            compact_match=True,
        )

    async def _resolve_intensity_unit(self, intensity_unit_text: str) -> Any:
        if not self.session:
            raise ValueError("Database session not available.")

        intensity_units = await get_intensity_units(self.session)
        if not intensity_units:
            raise ValueError("No intensity units are configured.")

        normalized_requested = self._normalize_lookup_value(intensity_unit_text)
        canonical_requested = {
            "min": "time based",
            "mins": "time based",
            "minute": "time based",
            "minutes": "time based",
            "sec": "time based",
            "secs": "time based",
            "second": "time based",
            "seconds": "time based",
            "hr": "time based",
            "hrs": "time based",
            "hour": "time based",
            "hours": "time based",
            "time": "time based",
            "time based": "time based",
            "kg": "kg",
            "kgs": "kg",
            "kilogram": "kg",
            "kilograms": "kg",
            "lb": "lbs",
            "lbs": "lbs",
            "pound": "lbs",
            "pounds": "lbs",
            "bw": "bodyweight",
            "body weight": "bodyweight",
            "bodyweight": "bodyweight",
        }.get(normalized_requested, normalized_requested)

        matches = [
            unit
            for unit in intensity_units
            if self._normalize_lookup_value(unit.name) == canonical_requested
            or self._normalize_lookup_value(unit.abbreviation) == canonical_requested
        ]
        unique_matches = {unit.id: unit for unit in matches}
        if len(unique_matches) == 1:
            return next(iter(unique_matches.values()))
        if len(unique_matches) > 1:
            names = ", ".join(sorted(unit.name for unit in unique_matches.values()))
            raise ValueError(
                f"Ambiguous intensity unit '{intensity_unit_text}'. Matches: {names}."
            )

        available_units = ", ".join(
            sorted(unit.abbreviation or unit.name for unit in intensity_units)
        )
        raise ValueError(
            f"Unknown intensity unit '{intensity_unit_text}'. Available units: {available_units}."
        )

    async def _resolve_default_intensity_unit(self, exercise_type: Any) -> Any:
        if not self.session:
            raise ValueError("Database session not available.")

        default_unit_id = getattr(exercise_type, "default_intensity_unit", None)
        if default_unit_id is None:
            raise ValueError(
                f"Exercise type '{exercise_type.name}' does not have a default intensity unit. "
                "Provide an intensity_unit."
            )

        intensity_units = await get_intensity_units(self.session)
        if not intensity_units:
            raise ValueError("No intensity units are configured.")

        unit = next(
            (
                candidate
                for candidate in intensity_units
                if candidate.id == default_unit_id
            ),
            None,
        )
        if unit is None:
            raise ValueError(
                f"Exercise type '{exercise_type.name}' references an unknown default intensity unit."
            )
        return unit

    @staticmethod
    def _build_routine_description(draft: PersonalizedRoutineArgs) -> str:
        if draft.description:
            return draft.description

        details = [draft.goal_summary.strip(), draft.equipment_notes.strip()]
        if draft.intended_use:
            details.append(draft.intended_use.strip())
        if draft.restrictions:
            details.append(f"Restrictions: {draft.restrictions.strip()}")
        return ". ".join(detail.rstrip(".") for detail in details if detail).strip()

    @staticmethod
    def _build_routine_created_event(routine: Any) -> ChatRoutineCreatedEvent:
        exercise_templates = list(getattr(routine, "exercise_templates", []) or [])
        set_count = sum(
            len(getattr(exercise_template, "set_templates", []) or [])
            for exercise_template in exercise_templates
        )
        return ChatRoutineCreatedEvent(
            type="routine_created",
            title="Routine created",
            cta_label="View routine",
            routine=ChatRoutineEventRoutine(
                id=routine.id,
                name=routine.name,
                description=routine.description,
                workout_type_id=routine.workout_type_id,
                exercise_count=len(exercise_templates),
                set_count=set_count,
            ),
        )

    async def _get_last_exercise_performance(self, exercise_name: str) -> str:
        if not self.session:
            return "Database session not available."

        exercise_types_response = await get_exercise_types(
            self.session,
            name=exercise_name,
            limit=1,
            user_id=self.user_id,
        )
        if not exercise_types_response.data:
            return f"No exercise named '{exercise_name}' found."

        exercise_type = exercise_types_response.data[0]
        stats = await get_exercise_type_stats(
            self.session, exercise_type.id, self.user_id
        )

        if not stats or not stats.get("lastWorkout"):
            return f"No workout data found for {exercise_name}."

        last_workout = stats["lastWorkout"]
        intensity_unit = stats.get("intensityUnit")
        unit_abbr = intensity_unit["abbreviation"] if intensity_unit else ""

        return (
            f"On your last {exercise_name} workout on {last_workout['date']}, "
            f"you did {last_workout['sets']} sets with a max weight of "
            f"{last_workout['maxWeight']} {unit_abbr}."
        )

    async def _get_last_workout_summary(self) -> str:
        logger.debug("Fetching last workout summary user_id=%s", self.user_id)

        if not self.session:
            logger.debug(
                "Cannot fetch last workout summary without a database session user_id=%s",
                self.user_id,
            )
            return "Database session not available."

        try:
            workout = await get_latest_workout_for_user(self.session, self.user_id)
            logger.debug(
                "Last workout lookup completed user_id=%s found=%s",
                self.user_id,
                bool(workout),
            )
        except Exception as exc:
            logger.exception("Failed to retrieve last workout user_id=%s", self.user_id)
            return f"Error retrieving workout: {exc}"

        if not workout:
            logger.debug("No workout history found user_id=%s", self.user_id)
            return "No workout history found."

        try:
            exercises = await get_exercises_for_workout(self.session, workout.id)
            logger.debug(
                "Loaded exercises for last workout user_id=%s workout_id=%s count=%s",
                self.user_id,
                workout.id,
                len(exercises) if exercises else 0,
            )
        except Exception as exc:
            logger.exception(
                "Failed to retrieve exercises for last workout user_id=%s workout_id=%s",
                self.user_id,
                workout.id,
            )
            return f"Error retrieving exercises: {exc}"

        if not exercises:
            return (
                f"Your last workout was '{workout.name}' on "
                f"{workout.start_time.strftime('%Y-%m-%d')}, but it doesn't have any "
                "exercises logged."
            )

        try:
            summary = self._format_workout_with_exercises(
                (
                    f"Your last workout was '{workout.name}' on "
                    f"{workout.start_time.strftime('%Y-%m-%d')}. "
                    "You did the following exercises:"
                ),
                workout,
                exercises,
            )

            logger.debug(
                "Generated last workout summary user_id=%s workout_id=%s exercise_count=%s",
                self.user_id,
                workout.id,
                len(exercises),
            )
            return summary
        except Exception as exc:
            logger.exception(
                "Failed to generate last workout summary user_id=%s workout_id=%s",
                self.user_id,
                workout.id,
            )
            return f"Error generating summary: {exc}"

    async def _get_workout_summary_by_date(self, workout_date: str) -> str:
        if not self.session:
            return "Database session not available."

        try:
            parsed_date = date.fromisoformat(workout_date)
        except ValueError:
            return "Invalid date format. Please use YYYY-MM-DD."

        workout = await get_workout_by_date(self.session, self.user_id, parsed_date)

        if not workout:
            return f"No workout found on {workout_date}."

        exercises = await get_exercises_for_workout(self.session, workout.id)

        if not exercises:
            return (
                f"Your workout on {workout_date} ('{workout.name}') "
                "doesn't have any exercises logged."
            )

        return self._format_workout_with_exercises(
            f"On your workout on {workout_date} ('{workout.name}'), you did the following exercises:",
            workout,
            exercises,
        )

    async def _parse_workout_and_save(self, **kwargs) -> str:
        if self._workout_saved_this_request:
            return (
                "WORKOUT ALREADY SAVED. A workout has already been logged in this "
                "conversation turn. No action taken."
            )

        try:
            from src.workouts.schemas import WorkoutParseResponse
            from src.workouts.service import WorkoutService

            parsed_workout = WorkoutParseResponse(**kwargs)

            if not self.session:
                return "Failed to save workout: no database session available."

            workout = await WorkoutService.create_workout_from_parsed(
                self.session, self.user_id, parsed_workout
            )

            self._workout_saved_this_request = True
            self._pending_chat_events.append(
                ChatWorkoutCreatedEvent(
                    type="workout_created",
                    title="Workout logged",
                    cta_label="Open workout",
                    workout=ChatWorkoutEventWorkout(
                        id=workout.id,
                        name=workout.name,
                        notes=workout.notes,
                        start_time=workout.start_time,
                        end_time=workout.end_time,
                    ),
                )
            )
            exercise_count = len(parsed_workout.exercises)
            return (
                "WORKOUT SAVED SUCCESSFULLY. "
                f"Name: '{parsed_workout.name}', Exercises: {exercise_count}. "
                "Do not call this tool again for this workout."
            )
        except Exception as exc:
            return f"Failed to save workout: {exc}"

    async def _create_personalized_routine(self, **kwargs) -> str:
        if self._routine_created_this_request:
            return (
                "ROUTINE ALREADY CREATED. A routine has already been created in this "
                "conversation turn. No action taken."
            )

        try:
            draft = PersonalizedRoutineArgs(**kwargs)
            if not self.session:
                return "Failed to create routine: no database session available."

            workout_type = await self._resolve_or_default_workout_type(None)
            exercise_templates: list[ExerciseTemplateCreate] = []
            for exercise_draft in draft.exercises:
                exercise_type = await self._resolve_exercise_type(
                    exercise_draft.exercise_type_name
                )
                set_templates: list[SetTemplateCreate] = []
                for set_draft in exercise_draft.sets:
                    intensity_unit = (
                        await self._resolve_intensity_unit(set_draft.intensity_unit)
                        if set_draft.intensity_unit
                        else await self._resolve_default_intensity_unit(exercise_type)
                    )
                    duration_seconds = set_draft.duration_seconds
                    if (
                        duration_seconds is None
                        and set_draft.reps is None
                        and prefers_duration_for_intensity_unit(intensity_unit)
                    ):
                        duration_seconds = DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS

                    set_templates.append(
                        SetTemplateCreate(
                            reps=set_draft.reps,
                            duration_seconds=duration_seconds,
                            intensity=set_draft.intensity,
                            rpe=set_draft.rpe,
                            intensity_unit_id=intensity_unit.id,
                        )
                    )

                exercise_templates.append(
                    ExerciseTemplateCreate(
                        exercise_type_id=exercise_type.id,
                        set_templates=set_templates,
                    )
                )

            routine = await routine_service.create_routine_admin(
                self.session,
                AdminRoutineCreate(
                    name=draft.name,
                    description=self._build_routine_description(draft),
                    workout_type_id=workout_type.id,
                    exercise_templates=exercise_templates,
                    visibility=Routine.RoutineVisibility.private,
                    is_readonly=False,
                ),
                self.user_id,
            )

            self._routine_created_this_request = True
            self._pending_chat_events.append(self._build_routine_created_event(routine))
            return (
                "ROUTINE CREATED SUCCESSFULLY. "
                f"Name: '{routine.name}', Exercises: {len(routine.exercise_templates)}. "
                "Do not call this tool again for this routine."
            )
        except Exception as exc:
            return f"Failed to create routine: {exc}"

    def _get_tools(self) -> List[ToolDefinition]:
        from src.workouts.schemas import WorkoutParseResponse

        return [
            ToolDefinition(
                name="get_last_exercise_performance",
                handler=self._get_last_exercise_performance,
                args_model=LastExercisePerformanceArgs,
                description=(
                    "Useful for when you need to find out the user's last recorded "
                    "performance for a specific exercise. Input should be the exact "
                    "name of the exercise."
                ),
            ),
            ToolDefinition(
                name="parse_workout",
                handler=self._parse_workout_and_save,
                args_model=WorkoutParseResponse,
                description=(
                    "Use this tool when the user provides a workout they want to log.\n"
                    "The input should be the structured workout data including:\n"
                    "- name: A name for the workout\n"
                    "- workout_type_id: 1(Low Intensity), 2(HIIT), 3(Sports), "
                    "4(Strength), 5(Mobility), 6(Other)\n"
                    "- notes: Optional workout notes\n"
                    "- exercises: List of exercises, each with exercise_type_name, "
                    "optional notes, and sets (either reps or duration_seconds, "
                    "plus optional intensity, rpe, intensity_unit, "
                    "rest_time_seconds, and optional notes)\n"
                ),
            ),
            ToolDefinition(
                name="create_personalized_routine",
                handler=self._create_personalized_routine,
                args_model=PersonalizedRoutineArgs,
                description=(
                    "Use this tool only when the user explicitly asks you to create "
                    "or save a routine. Ask follow-up questions until you have the "
                    "minimum planning context: a primary goal, intended use when "
                    "helpful, and equipment context. This phase supports a "
                    "single saved routine, not a full multi-day split. Use human-"
                    "readable names only: exercise_type_name and intensity_unit. "
                    "The backend will choose the workout type for standard lifting "
                    "routines. For sets, use reps for rep-based work, "
                    "duration_seconds for time-based work, and rpe for effort "
                    "targets such as RPE 7-8. intensity_unit is optional when the "
                    "exercise's default load unit should be used; omit it entirely "
                    "instead of sending an empty string. If you are "
                    "thinking in rep ranges like 6-8 or effort ranges like RPE 7-8, "
                    "choose a single target value. Do not invent internal numeric "
                    "IDs."
                ),
            ),
            ToolDefinition(
                name="get_last_workout_summary",
                handler=self._get_last_workout_summary,
                description=(
                    "Use this tool when the user asks a general question about their "
                    "most recent or last workout, like 'what did I do last time?' or "
                    "'give me my last workout'. This tool does not require any input."
                ),
            ),
            ToolDefinition(
                name="get_workout_summary_by_date",
                handler=self._get_workout_summary_by_date,
                args_model=WorkoutSummaryByDateArgs,
                description=(
                    "Useful for when you need to find out what the user did in their "
                    "workout on a specific date. Input should be the date in "
                    "YYYY-MM-DD format."
                ),
            ),
        ]

    def _get_runtime_instructions(self) -> str:
        return """
Routine creation policy:
- Only create or save a routine when the user explicitly asks for creation or saving.
- If the user wants advice only, respond in prose and do not call create_personalized_routine.
- Before calling create_personalized_routine, gather enough context to avoid a low-quality routine:
  - goal or training focus
  - equipment constraints or gym/home context
  - intended use when it materially affects the single routine
  - injuries or movement restrictions if the user mentions them
- Do not ask the user to disambiguate internal workout type names for standard lifting routines.
- The backend chooses the workout type for create_personalized_routine.
- For create_personalized_routine, use rpe for effort targets like RPE 7-8.
- Do not put RPE or RIR into intensity_unit.
- intensity_unit is the quantitative load or time domain, and can be omitted when the exercise's default unit should apply.
- If intensity_unit is omitted, omit the field entirely; do not send an empty string.
- If the user asks for a multi-day split, explain that you can create one workout routine at a time in this phase.
- Do not call create_personalized_routine more than once per request.
""".strip()

    def _get_llm_client(self) -> LLMClient:
        if self._llm_client is None:
            self._llm_client = GeminiGenAIClient(api_key=settings.GOOGLE_AI_KEY)
        return self._llm_client

    def _get_langfuse_client(self) -> Optional[Langfuse]:
        if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
            return Langfuse(
                public_key=settings.LANGFUSE_PUBLIC_KEY,
                secret_key=settings.LANGFUSE_SECRET_KEY,
                host=settings.LANGFUSE_HOST,
            )
        return None

    def _get_system_prompt(self) -> str:
        if self.langfuse:
            try:
                prompt = self.langfuse.get_prompt(
                    "fitness-chat-agent", label="production"
                )

                raw_prompt = getattr(prompt, "prompt", prompt)

                if hasattr(prompt, "to_string") and callable(prompt.to_string):
                    return prompt.to_string()

                if isinstance(raw_prompt, str):
                    return raw_prompt

                if isinstance(raw_prompt, list):
                    collected_parts = []
                    for part in raw_prompt:
                        if isinstance(part, dict):
                            content = part.get("content")
                            if isinstance(content, str):
                                collected_parts.append(content)
                            elif isinstance(content, list):
                                for item in content:
                                    if (
                                        isinstance(item, dict)
                                        and item.get("type") == "text"
                                        and "text" in item
                                    ):
                                        collected_parts.append(item["text"])
                                    elif isinstance(item, str):
                                        collected_parts.append(item)
                        elif isinstance(part, str):
                            collected_parts.append(part)
                    return "\n".join(collected_parts)

                return str(raw_prompt)
            except Exception:
                logger.warning(
                    "Could not fetch chat prompt from Langfuse; using fallback prompt",
                    exc_info=True,
                )

        return """You are a friendly and encouraging fitness coach and personal trainer.

Your expertise includes:
- Exercise selection and programming
- Form and technique guidance
- Workout planning and periodization
- Nutrition advice for fitness goals
- Recovery and injury prevention
- Motivation and goal setting

Guidelines:
- Be supportive, motivating, and professional
- Provide evidence-based advice
- Ask clarifying questions when needed
- Suggest practical, actionable solutions
- Keep responses conversational but informative
- If unsure about medical issues, recommend consulting healthcare professionals

You can help with questions like:
- "What exercises should I do to improve my bench press?"
- "How should I structure my weekly workout routine?"
- "What are good alternatives to squats?"
- "How do I break through a plateau?"

For workout logs, offer to help analyze performance and suggest improvements."""

    async def generate_response(
        self,
        messages: List[Dict[str, Any]],
        conversation_id: Optional[int] = None,
        save_to_db: bool = True,
    ) -> Dict[str, Any]:
        if not settings.GOOGLE_AI_KEY:
            raise ValueError("Google AI API key not configured")

        self._workout_saved_this_request = False
        self._routine_created_this_request = False
        self._pending_chat_events = []
        conversation = None
        persisted_history: list[ChatMessage] = []
        normalized_messages = self._normalize_incoming_messages(messages)
        if not normalized_messages:
            raise ValueError("At least one chat message is required")

        if save_to_db and self.session:
            if conversation_id:
                conversation = await get_conversation_by_id(
                    self.session, conversation_id, self.user_id
                )
                if not conversation:
                    raise ValueError(f"Conversation {conversation_id} not found")
                persisted_history = [
                    self._chat_message_from_orm(message)
                    for message in getattr(conversation, "messages", []) or []
                    if message.role in {"user", "assistant"}
                ]
            else:
                title = self._title_from_messages(normalized_messages)
                conversation = await create_conversation(
                    self.session,
                    ConversationCreate(title=title or "New Chat"),
                    self.user_id,
                )

        new_messages = normalized_messages

        llm_messages = [
            ConversationMessage(
                role="system",
                content=(
                    f"{self._get_system_prompt()}\n\n{self._get_runtime_instructions()}"
                ),
            )
        ]
        llm_messages.extend(
            await self._build_conversation_messages(
                persisted_history, upload_missing=False
            )
        )
        llm_messages.extend(
            await self._build_conversation_messages(new_messages, upload_missing=True)
        )

        llm_client = self._get_llm_client()
        trace = None
        if self.langfuse:
            trace = self.langfuse.trace(
                name="fitness-chat-conversation",
                user_id=str(self.user_id),
                metadata={
                    "model": llm_client.model_name,
                    "conversation_id": conversation.id if conversation else None,
                    "incoming_messages": len(normalized_messages),
                    "new_messages": len(new_messages),
                },
            )

        try:
            tools = self._get_tools()
            tool_registry = {tool.name: tool for tool in tools}
            max_tool_iterations = settings.CHAT_MAX_TOOL_ITERATIONS
            iteration_count = 0
            last_tool_outputs_texts: List[str] = []
            response_text = ""
            llm_metadata: dict[str, Any] = {}

            while True:
                iteration_count += 1
                if iteration_count > max_tool_iterations:
                    if last_tool_outputs_texts:
                        response_text = (
                            "Here is the result from the requested tool:\n"
                            + "\n\n".join(last_tool_outputs_texts)
                        )
                    else:
                        response_text = "I completed the requested operation."
                    break

                response = await llm_client.acomplete(llm_messages, tools)
                llm_metadata = response.metadata
                llm_messages.append(response.message)

                if response.tool_calls:
                    tool_output_messages: List[ConversationMessage] = []

                    for tool_call in response.tool_calls:
                        tool = tool_registry.get(tool_call.name)
                        if tool is None:
                            output = f"Error: Tool {tool_call.name} not found."
                        else:
                            try:
                                output = await tool.ainvoke(tool_call.args)
                            except Exception as exc:
                                logger.exception(
                                    "Tool execution failed user_id=%s tool_name=%s",
                                    self.user_id,
                                    tool_call.name,
                                )
                                output = f"Error executing tool {tool_call.name}: {exc}"

                        tool_output_messages.append(
                            ConversationMessage(
                                role="tool",
                                content=str(output),
                                tool_call_id=tool_call.call_id,
                                tool_name=tool_call.name,
                            )
                        )

                    last_tool_outputs_texts = [
                        message.content for message in tool_output_messages
                    ]
                    llm_messages.extend(tool_output_messages)
                    continue

                response_text = response.message.content.strip()
                break

            final_message = response_text
            if not final_message:
                event_message = self._default_success_message_from_events()
                if event_message:
                    final_message = event_message
                elif last_tool_outputs_texts:
                    final_message = (
                        "Here is the result from the requested tool:\n"
                        + "\n\n".join(last_tool_outputs_texts)
                    )
                else:
                    final_message = "I completed the requested operation."

            if trace:
                trace.update(metadata={"llm": llm_metadata})
                generation = trace.generation(
                    name="user-query-generation",
                    input=[
                        {
                            "role": message.role,
                            "content": message.content,
                            "parts": [
                                {
                                    "type": part.type,
                                    "attachment_id": part.attachment_id,
                                }
                                for part in message.parts
                            ],
                        }
                        for message in llm_messages
                    ],
                    model=llm_client.model_name,
                )
                if generation:
                    generation.end(output=response_text or "(no content)")

            if save_to_db and self.session and conversation:
                for message in new_messages:
                    if message.role not in {"user", "assistant"}:
                        continue
                    await add_message_to_conversation(
                        self.session,
                        conversation.id,
                        self._conversation_message_create_from_chat_message(message),
                        self.user_id,
                    )

                await add_message_to_conversation(
                    self.session,
                    conversation.id,
                    ConversationMessageCreate(
                        role="assistant",
                        content=final_message,
                        parts=[ChatMessagePart(type="text", text=final_message)],
                    ),
                    self.user_id,
                )

            return {
                "message": final_message,
                "conversation_id": conversation.id if conversation else None,
                "events": [
                    event.model_dump(mode="json") for event in self._pending_chat_events
                ],
            }
        except Exception as exc:
            if trace:
                trace.update(metadata={"status": "error", "error": str(exc)})

            error_msg = str(exc)
            if self._is_provider_busy_error(error_msg):
                raise ValueError(
                    "The AI service is currently busy. Please try again in a minute."
                )
            if "malformed function call" in error_msg.casefold():
                raise ValueError(
                    "The AI had trouble formatting its response. Please try again."
                )

            raise ValueError(f"Error generating response with Gemini: {exc}")

    async def save_uploaded_attachment(
        self,
        *,
        filename: str,
        content_type: str,
        data: bytes,
    ):
        if not self.session:
            raise ValueError("Database session required for attachments")

        if not data:
            raise ValueError("Uploaded file is empty")

        if len(data) > settings.CHAT_ATTACHMENT_MAX_BYTES:
            raise ValueError("Uploaded file exceeds size limit")

        declared_mime_type = (content_type or "").split(";")[0].strip().lower()
        width, height, detected_mime_type = self._inspect_image(data)
        if detected_mime_type not in settings.CHAT_ATTACHMENT_ALLOWED_MIME_TYPES:
            raise ValueError("Unsupported image type")
        if declared_mime_type and declared_mime_type != detected_mime_type:
            raise ValueError("Uploaded file content does not match MIME type")

        mime_type = detected_mime_type
        suffix = Path(filename or "upload").suffix or self._suffix_for_mime_type(
            mime_type
        )
        storage_key = f"{uuid4().hex}{suffix}"
        storage_dir = self._attachment_storage_dir()
        storage_dir.mkdir(parents=True, exist_ok=True)
        file_path = storage_dir / storage_key
        file_path.write_bytes(data)

        try:
            return await create_chat_attachment(
                self.session,
                user_id=self.user_id,
                original_filename=filename or "upload",
                storage_key=storage_key,
                mime_type=mime_type,
                size_bytes=len(data),
                sha256=hashlib.sha256(data).hexdigest(),
                width=width,
                height=height,
            )
        except Exception:
            file_path.unlink(missing_ok=True)
            raise

    async def get_attachment(self, attachment_id: int):
        if not self.session:
            raise ValueError("Database session required for attachments")

        attachment = await get_chat_attachment_by_id(
            self.session, attachment_id, self.user_id
        )
        if not attachment:
            raise ValueError("Attachment not found")
        return attachment

    async def load_conversation_history(
        self, conversation_id: int
    ) -> List[Dict[str, Any]]:
        if not self.session:
            raise ValueError(
                "Database session required for loading conversation history"
            )

        conversation = await get_conversation_by_id(
            self.session, conversation_id, self.user_id
        )

        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")

        return [
            self._chat_message_from_orm(message).model_dump(exclude_none=True)
            for message in conversation.messages
        ]

    async def get_user_conversation_list(
        self, limit: int = 20, offset: int = 0
    ) -> List[Dict[str, Any]]:
        if not self.session:
            raise ValueError("Database session required for loading conversations")

        conversations = await get_user_conversations(
            self.session, self.user_id, limit, offset
        )

        return [
            {
                "id": conversation.id,
                "title": conversation.title,
                "created_at": conversation.created_at,
                "updated_at": conversation.updated_at,
                "is_active": conversation.is_active,
            }
            for conversation in conversations
        ]

    @classmethod
    async def cleanup_orphaned_attachments(
        cls,
        session: AsyncSession,
        *,
        older_than_hours: Optional[int] = None,
        batch_size: Optional[int] = None,
    ) -> int:
        threshold = datetime.now(timezone.utc) - timedelta(
            hours=older_than_hours or settings.CHAT_ATTACHMENT_ORPHAN_TTL_HOURS
        )
        attachments = await get_stale_orphaned_chat_attachments(
            session,
            older_than=threshold,
            limit=batch_size or settings.CHAT_ATTACHMENT_CLEANUP_BATCH_SIZE,
        )
        if not attachments:
            return 0

        storage_dir = Path(settings.CHAT_ATTACHMENT_STORAGE_DIR).expanduser().resolve()
        deleted_count = 0
        for attachment in attachments:
            try:
                (storage_dir / attachment.storage_key).unlink(missing_ok=True)
            except OSError:
                logger.warning(
                    "Failed to remove stale chat attachment file attachment_id=%s",
                    attachment.id,
                    exc_info=True,
                )
            await session.delete(attachment)
            deleted_count += 1

        await session.commit()
        return deleted_count

    async def _build_conversation_messages(
        self,
        messages: List[ChatMessage],
        *,
        upload_missing: bool,
    ) -> List[ConversationMessage]:
        built_messages: list[ConversationMessage] = []
        for message in messages:
            parts = []
            for part in self._normalize_parts(message):
                if part.type == "text":
                    parts.append(ContentPart(type="text", text=part.text))
                    continue

                attachment = await self.get_attachment(part.attachment_id)
                if upload_missing and not attachment.provider_file_uri:
                    uploaded = await self._get_llm_client().aupload_file(
                        path=self._attachment_file_path(attachment.storage_key),
                        mime_type=attachment.mime_type,
                        display_name=attachment.original_filename,
                    )
                    attachment = await update_chat_attachment_provider_ref(
                        self.session,
                        attachment,
                        provider_file_name=uploaded.name,
                        provider_file_uri=uploaded.uri,
                    )

                if not attachment.provider_file_uri:
                    raise ValueError(
                        f"Attachment {attachment.id} is not ready for Gemini processing"
                    )

                parts.append(
                    ContentPart(
                        type="image",
                        attachment_id=attachment.id,
                        mime_type=attachment.mime_type,
                        file_uri=attachment.provider_file_uri,
                    )
                )

            built_messages.append(
                ConversationMessage(
                    role=message.role,
                    content=self._summarize_parts(self._normalize_parts(message)),
                    parts=parts,
                )
            )
        return built_messages

    def _chat_message_from_orm(self, db_message) -> ChatMessage:
        parts = []
        for part in getattr(db_message, "parts", []) or []:
            if part.part_type == "text":
                parts.append(ChatMessagePart(type="text", text=part.text_content or ""))
            elif part.part_type == "image":
                mime_type = part.attachment.mime_type if part.attachment else None
                filename = (
                    part.attachment.original_filename if part.attachment else None
                )
                parts.append(
                    ChatMessagePart(
                        type="image",
                        attachment_id=part.attachment_id,
                        mime_type=mime_type,
                        filename=filename,
                    )
                )

        if not parts and db_message.content:
            parts = [ChatMessagePart(type="text", text=db_message.content)]

        return ChatMessage(
            role=db_message.role,
            content=db_message.content,
            parts=parts,
        )

    def _conversation_message_create_from_chat_message(
        self, message: ChatMessage
    ) -> ConversationMessageCreate:
        parts = self._normalize_parts(message)
        return ConversationMessageCreate(
            role=message.role,
            content=self._summarize_parts(parts),
            parts=parts,
        )

    def _split_new_messages(
        self,
        incoming_messages: List[ChatMessage],
        persisted_history: List[ChatMessage],
    ) -> List[ChatMessage]:
        if not persisted_history:
            return incoming_messages

        persisted_signature = [
            self._message_signature(msg) for msg in persisted_history
        ]
        incoming_signature = [self._message_signature(msg) for msg in incoming_messages]

        if (
            len(incoming_signature) >= len(persisted_signature)
            and incoming_signature[: len(persisted_signature)] == persisted_signature
        ):
            return incoming_messages[len(persisted_signature) :]

        return incoming_messages

    def _message_signature(self, message: ChatMessage) -> tuple[Any, ...]:
        parts = []
        for part in self._normalize_parts(message):
            if part.type == "text":
                parts.append(("text", (part.text or "").strip()))
            else:
                parts.append(("image", part.attachment_id))
        return message.role, tuple(parts)

    def _normalize_parts(self, message: ChatMessage) -> List[ChatMessagePart]:
        if message.parts:
            return message.parts

        content = (message.content or "").strip()
        if not content:
            return []

        return [ChatMessagePart(type="text", text=content)]

    def _summarize_parts(self, parts: List[ChatMessagePart]) -> str:
        text_segments = [
            (part.text or "").strip()
            for part in parts
            if part.type == "text" and part.text
        ]
        if text_segments:
            return "\n".join(segment for segment in text_segments if segment)

        image_count = sum(1 for part in parts if part.type == "image")
        if image_count == 1:
            return "Image attachment"
        if image_count > 1:
            return f"{image_count} image attachments"
        return ""

    def _title_from_messages(self, messages: List[ChatMessage]) -> Optional[str]:
        for message in messages:
            if message.role != "user":
                continue
            summary = self._summarize_parts(self._normalize_parts(message))
            if summary:
                return summary[:50] + "..." if len(summary) > 50 else summary
        return None

    def _normalize_incoming_messages(
        self, messages: List[Dict[str, Any]]
    ) -> List[ChatMessage]:
        normalized_messages = [
            ChatMessage.model_validate(message) for message in messages or []
        ]
        invalid_roles = {
            message.role for message in normalized_messages if message.role != "user"
        }
        if invalid_roles:
            invalid_roles_text = ", ".join(sorted(invalid_roles))
            raise ValueError(
                "Chat requests may only include user messages. "
                f"Received unsupported role(s): {invalid_roles_text}."
            )
        return normalized_messages

    def _attachment_storage_dir(self) -> Path:
        return Path(settings.CHAT_ATTACHMENT_STORAGE_DIR).expanduser().resolve()

    def _attachment_file_path(self, storage_key: str) -> Path:
        return self._attachment_storage_dir() / storage_key

    def _inspect_image(self, data: bytes) -> tuple[int, int, str]:
        try:
            from io import BytesIO

            with Image.open(BytesIO(data)) as image:
                image.verify()
            with Image.open(BytesIO(data)) as image:
                mime_type = Image.MIME.get(image.format or "")
                if not mime_type:
                    raise ValueError("Unsupported image type")
                width, height = image.size
                return width, height, mime_type.lower()
        except UnidentifiedImageError as exc:
            raise ValueError("Uploaded file is not a valid image") from exc

    def _suffix_for_mime_type(self, mime_type: str) -> str:
        return {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/webp": ".webp",
        }.get(mime_type, ".bin")
