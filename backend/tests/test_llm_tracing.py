from langfuse import Langfuse
from opentelemetry import trace as otel_trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
    InMemorySpanExporter,
)

from src.core.llm_tracing import start_langfuse_trace


def test_start_langfuse_trace_creates_root_with_trace_attributes():
    exporter = InMemorySpanExporter()
    client = Langfuse(
        public_key="pk-lf-test-llm-tracing",
        secret_key="sk-lf-test",
        base_url="http://localhost:1",
        tracer_provider=TracerProvider(),
        span_exporter=exporter,
    )
    request_span = otel_trace.NonRecordingSpan(
        otel_trace.SpanContext(
            trace_id=1, span_id=1, is_remote=False, trace_flags=otel_trace.TraceFlags(1)
        )
    )

    with otel_trace.use_span(request_span):
        root = start_langfuse_trace(
            client, name="unit-trace", user_id="42", metadata={"model": "m"}
        )
        # The root must not become the current span (app OTel context is untouched).
        assert otel_trace.get_current_span() is request_span
    root.start_observation(name="gen", as_type="generation", output="hi").end()
    root.update(metadata={"status": "success"})
    root.end()
    client.flush()

    spans = {span.name: span for span in exporter.get_finished_spans()}
    root_span, gen_span = spans["unit-trace"], spans["gen"]
    assert root_span.context.trace_id != 1
    assert root_span.attributes["langfuse.internal.as_root"] is True
    assert root_span.attributes["langfuse.trace.name"] == "unit-trace"
    assert root_span.attributes["user.id"] == "42"
    assert gen_span.parent.span_id == root_span.context.span_id
    assert gen_span.attributes["langfuse.observation.type"] == "generation"
