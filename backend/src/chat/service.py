from typing import Optional, List, Dict, Any
from datetime import date

from langfuse import Langfuse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.rate_limiters import InMemoryRateLimiter

from src.core.config import settings
from src.chat.crud import (
    get_or_create_active_conversation,
    add_message_to_conversation,
    get_conversation_by_id,
    get_user_conversations,
)
from src.chat.llm_client import (
    ConversationMessage,
    GeminiLangChainClient,
    LLMClient,
    ToolDefinition,
)
from src.chat.schemas import ConversationMessageCreate
from src.exercises.crud import get_exercise_types, get_exercise_type_stats
from src.workouts.crud import get_latest_workout_for_user, get_workout_by_date
from src.exercises.crud import get_exercises_for_workout


class LastExercisePerformanceArgs(BaseModel):
    exercise_name: str


class WorkoutSummaryByDateArgs(BaseModel):
    workout_date: str


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

        exercise_types_response = await get_exercise_types(
            self.session, name=exercise_name, limit=1
        )
        if not exercise_types_response.data:
            return f"No exercise named '{exercise_name}' found."

        exercise_type = exercise_types_response.data[0]
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

    async def _parse_workout_and_save(self, **kwargs) -> str:
        """
        Receives structured workout data from the LLM and saves it to the database.
        """
        if self._workout_saved_this_request:
            return "WORKOUT ALREADY SAVED. A workout has already been logged in this conversation turn. No action taken."

        try:
            from src.workouts.schemas import WorkoutParseResponse

            parsed_workout = WorkoutParseResponse(**kwargs)

            if not self.session:
                return "Failed to save workout: no database session available."

            from src.workouts.service import WorkoutService

            await WorkoutService.create_workout_from_parsed(
                self.session, self.user_id, parsed_workout
            )

            self._workout_saved_this_request = True
            exercise_count = len(parsed_workout.exercises)
            return f"WORKOUT SAVED SUCCESSFULLY. Name: '{parsed_workout.name}', Exercises: {exercise_count}. Do not call this tool again for this workout."
        except Exception as e:
            return f"Failed to save workout: {str(e)}"

    def _get_tools(self) -> List[ToolDefinition]:
        """
        Returns the internal tool definitions available to the LLM.
        """
        from src.workouts.schemas import WorkoutParseResponse

        return [
            ToolDefinition(
                name="get_last_exercise_performance",
                handler=self._get_last_exercise_performance,
                args_model=LastExercisePerformanceArgs,
                description="Useful for when you need to find out the user's last recorded performance for a specific exercise. Input should be the exact name of the exercise.",
            ),
            ToolDefinition(
                name="parse_workout",
                handler=self._parse_workout_and_save,
                args_model=WorkoutParseResponse,
                description="""Use this tool when the user provides a workout they want to log.
The input should be the structured workout data including:
- name: A name for the workout
- workout_type_id: 1(Low Intensity), 2(HIIT), 3(Sports), 4(Strength), 5(Mobility), 6(Other)
- notes: Optional workout notes
- exercises: List of exercises, each with exercise_type_name, optional notes, and sets (reps, intensity, intensity_unit, rest_time_seconds)
""",
            ),
            ToolDefinition(
                name="get_last_workout_summary",
                handler=self._get_last_workout_summary,
                description="Use this tool when the user asks a general question about their most recent or last workout, like 'what did I do last time?' or 'give me my last workout'. This tool does not require any input.",
            ),
            ToolDefinition(
                name="get_workout_summary_by_date",
                handler=self._get_workout_summary_by_date,
                args_model=WorkoutSummaryByDateArgs,
                description="Useful for when you need to find out what the user did in their workout on a specific date. Input should be the date in YYYY-MM-DD format.",
            ),
        ]

    """Service for handling chat interactions with Langfuse observability."""

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
        self.rate_limiter = InMemoryRateLimiter(
            requests_per_second=0.5,
            check_every_n_seconds=0.5,
            max_bucket_size=3,
        )

    def _get_llm_client(self) -> LLMClient:
        if self._llm_client is None:
            self._llm_client = GeminiLangChainClient(
                api_key=settings.GOOGLE_AI_KEY,
                rate_limiter=self.rate_limiter,
            )
        return self._llm_client

    def _get_langfuse_client(self) -> Optional[Langfuse]:
        """Initialize Langfuse client if configured."""
        if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
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
            except Exception as e:
                print(f"Warning: Could not fetch prompt from Langfuse: {e}")

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
        """Generate a response from Gemini 2.5 Flash, with Langfuse tracing and optional DB persistence."""
        if not settings.GOOGLE_AI_KEY:
            raise ValueError("Google AI API key not configured")

        conversation = None
        if save_to_db and self.session:
            if conversation_id:
                conversation = await get_conversation_by_id(
                    self.session, conversation_id, self.user_id
                )
                if not conversation:
                    raise ValueError(f"Conversation {conversation_id} not found")
            else:
                first_user_msg = next(
                    (msg for msg in messages if msg["role"] == "user"), None
                )
                title = None
                if first_user_msg:
                    content = first_user_msg["content"]
                    title = content[:50] + "..." if len(content) > 50 else content

                conversation = await get_or_create_active_conversation(
                    self.session, self.user_id, title
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
                },
            )

        try:
            tools = self._get_tools()
            tool_registry = {tool.name: tool for tool in tools}

            system_prompt = self._get_system_prompt()
            conversation_messages = [ConversationMessage(role="system", content=system_prompt)]

            for message in messages:
                if message["role"] == "user":
                    conversation_messages.append(
                        ConversationMessage(role="user", content=message["content"])
                    )
                elif message["role"] == "assistant":
                    conversation_messages.append(
                        ConversationMessage(
                            role="assistant", content=message["content"]
                        )
                    )

            max_tool_iterations = settings.CHAT_MAX_TOOL_ITERATIONS
            iteration_count = 0
            last_tool_outputs_texts: List[str] = []
            response_text = ""

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

                response = await llm_client.acomplete(conversation_messages, tools)
                conversation_messages.append(response.message)

                if response.tool_calls:
                    print(f"DEBUG: Tool calls detected: {response.tool_calls}")
                    tool_output_messages: List[ConversationMessage] = []

                    for tool_call in response.tool_calls:
                        print(
                            f"DEBUG: Calling tool {tool_call.name} with args: {tool_call.args}"
                        )
                        tool = tool_registry.get(tool_call.name)
                        if tool is None:
                            output = f"Error: Tool {tool_call.name} not found."
                        else:
                            try:
                                output = await tool.ainvoke(tool_call.args)
                                print(
                                    f"DEBUG: Tool {tool_call.name} output: {output}"
                                )
                            except Exception as e:
                                print(
                                    f"DEBUG: Exception in tool {tool_call.name}: {str(e)}"
                                )
                                output = (
                                    f"Error executing tool {tool_call.name}: {str(e)}"
                                )

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
                    conversation_messages.extend(tool_output_messages)
                    continue

                response_text = response.message.content.strip()
                break

            generation = (
                trace.generation(
                    name="user-query-generation",
                    input=[
                        {"role": msg.role, "content": msg.content}
                        for msg in conversation_messages
                    ],
                    model=llm_client.model_name,
                )
                if trace
                else None
            )

            if generation:
                generation.end(output=response_text or "(no content)")

            if save_to_db and self.session and conversation:
                for message in messages:
                    if message["role"] in ["user", "assistant"]:
                        await add_message_to_conversation(
                            self.session,
                            conversation.id,
                            ConversationMessageCreate(
                                role=message["role"], content=message["content"]
                            ),
                            self.user_id,
                        )

                await add_message_to_conversation(
                    self.session,
                    conversation.id,
                    ConversationMessageCreate(role="assistant", content=response_text),
                    self.user_id,
                )

            final_message = response_text
            if not final_message:
                if last_tool_outputs_texts:
                    final_message = (
                        "Here is the result from the requested tool:\n"
                        + "\n\n".join(last_tool_outputs_texts)
                    )
                else:
                    final_message = "I completed the requested operation."

            return {
                "message": final_message,
                "conversation_id": conversation.id if conversation else None,
            }

        except Exception as e:
            if trace:
                trace.update(metadata={"status": "error", "error": str(e)})

            error_msg = str(e)
            if "429" in error_msg or "ResourceExhausted" in error_msg:
                raise ValueError(
                    "The AI service is currently busy (quota exceeded). Please try again in a minute."
                )

            raise ValueError(f"Error generating response with Gemini: {e}")

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
