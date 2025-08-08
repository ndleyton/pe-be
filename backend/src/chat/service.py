from typing import Optional, List, Dict, Any
from datetime import date
from langfuse import Langfuse
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_google_genai import ChatGoogleGenerativeAI
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
                return prompt.prompt
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

        # Handle conversation persistence
        conversation = None
        if save_to_db and self.session:
            if conversation_id:
                conversation = await get_conversation_by_id(
                    self.session, conversation_id, self.user_id
                )
                if not conversation:
                    raise ValueError(f"Conversation {conversation_id} not found")
            else:
                # Generate a title from the first user message if creating new conversation
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

        trace = None
        if self.langfuse:
            trace = self.langfuse.trace(
                name="fitness-chat-conversation",
                user_id=str(self.user_id),
                metadata={
                    "model": "gemini-2.5-flash",
                    "conversation_id": conversation.id if conversation else None,
                },
            )

        try:
            # Initialize Gemini model
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=settings.GOOGLE_AI_KEY,
                temperature=0.7,
                max_tokens=800,
                rate_limiter=self.rate_limiter,
            )

            # Bind tools using the correct method for Gemini integration
            llm = llm.bind_tools(self._get_tools())

            # Convert messages to LangChain format
            system_prompt = self._get_system_prompt()
            langchain_messages = [SystemMessage(content=system_prompt)]

            for message in messages:
                if message["role"] == "user":
                    langchain_messages.append(HumanMessage(content=message["content"]))
                elif message["role"] == "assistant":
                    langchain_messages.append(AIMessage(content=message["content"]))

            # Tool calling loop with safety limits
            max_tool_iterations = 3
            iteration_count = 0
            last_tool_outputs_texts: List[str] = []
            response_text = ""

            while True:
                iteration_count += 1
                if iteration_count > max_tool_iterations:
                    # Safety break to avoid being stuck in a tool-call loop
                    if last_tool_outputs_texts:
                        response_text = (
                            "Here is the result from the requested tool:\n" +
                            "\n\n".join(last_tool_outputs_texts)
                        )
                    else:
                        response_text = "I completed the requested operation."
                    break
                # Get response from Gemini
                response = await llm.ainvoke(langchain_messages)

                if response.tool_calls:
                    # If the LLM wants to call a tool, execute it
                    print(
                        f"DEBUG: Tool calls detected: {response.tool_calls}"
                    )  # Debug logging
                    tool_outputs = []
                    for tool_call in response.tool_calls:
                        # Handle both object and dictionary formats
                        if hasattr(tool_call, "name"):
                            # Object format
                            tool_name = tool_call.name
                            tool_args = tool_call.args
                            tool_call_id = tool_call.id
                        else:
                            # Dictionary format
                            tool_name = tool_call.get("name")
                            tool_args = tool_call.get("args", {})
                            tool_call_id = tool_call.get("id")

                        print(
                            f"DEBUG: Calling tool {tool_name} with args: {tool_args}"
                        )  # Debug logging

                        # Find the tool function by name
                        tool_func = next(
                            (t.func for t in self._get_tools() if t.name == tool_name),
                            None,
                        )
                        if tool_func:
                            # Execute the tool function
                            try:
                                # Check function signature and map args robustly
                                import inspect

                                sig = inspect.signature(tool_func)
                                param_names = list(sig.parameters.keys())

                                if len(param_names) == 0:
                                    # Function takes no parameters
                                    output = await tool_func()
                                else:
                                    # Build kwargs matching the function parameters
                                    kwargs = {}

                                    # First pass: direct name matches
                                    for name in param_names:
                                        if name in tool_args:
                                            kwargs[name] = tool_args[name]

                                    # Second pass: single-arg fallback mapping
                                    if (
                                        len(kwargs) == 0
                                        and len(param_names) == 1
                                        and len(tool_args) >= 1
                                    ):
                                        # Accept any single provided value (e.g., '__arg1', arbitrary key)
                                        only_param = param_names[0]
                                        if only_param in tool_args:
                                            kwargs[only_param] = tool_args[only_param]
                                        elif "__arg1" in tool_args:
                                            kwargs[only_param] = tool_args["__arg1"]
                                        else:
                                            # Take the first value provided
                                            first_value = next(iter(tool_args.values()))
                                            kwargs[only_param] = first_value

                                    output = await tool_func(**kwargs)

                                print(f"DEBUG: Tool {tool_name} output: {output}")
                            except Exception as e:
                                print(f"DEBUG: Exception in tool {tool_name}: {str(e)}")
                                output = f"Error executing tool {tool_name}: {str(e)}"

                            tool_outputs.append(
                                ToolMessage(
                                    tool_call_id=tool_call_id, content=str(output)
                                )
                            )
                        else:
                            tool_outputs.append(
                                ToolMessage(
                                    tool_call_id=tool_call_id,
                                    content=f"Error: Tool {tool_name} not found.",
                                )
                            )

                    # Capture last tool outputs as plain texts for fallback messaging
                    last_tool_outputs_texts = [tm.content for tm in tool_outputs]

                    langchain_messages.append(
                        response
                    )  # Add the tool_call message from the LLM
                    langchain_messages.extend(
                        tool_outputs
                    )  # Add the tool output messages

                else:
                    # If no tool call, this is the final response
                    try:
                        response_text = (response.content or "").strip()
                    except Exception:
                        # Ensure we always produce a text response
                        response_text = ""
                    break

            # Map LangChain message types to role names for Langfuse
            message_type_mapping = {
                SystemMessage: "system",
                HumanMessage: "user",
                AIMessage: "assistant",
                ToolMessage: "tool",  # Add ToolMessage to mapping
            }

            generation = (
                trace.generation(
                    name="user-query-generation",
                    input=[
                        {
                            "role": message_type_mapping.get(type(msg), "unknown"),
                            "content": msg.content,
                        }
                        for msg in langchain_messages
                    ],
                    model="gemini-2.0-flash-exp",
                )
                if trace
                else None
            )

            if generation:
                generation.end(output=response_text or "(no content)")

            # Save messages to database if persistence is enabled
            if save_to_db and self.session and conversation:
                # Save user message(s)
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

                # Save assistant response
                await add_message_to_conversation(
                    self.session,
                    conversation.id,
                    ConversationMessageCreate(role="assistant", content=response_text),
                    self.user_id,
                )

            # Provide a sensible fallback message if the model returned no text
            final_message = response_text
            if not final_message:
                if last_tool_outputs_texts:
                    final_message = (
                        "Here is the result from the requested tool:\n" +
                        "\n\n".join(last_tool_outputs_texts)
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
