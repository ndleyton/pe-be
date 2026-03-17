from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Literal, Optional, Protocol, Sequence

from google import genai
from google.genai import types
from pydantic import BaseModel


ChatRole = Literal["system", "user", "assistant", "tool"]
MessagePartType = Literal["text", "image"]
ToolHandler = Callable[..., Awaitable[str]]


@dataclass(slots=True)
class ContentPart:
    type: MessagePartType
    text: Optional[str] = None
    attachment_id: Optional[int] = None
    mime_type: Optional[str] = None
    file_uri: Optional[str] = None


@dataclass(slots=True)
class UploadedFileRef:
    name: str
    uri: str
    mime_type: str


@dataclass(slots=True)
class ToolCall:
    call_id: str
    name: str
    args: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ConversationMessage:
    role: ChatRole
    content: str
    parts: list[ContentPart] = field(default_factory=list)
    tool_call_id: Optional[str] = None
    tool_name: Optional[str] = None
    tool_calls: list[ToolCall] = field(default_factory=list)


@dataclass(slots=True)
class LLMResponse:
    message: ConversationMessage
    metadata: dict[str, Any] = field(default_factory=dict)

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
            schema = self._clean_pydantic_schema(self.args_model.model_json_schema())

        return types.FunctionDeclaration(
            name=self.name,
            description=self.description,
            parameters=schema,
        )

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

    @classmethod
    def _clean_pydantic_schema(cls, schema: Any) -> Any:
        defs = schema.get("$defs", {}) if isinstance(schema, dict) else {}
        return cls._clean_pydantic_schema_inner(schema, defs)

    @classmethod
    def _clean_pydantic_schema_inner(cls, schema: Any, defs: dict[str, Any]) -> Any:
        if isinstance(schema, dict):
            ref = schema.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/$defs/"):
                ref_name = ref.removeprefix("#/$defs/")
                resolved = defs.get(ref_name)
                if resolved is None:
                    raise ValueError(f"Unsupported schema reference: {ref}")
                return cls._clean_pydantic_schema_inner(resolved, defs)

            cleaned: dict[str, Any] = {}
            for key, value in schema.items():
                if key in {"$defs", "$ref", "title", "default", "example"}:
                    continue
                cleaned[key] = cls._clean_pydantic_schema_inner(value, defs)

            schema_type = cleaned.get("type")
            if isinstance(schema_type, str):
                normalized = schema_type.upper()
                cleaned["type"] = "STRING" if normalized == "NULL" else normalized

            return cleaned

        if isinstance(schema, list):
            return [cls._clean_pydantic_schema_inner(item, defs) for item in schema]

        return schema

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

    async def aupload_file(
        self,
        *,
        path: str | Path,
        mime_type: str,
        display_name: str,
    ) -> UploadedFileRef:
        """Upload a file to the provider for reuse in multimodal requests."""


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
        system_instruction: Optional[str] = None
        contents: list[types.Content] = []
        saw_image = False

        for message in messages:
            if message.role == "system":
                system_instruction = message.content
                continue

            if message.role == "tool":
                contents.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=message.tool_name or "unknown",
                                response={"result": message.content},
                            )
                        ],
                    )
                )
                continue

            if message.role == "assistant":
                parts: list[types.Part] = []
                if message.content:
                    parts.append(types.Part.from_text(text=message.content))
                for tool_call in message.tool_calls:
                    parts.append(
                        types.Part.from_function_call(
                            name=tool_call.name,
                            args=tool_call.args,
                        )
                    )
                if parts:
                    contents.append(types.Content(role="model", parts=parts))
                continue

            user_parts = self._to_genai_user_parts(message)
            saw_image = saw_image or any(part.type == "image" for part in message.parts)
            contents.append(types.Content(role="user", parts=user_parts))

        gemini_tools = None
        tool_config = None
        if tools:
            declarations = [tool.to_genai_tool_declaration() for tool in tools]
            gemini_tools = [types.Tool(function_declarations=declarations)]
            tool_config = types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(
                    mode=types.FunctionCallingConfigMode.AUTO
                )
            )

        config = types.GenerateContentConfig(
            temperature=self.temperature,
            max_output_tokens=self.max_tokens,
            system_instruction=system_instruction,
            tools=gemini_tools,
            tool_config=tool_config,
            media_resolution=(
                types.MediaResolution.MEDIA_RESOLUTION_HIGH if saw_image else None
            ),
        )

        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=config,
        )

        return self._normalize_response(response)

    async def aupload_file(
        self,
        *,
        path: str | Path,
        mime_type: str,
        display_name: str,
    ) -> UploadedFileRef:
        uploaded = await self.client.aio.files.upload(
            file=Path(path),
            config=types.UploadFileConfig(
                mime_type=mime_type,
                display_name=display_name,
            ),
        )
        return UploadedFileRef(
            name=uploaded.name or display_name,
            uri=uploaded.uri or "",
            mime_type=uploaded.mime_type or mime_type,
        )

    def _to_genai_user_parts(self, message: ConversationMessage) -> list[types.Part]:
        if not message.parts:
            return [types.Part.from_text(text=message.content)]

        parts: list[types.Part] = []
        for part in message.parts:
            if part.type == "text" and part.text:
                parts.append(types.Part.from_text(text=part.text))
            elif part.type == "image" and part.file_uri and part.mime_type:
                parts.append(
                    types.Part.from_uri(
                        file_uri=part.file_uri,
                        mime_type=part.mime_type,
                    )
                )

        if not parts and message.content:
            parts.append(types.Part.from_text(text=message.content))

        return parts

    def _normalize_response(self, response: Any) -> LLMResponse:
        tool_calls: list[ToolCall] = []
        text_content = ""

        candidates = getattr(response, "candidates", None) or []
        if candidates and getattr(candidates[0], "content", None):
            for index, part in enumerate(candidates[0].content.parts or []):
                if getattr(part, "text", None):
                    text = part.text
                    text_content = (
                        f"{text_content}\n{text}".strip() if text_content else text
                    )

                function_call = getattr(part, "function_call", None)
                if function_call:
                    raw_args = getattr(function_call, "args", {}) or {}
                    if hasattr(raw_args, "model_dump"):
                        raw_args = raw_args.model_dump()
                    tool_calls.append(
                        ToolCall(
                            call_id=getattr(function_call, "id", None)
                            or f"call_{index}",
                            name=function_call.name,
                            args=raw_args,
                        )
                    )

        return LLMResponse(
            message=ConversationMessage(
                role="assistant",
                content=text_content,
                parts=(
                    [ContentPart(type="text", text=text_content)]
                    if text_content
                    else []
                ),
                tool_calls=tool_calls,
            ),
            metadata=self._extract_metadata(response),
        )

    def _extract_metadata(self, response: Any) -> dict[str, Any]:
        metadata: dict[str, Any] = {}

        for attr in (
            "usage_metadata",
            "prompt_feedback",
            "model_version",
            "response_id",
        ):
            value = getattr(response, attr, None)
            if value is None:
                continue
            metadata[attr] = (
                value.model_dump() if hasattr(value, "model_dump") else value
            )

        candidates = getattr(response, "candidates", None) or []
        if candidates:
            candidate = candidates[0]
            safety_ratings = getattr(candidate, "safety_ratings", None)
            if safety_ratings is not None:
                metadata["safety_ratings"] = [
                    rating.model_dump() if hasattr(rating, "model_dump") else rating
                    for rating in safety_ratings
                ]
            finish_reason = getattr(candidate, "finish_reason", None)
            if finish_reason is not None:
                metadata["finish_reason"] = (
                    finish_reason.value
                    if hasattr(finish_reason, "value")
                    else finish_reason
                )

        return metadata
