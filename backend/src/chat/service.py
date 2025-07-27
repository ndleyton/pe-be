from typing import Optional, List, Dict, Any
from langfuse import Langfuse
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.rate_limiters import InMemoryRateLimiter

from src.core.config import settings
from src.chat.crud import (
    get_or_create_active_conversation,
    add_message_to_conversation,
    get_conversation_by_id,
    get_user_conversations,
)
from src.chat.schemas import ConversationMessageCreate


class ChatService:
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
        """Generate a response from Gemini 2.0 Flash Experimental, with Langfuse tracing and optional DB persistence."""
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
                    "model": "gemini-2.0-flash-exp",
                    "conversation_id": conversation.id if conversation else None,
                },
            )

        try:
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash-exp",
                google_api_key=settings.GOOGLE_AI_KEY,
                temperature=0.7,
                max_tokens=800,
                rate_limiter=self.rate_limiter,
            )

            # Convert messages to LangChain format
            system_prompt = self._get_system_prompt()
            langchain_messages = [SystemMessage(content=system_prompt)]

            for message in messages:
                if message["role"] == "user":
                    langchain_messages.append(HumanMessage(content=message["content"]))
                elif message["role"] == "assistant":
                    langchain_messages.append(AIMessage(content=message["content"]))

            # Map LangChain message types to role names for Langfuse
            message_type_mapping = {
                SystemMessage: "system",
                HumanMessage: "user",
                AIMessage: "assistant",
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

            # Get response from Gemini
            response = await llm.ainvoke(langchain_messages)
            response_text = response.content.strip()

            if generation:
                generation.end(output=response_text)

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

            return {
                "message": response_text,
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
