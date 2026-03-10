import logging
from contextvars import ContextVar, Token
from logging.config import dictConfig


REQUEST_ID_CONTEXT: ContextVar[str] = ContextVar("request_id", default="-")


class RequestContextFilter(logging.Filter):
    """Attach request-scoped context to every emitted log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = REQUEST_ID_CONTEXT.get("-")
        return True


def set_request_id(request_id: str) -> Token:
    return REQUEST_ID_CONTEXT.set(request_id)


def reset_request_id(token: Token) -> None:
    REQUEST_ID_CONTEXT.reset(token)


def configure_logging(log_level: str = "INFO") -> None:
    level = log_level.upper()
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {
                "request_context": {
                    "()": "src.core.logging.RequestContextFilter",
                }
            },
            "formatters": {
                "standard": {
                    "format": (
                        "%(asctime)s %(levelname)s [%(request_id)s] "
                        "%(name)s: %(message)s"
                    ),
                    "datefmt": "%Y-%m-%d %H:%M:%S",
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "standard",
                    "filters": ["request_context"],
                    "stream": "ext://sys.stdout",
                }
            },
            "root": {
                "handlers": ["console"],
                "level": level,
            },
            "loggers": {
                "uvicorn.access": {
                    "handlers": ["console"],
                    "level": "WARNING",
                    "propagate": False,
                },
                "uvicorn.error": {
                    "handlers": ["console"],
                    "level": level,
                    "propagate": False,
                },
                "uvicorn": {
                    "handlers": ["console"],
                    "level": level,
                    "propagate": False,
                },
            },
        }
    )
