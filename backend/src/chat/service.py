import hashlib
import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from langfuse import Langfuse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.chat.crud import (
    add_message_to_conversation,
    create_chat_attachment,
    get_stale_orphaned_chat_attachments,
    get_chat_attachment_by_id,
    get_conversation_by_id,
    get_or_create_active_conversation,
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
from src.chat.schemas import ChatMessage, ChatMessagePart, ConversationMessageCreate
from src.core.config import settings
from src.exercises.crud import get_exercise_type_stats, get_exercise_types
from src.exercises.crud import get_exercises_for_workout
from src.workouts.crud import get_latest_workout_for_user, get_workout_by_date

logger = logging.getLogger(__name__)


class LastExercisePerformanceArgs(BaseModel):
    exercise_name: str


class WorkoutSummaryByDateArgs(BaseModel):
    workout_date: str


class ChatService:
    @staticmethod
    def _format_optional_notes(label: str, notes: Optional[str]) -> str:
        if not notes:
            return ""
        return f"{label}: {notes}\n"

    @classmethod
    def _format_set_summary(cls, exercise_set: Any) -> str:
        intensity_display = ""
        if (
            getattr(exercise_set, "intensity", None) is not None
            and hasattr(exercise_set, "intensity_unit")
            and exercise_set.intensity_unit
        ):
            intensity_display = (
                f" at {exercise_set.intensity} "
                f"{exercise_set.intensity_unit.abbreviation}"
            )
        elif getattr(exercise_set, "intensity", None) is not None:
            intensity_display = f" at {exercise_set.intensity}"

        summary = (
            f"  - Set {exercise_set.id}: "
            f"{getattr(exercise_set, 'reps', None) or '?'} reps{intensity_display}\n"
        )
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

    async def _get_last_exercise_performance(self, exercise_name: str) -> str:
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

            await WorkoutService.create_workout_from_parsed(
                self.session, self.user_id, parsed_workout
            )

            self._workout_saved_this_request = True
            exercise_count = len(parsed_workout.exercises)
            return (
                "WORKOUT SAVED SUCCESSFULLY. "
                f"Name: '{parsed_workout.name}', Exercises: {exercise_count}. "
                "Do not call this tool again for this workout."
            )
        except Exception as exc:
            return f"Failed to save workout: {exc}"

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
                    "optional notes, and sets (reps, intensity, intensity_unit, "
                    "rest_time_seconds, optional notes)\n"
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

        conversation = None
        persisted_history: list[ChatMessage] = []
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
                normalized_messages = [
                    ChatMessage.model_validate(message) for message in messages or []
                ]
                title = self._title_from_messages(normalized_messages)
                conversation = await get_or_create_active_conversation(
                    self.session, self.user_id, title
                )
                if getattr(conversation, "messages", None):
                    persisted_history = [
                        self._chat_message_from_orm(message)
                        for message in conversation.messages
                        if message.role in {"user", "assistant"}
                    ]

        normalized_messages = [
            ChatMessage.model_validate(message) for message in messages or []
        ]
        if not normalized_messages:
            raise ValueError("At least one chat message is required")

        new_messages = self._split_new_messages(normalized_messages, persisted_history)

        llm_messages = [
            ConversationMessage(role="system", content=self._get_system_prompt())
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
                if last_tool_outputs_texts:
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
            }
        except Exception as exc:
            if trace:
                trace.update(metadata={"status": "error", "error": str(exc)})

            error_msg = str(exc)
            if "429" in error_msg or "ResourceExhausted" in error_msg:
                raise ValueError(
                    "The AI service is currently busy (quota exceeded). "
                    "Please try again in a minute."
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
