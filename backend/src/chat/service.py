from typing import Optional, List, Dict, Any
from datetime import date

# Make optional external deps safe at import-time
try:
    from langfuse import Langfuse  # type: ignore
except Exception:  # pragma: no cover - optional dependency in tests
    Langfuse = None  # type: ignore

try:
    from langchain_google_genai import ChatGoogleGenerativeAI  # type: ignore
except Exception:  # pragma: no cover - optional dependency in tests
    ChatGoogleGenerativeAI = None  # type: ignore

from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import Tool
from langchain_core.rate_limiters import InMemoryRateLimiter

from src.core.config import settings
from src.chat.crud import (
    get_or_create_active_conversation,
    add_message_to_conversation,
    get_conversation_by_id,
    get_user_conversations,
)
from src.chat.schemas import ConversationMessageCreate
from src.exercises.crud import get_exercise_types, get_exercise_type_stats
from src.workouts.service import WorkoutParsingService
from src.workouts.crud import get_latest_workout_for_user, get_workout_by_date
from src.exercises.crud import get_exercises_for_workout


class ChatService:
    async def _get_last_exercise_performance(self, exercise_name: str) -> str:
        """
        Retrieves the last recorded performance for a given exercise for the current user.

        Args:
            exercise_name: The name of the exercise (e.g., "deadlift", "bench press").

        Returns:
            A string describing the last performance, or a message indicating no data found.
        """
        if not self.session:
            return "Database session not available."

        # Find the exercise type by name
        exercise_types_response = await get_exercise_types(
            self.session, name=exercise_name, limit=1
        )
        if not exercise_types_response.data:
            return f"No exercise named '{exercise_name}' found."

        exercise_type = exercise_types_response.data[0]

        # Get stats for the exercise type
        stats = await get_exercise_type_stats(self.session, exercise_type.id)

        if not stats or not stats.get("lastWorkout"):
            return f"No workout data found for {exercise_name}."

        last_workout = stats["lastWorkout"]
        intensity_unit = stats.get("intensityUnit")
        unit_abbr = intensity_unit["abbreviation"] if intensity_unit else ""

        return f"On your last {exercise_name} workout on {last_workout['date']}, you did {last_workout['sets']} sets with a max weight of {last_workout['maxWeight']} {unit_abbr}."

    async def _get_last_workout_summary(self) -> str:
        """
        Retrieves a summary of the last recorded workout for the current user.

        Returns:
            A string summarizing the last workout, or a message indicating no data found.
        """
        print(f"DEBUG: _get_last_workout_summary called for user {self.user_id}")

        if not self.session:
            print("DEBUG: No database session available")
            return "Database session not available."

        try:
            workout = await get_latest_workout_for_user(self.session, self.user_id)
            print(f"DEBUG: Found workout: {workout}")
        except Exception as e:
            print(f"DEBUG: Error getting latest workout: {e}")
            return f"Error retrieving workout: {str(e)}"

        if not workout:
            print("DEBUG: No workout found")
            return "No workout history found."

        try:
            exercises = await get_exercises_for_workout(self.session, workout.id)
            print(f"DEBUG: Found {len(exercises) if exercises else 0} exercises")
        except Exception as e:
            print(f"DEBUG: Error getting exercises: {e}")
            return f"Error retrieving exercises: {str(e)}"

        if not exercises:
            return f"Your last workout was '{workout.name}' on {workout.start_time.strftime('%Y-%m-%d')}, but it doesn't have any exercises logged."

        try:
            summary = f"Your last workout was '{workout.name}' on {workout.start_time.strftime('%Y-%m-%d')}. You did the following exercises:\n"

            for exercise in exercises:
                summary += f"- {exercise.exercise_type.name}\n"
                for s in exercise.exercise_sets:
                    # Handle intensity display safely
                    intensity_display = ""
                    if (
                        s.intensity
                        and hasattr(s, "intensity_unit")
                        and s.intensity_unit
                    ):
                        intensity_display = (
                            f" at {s.intensity} {s.intensity_unit.abbreviation}"
                        )
                    elif s.intensity:
                        intensity_display = f" at {s.intensity}"

                    summary += (
                        f"  - Set {s.id}: {s.reps or '?'} reps{intensity_display}\n"
                    )

            print(f"DEBUG: Generated summary: {summary}")
            return summary
        except Exception as e:
            print(f"DEBUG: Error generating summary: {e}")
            return f"Error generating summary: {str(e)}"

    async def _get_workout_summary_by_date(self, workout_date: str) -> str:
        """
        Retrieves a summary of a workout for a given date for the current user.

        Args:
            workout_date: The date of the workout in YYYY-MM-DD format.

        Returns:
            A string summarizing the workout, or a message indicating no data found.
        """
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
            return f"Your workout on {workout_date} ('{workout.name}') doesn't have any exercises logged."

        summary = f"On your workout on {workout_date} ('{workout.name}'), you did the following exercises:\n"

        for exercise in exercises:
            summary += f"- {exercise.exercise_type.name}\n"
            for s in exercise.exercise_sets:
                summary += f"  - Set {s.id}: {s.reps} reps at {s.intensity} {s.intensity_unit.abbreviation}\n"

        return summary

    async def _parse_workout_and_return_json(self, workout_text: str) -> str:
        parsed_workout = await WorkoutParsingService.parse_workout_text(workout_text)

        # If we have a DB session, persist the parsed workout for this user
        try:
            if self.session:
                from src.workouts.service import WorkoutService

                await WorkoutService.create_workout_from_parsed(
                    self.session, self.user_id, parsed_workout
                )
        except Exception as e:
            # Do not fail the tool on persistence issues; return parsed JSON and include a note
            return (
                parsed_workout.model_dump_json()
                + f"\n\n(Note: Failed to save workout to database: {str(e)})"
            )

        return parsed_workout.model_dump_json()

    def _get_tools(self) -> List[Tool]:
        """
        Returns a list of LangChain tools available to the LLM.
        """
        return [
            Tool(
                name="get_last_exercise_performance",
                func=self._get_last_exercise_performance,
                description="Useful for when you need to find out the user's last recorded performance for a specific exercise. Input should be the exact name of the exercise.",
            ),
            Tool(
                name="parse_workout",
                func=self._parse_workout_and_return_json,
                description="Use this tool only when the user provides a detailed text description of a workout they want to log or analyze. Do not use this for general questions about workout history. Input should be the full text description of the workout.",
            ),
            Tool(
                name="get_last_workout_summary",
                func=self._get_last_workout_summary,
                description="Use this tool when the user asks a general question about their most recent or last workout, like 'what did I do last time?' or 'give me my last workout'. This tool does not require any input.",
            ),
            Tool(
                name="get_workout_summary_by_date",
                func=self._get_workout_summary_by_date,
                description="Useful for when you need to find out what the user did in their workout on a specific date. Input should be the date in YYYY-MM-DD format.",
            ),
        ]

    """Service for handling chat interactions with Langfuse observability."""

    def __init__(self, user_id: int, session: Optional[AsyncSession] = None):
        self.user_id = user_id
        self.session = session
        self.langfuse = self._get_langfuse_client()
        self.rate_limiter = InMemoryRateLimiter(
            requests_per_second=3,
            check_every_n_seconds=0.1,
            max_bucket_size=10,
        )

    def _get_langfuse_client(self) -> Optional[Any]:
        """Initialize Langfuse client if configured."""
        if (
            Langfuse is not None
            and settings.LANGFUSE_PUBLIC_KEY
            and settings.LANGFUSE_SECRET_KEY
        ):
            return Langfuse(
                public_key=settings.LANGFUSE_PUBLIC_KEY,
                secret_key=settings.LANGFUSE_SECRET_KEY,
                host=settings.LANGFUSE_HOST,
            )
        return None

    def _get_system_prompt(self) -> str:
        """Returns the system prompt for the fitness chat agent."""
        if self.langfuse:
            try:
                prompt = self.langfuse.get_prompt(
                    "fitness-chat-agent", label="production"
                )

                # Normalize to plain string for the LLM
                raw_prompt = getattr(prompt, "prompt", prompt)

                # Prefer dedicated conversion if available
                if hasattr(prompt, "to_string") and callable(prompt.to_string):
                    return prompt.to_string()

                # Handle common prompt structures (lists of parts/messages)
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
                    if collected_parts:
                        return "\n\n".join(collected_parts)

            except Exception:
                # If anything goes wrong with Langfuse, fall back to default prompt
                pass

        return (
            "You are a helpful fitness assistant. Answer questions concisely and "
            "use tools only when needed."
        )

    async def generate_response(
        self,
        messages: List[Dict[str, Any]],
        conversation_id: Optional[int] = None,
        save_to_db: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate a response to user messages using an LLM with optional tool calls.
        """
        # Basic validation
        if not messages:
            raise ValueError("No messages provided")

        # If no model key, short-circuit with basic echo behavior
        if not settings.GOOGLE_AI_KEY:
            final_text = (
                messages[-1]["content"] if isinstance(messages[-1], dict) else ""
            )
            return {"message": str(final_text), "conversation_id": conversation_id}

        # Instantiate model lazily to avoid import-time dependency issues
        if ChatGoogleGenerativeAI is None:
            raise ValueError(
                "Chat model dependency is not available. Please install langchain-google-genai."
            )

        model = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=settings.GOOGLE_AI_KEY,
            temperature=0.2,
        )

        tools = self._get_tools()
        tool_bound_model = model.bind_tools(tools)

        # Convert incoming dict messages to langchain message objects
        lc_messages = []
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "user":
                lc_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                lc_messages.append(AIMessage(content=content))
            elif role == "system":
                lc_messages.append(SystemMessage(content=content))

        # Insert system prompt at the beginning
        lc_messages.insert(0, SystemMessage(content=self._get_system_prompt()))

        response = await tool_bound_model.ainvoke(lc_messages)

        # If the model returned tool calls, execute them and then ask the model again
        if getattr(response, "tool_calls", []):
            tool_calls = getattr(response, "tool_calls")
            intermediate_messages = []
            for call in tool_calls:
                name = call.get("name")
                args = call.get("args", {})

                tool = next((t for t in tools if t.name == name), None)
                if tool is None:
                    continue

                try:
                    tool_result = await tool.func(**args)
                except Exception as e:  # pragma: no cover - tool errors are surfaced
                    tool_result = f"Tool '{name}' failed: {str(e)}"

                intermediate_messages.append(
                    ToolMessage(content=str(tool_result), tool_call_id=call.get("id", "tool"))
                )

            # Ask the model again with tool results
            lc_messages.extend(intermediate_messages)
            follow_up = await model.ainvoke(lc_messages)

            final_text = getattr(follow_up, "content", None)
            if not final_text:
                # Provide a fallback message per test expectations
                return {
                    "message": "Here is the result from the requested tool: "
                    + str(tool_result),
                    "conversation_id": conversation_id,
                }

            result_message = final_text
        else:
            result_message = getattr(response, "content", "")

        # Optionally persist the conversation/messages
        if save_to_db and self.session:
            try:
                conversation = await get_or_create_active_conversation(
                    self.session, user_id=self.user_id, conversation_id=conversation_id
                )
                await add_message_to_conversation(
                    self.session,
                    conversation_id=conversation.id,
                    message=ConversationMessageCreate(role="user", content=messages[-1]["content"]),
                )
                await add_message_to_conversation(
                    self.session,
                    conversation_id=conversation.id,
                    message=ConversationMessageCreate(role="assistant", content=result_message),
                )
                conversation_id = conversation.id
            except Exception:
                # If persistence fails, still return a result
                pass

        return {"message": result_message, "conversation_id": conversation_id}

    async def load_conversation_history(
        self, conversation_id: int
    ) -> List[Dict[str, Any]]:
        """Load conversation history from database."""
        if not self.session:
            raise ValueError(
                "Database session required for loading conversation history"
            )

        conversation = await get_conversation_by_id(
            self.session, conversation_id, self.user_id
        )

        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")

        # Convert messages to the format expected by the LLM
        messages = []
        for msg in conversation.messages:
            messages.append({"role": msg.role, "content": msg.content})

        return messages

    async def get_user_conversation_list(
        self, limit: int = 20, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get list of user's conversations."""
        if not self.session:
            raise ValueError("Database session required for loading conversations")

        conversations = await get_user_conversations(
            self.session, self.user_id, limit, offset
        )

        return [
            {
                "id": conv.id,
                "title": conv.title,
                "created_at": conv.created_at,
                "updated_at": conv.updated_at,
                "is_active": conv.is_active,
            }
            for conv in conversations
        ]
