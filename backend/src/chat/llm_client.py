from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal, Optional, Protocol, Sequence

from google import genai
from google.genai import types
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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

    def to_genai_tool_declaration(self) -> types.FunctionDeclaration:
        schema = None
        if self.args_model:
            schema_dict = self.args_model.model_json_schema()
            schema = self._clean_pydantic_schema(schema_dict)

        return types.FunctionDeclaration(
            name=self.name,
            description=self.description,
            parameters=schema,
        )

    def _clean_pydantic_schema(self, s: Any) -> Any:
        if not isinstance(s, dict):
            return s
        out = {}
        for k, v in s.items():
            # Skip keys that Gemini schema doesn't care about
            if k in ("title", "default", "description", "example"):
                if k == "description":
                    out[k] = v
                continue
            if isinstance(v, dict):
                out[k] = self._clean_pydantic_schema(v)
            elif isinstance(v, list):
                out[k] = [self._clean_pydantic_schema(x) for x in v]
            else:
                out[k] = v
        
        # Translate lower string type to UPPER enum required by Gemini SDK if present
        if "type" in out and isinstance(out["type"], str):
            out["type"] = out["type"].upper()
            if out["type"] == "NULL":
                out["type"] = "STRING" # fallback
        return out

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


class GeminiGenAIClient:
    def __init__(
        self,
        *,
        api_key: str,
        rate_limiter: Any = None,
        model_name: str = "gemini-2.5-flash",
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
        self.client = genai.Client(api_key=self.api_key)

    async def acomplete(
        self,
        messages: Sequence[ConversationMessage],
        tools: Sequence[ToolDefinition],
    ) -> LLMResponse:
        
        system_instruction = None
        contents = []

        for message in messages:
            if message.role == "system":
                # System prompt gets pulled out
                system_instruction = message.content
            elif message.role == "user":
                contents.append(
                    types.Content(role="user", parts=[types.Part.from_text(text=message.content)])
                )
            elif message.role == "assistant":
                parts = []
                if message.content:
                    parts.append(types.Part.from_text(text=message.content))
                
                # Reconstruct tool call parts
                for tool_call in message.tool_calls:
                    parts.append(
                        types.Part.from_function_call(
                            name=tool_call.name,
                            args=tool_call.args,
                        )
                    )
                contents.append(types.Content(role="model", parts=parts))
            elif message.role == "tool":
                contents.append(
                    types.Content(
                        role="user", 
                        parts=[
                            types.Part.from_function_response(
                                name=message.tool_name or "unknown",
                                response={"result": message.content}
                            )
                        ]
                    )
                )

        gemini_tools = None
        if tools:
            declarations = [tool.to_genai_tool_declaration() for tool in tools]
            gemini_tools = [types.Tool(function_declarations=declarations)]

        config = types.GenerateContentConfig(
            temperature=self.temperature,
            max_output_tokens=self.max_tokens,
            system_instruction=system_instruction,
            tools=gemini_tools,
        )

        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=config,
        )

        return self._normalize_response(response)

    def _normalize_response(self, response: Any) -> LLMResponse:
        tool_calls = []
        text_content = ""

        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts:
                if part.text:
                    if text_content:
                        text_content += "\n" + part.text
                    else:
                        text_content = part.text
                if part.function_call:
                    tool_calls.append(
                        ToolCall(
                            call_id=f"call_{len(tool_calls)}", # Gemini doesn't always provide rigorous IDs for calls like OpenAI does
                            name=part.function_call.name,
                            args=part.function_call.args if hasattr(part.function_call, "args") else {},
                        )
                    )

        return LLMResponse(
            message=ConversationMessage(
                role="assistant",
                content=text_content,
                tool_calls=tool_calls,
            )
        )
