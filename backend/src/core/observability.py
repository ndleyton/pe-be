from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import (
    DEPLOYMENT_ENVIRONMENT,
    SERVICE_NAME,
    SERVICE_VERSION,
    Resource,
)
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import ParentBased, TraceIdRatioBased
from opentelemetry.trace import Span

from src.core.config import settings
from src.core.database import engine


_configured = False
_sqlalchemy_instrumentor = SQLAlchemyInstrumentor()
_fastapi_instrumentor = FastAPIInstrumentor()


def _build_resource() -> Resource:
    return Resource.create(
        {
            SERVICE_NAME: settings.OTEL_SERVICE_NAME,
            DEPLOYMENT_ENVIRONMENT: settings.ENVIRONMENT,
            SERVICE_VERSION: settings.OTEL_SERVICE_VERSION
            or f"2.0.0-{settings.API_VERSION}",
        }
    )


def _excluded_urls() -> str | None:
    paths = [path.strip() for path in settings.OTEL_EXCLUDED_URLS.split(",")]
    return ",".join(path for path in paths if path)


def _server_request_hook(span: Span, scope: dict) -> None:
    if not span or not span.is_recording():
        return

    headers = {
        key.decode("latin-1").lower(): value.decode("latin-1")
        for key, value in scope.get("headers", [])
    }
    request_id = headers.get("x-request-id")
    if request_id:
        span.set_attribute("request.id", request_id)


def configure_observability(app: FastAPI) -> None:
    global _configured

    if _configured or not settings.OTEL_ENABLED:
        return

    if not (
        settings.OTEL_EXPORTER_OTLP_ENDPOINT
        or settings.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
    ):
        return

    tracer_provider = TracerProvider(
        resource=_build_resource(),
        sampler=ParentBased(TraceIdRatioBased(settings.OTEL_TRACES_SAMPLER_ARG)),
    )
    # OTLPSpanExporter reads standard OTEL_* endpoint and auth env vars.
    tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(tracer_provider)

    _sqlalchemy_instrumentor.instrument(
        engine=engine.sync_engine,
        tracer_provider=tracer_provider,
    )
    _fastapi_instrumentor.instrument_app(
        app,
        tracer_provider=tracer_provider,
        excluded_urls=_excluded_urls(),
        server_request_hook=_server_request_hook,
    )

    _configured = True
