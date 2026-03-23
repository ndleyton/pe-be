import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration

from src.core.config import settings
from src.core.logging import REQUEST_ID_CONTEXT


FILTERED_VALUE = "[Filtered]"
SENSITIVE_HEADER_KEYS = {
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "x-forwarded-for",
}
SENSITIVE_USER_KEYS = {"email", "ip_address", "username", "name"}


def _attach_request_id(event: dict[str, Any]) -> dict[str, Any]:
    request_id = REQUEST_ID_CONTEXT.get("-")
    if request_id != "-":
        tags = event.setdefault("tags", {})
        tags.setdefault("request_id", request_id)
    return event


def _redact_headers(headers: Any) -> Any:
    if not isinstance(headers, Mapping):
        return headers

    redacted: dict[str, Any] = {}
    for key, value in headers.items():
        if str(key).lower() in SENSITIVE_HEADER_KEYS:
            redacted[key] = FILTERED_VALUE
        else:
            redacted[key] = value
    return redacted


def _redact_user(user: Any) -> Any:
    if not isinstance(user, Mapping):
        return user

    redacted = dict(user)
    for key in SENSITIVE_USER_KEYS:
        redacted.pop(key, None)
    return redacted


def _sanitize_request(event: dict[str, Any]) -> dict[str, Any]:
    request = event.get("request")
    if not isinstance(request, dict):
        return event

    if "headers" in request:
        request["headers"] = _redact_headers(request.get("headers"))
    if request.get("cookies"):
        request["cookies"] = FILTERED_VALUE
    if request.get("data") is not None:
        request["data"] = FILTERED_VALUE
    if request.get("query_string"):
        request["query_string"] = FILTERED_VALUE

    return event


def _before_send(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any]:
    _ = hint
    event = _attach_request_id(event)
    event = _sanitize_request(event)
    if "user" in event:
        event["user"] = _redact_user(event.get("user"))
    return event


def _before_send_transaction(
    event: dict[str, Any], hint: dict[str, Any]
) -> dict[str, Any]:
    _ = hint
    event = _attach_request_id(event)
    return _sanitize_request(event)


def configure_sentry() -> None:
    if not settings.SENTRY_DSN:
        return

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=settings.SENTRY_RELEASE or None,
        send_default_pii=False,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
        integrations=[
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR)
        ],
        before_send=_before_send,
        before_send_transaction=_before_send_transaction,
    )
