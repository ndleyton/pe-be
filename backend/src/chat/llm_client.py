from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal, Optional, Protocol, Sequence

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import StructuredTool
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel


ChatRole = Literal["system", "user", "assistant", "tool"]
ToolHandler = Callable[..., Awaitable[str]]


@dataclass(slots=True)
class ToolCall:
    call_id: str
    name: str
    args: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ConversationMessage:
    role: ChatRole
    content: str
    tool_call_id: Optional[str] = None
    tool_name: Optional[str] = None
    tool_calls: list[ToolCall] = field(default_factory=list)


@dataclass(slots=True)
class LLMResponse:
    message: ConversationMessage

    @property
    def tool_calls(self) -> list[ToolCall]:
        return self.message.tool_calls


@dataclass(slots=True)
class ToolDefinition:
    name: str
    description: str
    handler: ToolHandler
    args_model: Optional[type[BaseModel]] = None

    def to_langchain_tool(self) -> StructuredTool:
        kwargs: dict[str, Any] = {
            "name": self.name,
            "description": self.description,
            "coroutine": self.handler,
        }
        if self.args_model is not None:
            kwargs["args_schema"] = self.args_model
            kwargs["infer_schema"] = False

        return StructuredTool.from_function(**kwargs)

    def normalize_args(self, raw_args: Optional[dict[str, Any]]) -> dict[str, Any]:
        if self.args_model is None:
            return {}

        candidate = self._coerce_raw_args(raw_args or {})
        model = self.args_model.model_validate(candidate)
        return model.model_dump(exclude_none=True)

    async def ainvoke(self, raw_args: Optional[dict[str, Any]] = None) -> str:
        kwargs = self.normalize_args(raw_args)
        return await self.handler(**kwargs)

    def _coerce_raw_args(self, raw_args: dict[str, Any]) -> dict[str, Any]:
        candidate = dict(raw_args)

        for synthetic_key in ("__arg1", "kwargs"):
            if synthetic_key in candidate and len(candidate) == 1:
                parsed = self._parse_json_dict(candidate[synthetic_key])
                if parsed is not None:
                    return parsed

        field_names = list(self.args_model.model_fields.keys())
        if len(field_names) == 1 and field_names[0] not in candidate and candidate:
            only_field = field_names[0]
            if "__arg1" in candidate:
                return {only_field: candidate["__arg1"]}
            return {only_field: next(iter(candidate.values()))}

        return candidate

    @staticmethod
    def _parse_json_dict(value: Any) -> Optional[dict[str, Any]]:
        if not isinstance(value, str):
            return None

        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return None

        if isinstance(parsed, dict):
            return parsed

        return None


class LLMClient(Protocol):
    model_name: str

    async def acomplete(
        self,
        messages: Sequence[ConversationMessage],
        tools: Sequence[ToolDefinition],
    ) -> LLMResponse:
        """Generate the next assistant message for the given conversation."""


class GeminiLangChainClient:
    def __init__(
        self,
        *,
        api_key: str,
        rate_limiter: Any,
        model_name: str = "gemini-2.5-flash-preview-09-2025",
        temperature: float = 0.7,
        max_tokens: int = 2000,
        max_retries: int = 2,
    ):
        self.api_key = api_key
        self.rate_limiter = rate_limiter
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.max_retries = max_retries

    async def acomplete(
        self,
        messages: Sequence[ConversationMessage],
        tools: Sequence[ToolDefinition],
    ) -> LLMResponse:
        llm = ChatGoogleGenerativeAI(
            model=self.model_name,
            google_api_key=self.api_key,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            max_retries=self.max_retries,
            rate_limiter=self.rate_limiter,
        )
        llm = llm.bind_tools([tool.to_langchain_tool() for tool in tools])
        response = await llm.ainvoke(self._to_langchain_messages(messages))
        return self._normalize_response(response)

    def _to_langchain_messages(
        self, messages: Sequence[ConversationMessage]
    ) -> list[Any]:
        normalized_messages: list[Any] = []
        for message in messages:
            if message.role == "system":
                normalized_messages.append(SystemMessage(content=message.content))
            elif message.role == "user":
                normalized_messages.append(HumanMessage(content=message.content))
            elif message.role == "assistant":
                kwargs: dict[str, Any] = {}
                if message.tool_calls:
                    kwargs["tool_calls"] = [
                        {
                            "name": tool_call.name,
                            "args": tool_call.args,
                            "id": tool_call.call_id,
                            "type": "tool_call",
                        }
                        for tool_call in message.tool_calls
                    ]
                normalized_messages.append(AIMessage(content=message.content, **kwargs))
            elif message.role == "tool":
                normalized_messages.append(
                    ToolMessage(
                        content=message.content,
                        tool_call_id=message.tool_call_id or "",
                    )
                )

        return normalized_messages

    def _normalize_response(self, response: Any) -> LLMResponse:
        tool_calls = []
        for index, tool_call in enumerate(getattr(response, "tool_calls", []) or []):
            if hasattr(tool_call, "name"):
                tool_name = tool_call.name
                tool_args = tool_call.args
                tool_call_id = tool_call.id
            else:
                tool_name = tool_call.get("name")
                tool_args = tool_call.get("args", {})
                tool_call_id = tool_call.get("id")

            tool_calls.append(
                ToolCall(
                    call_id=tool_call_id or f"tool_call_{index}",
                    name=tool_name or "",
                    args=tool_args or {},
                )
            )

        return LLMResponse(
            message=ConversationMessage(
                role="assistant",
                content=self._normalize_content(getattr(response, "content", "")),
                tool_calls=tool_calls,
            )
        )

    def _normalize_content(self, content: Any) -> str:
        if isinstance(content, str):
            return content

        if isinstance(content, list):
            collected_parts: list[str] = []
            for part in content:
                if isinstance(part, str):
                    collected_parts.append(part)
                elif isinstance(part, dict):
                    text = part.get("text")
                    if isinstance(text, str):
                        collected_parts.append(text)
            return "\n".join(collected_parts)

        if content is None:
            return ""

        return str(content)
