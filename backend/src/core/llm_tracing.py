"""Langfuse (SDK v5, OpenTelemetry-based) client and trace helpers."""

from typing import Any, Optional

from langfuse import Langfuse, LangfuseSpan, propagate_attributes
from opentelemetry.sdk.trace import TracerProvider

from src.core.config import settings

# Langfuse gets its own provider so its spans (full prompts) never reach the app's
# OTLP exporter or sampler, and it never registers itself as the global provider.
_tracer_provider = TracerProvider()


def get_langfuse_client() -> Optional[Langfuse]:
    if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
        return Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            base_url=settings.LANGFUSE_HOST,
            tracer_provider=_tracer_provider,
        )
    return None


def start_langfuse_trace(
    client: Langfuse,
    *,
    name: str,
    user_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> LangfuseSpan:
    """Start a root span for a new trace without making it the current OTel span.

    The caller must call ``.end()`` on the returned span.
    """
    with propagate_attributes(trace_name=name, user_id=user_id):
        return client.start_observation(
            # A fresh trace id makes this a Langfuse root, not a child of the request span.
            trace_context={"trace_id": client.create_trace_id()},
            name=name,
            as_type="span",
            metadata=metadata,
        )
