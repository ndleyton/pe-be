from __future__ import annotations

import hashlib
import importlib
import logging
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from time import perf_counter
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import async_session_maker
from src.core.logging import configure_logging
from src.core.config import settings


logger = logging.getLogger(__name__)

JobStatus = Literal["success", "skipped", "failed", "disabled"]
JobCallable = Callable[[AsyncSession], Awaitable[Mapping[str, Any] | None]]
_MODEL_REGISTRY_LOADED = False


@dataclass(frozen=True)
class JobRunResult:
    job_name: str
    status: JobStatus
    metrics: dict[str, Any]


def configure_job_runtime() -> None:
    configure_logging(settings.LOG_LEVEL)


def ensure_model_registry_loaded() -> None:
    global _MODEL_REGISTRY_LOADED
    if _MODEL_REGISTRY_LOADED:
        return

    # Standalone jobs do not import the FastAPI app, so load model modules
    # explicitly before the first ORM query to resolve string relationships.
    for module_name in (
        "src.chat.models",
        "src.exercise_sets.models",
        "src.exercises.models",
        "src.routines.models",
        "src.users.models",
        "src.workouts.models",
    ):
        importlib.import_module(module_name)

    _MODEL_REGISTRY_LOADED = True


def advisory_lock_key_for_job(job_name: str) -> int:
    digest = hashlib.blake2b(job_name.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, byteorder="big", signed=True)


def _format_log_fields(fields: Mapping[str, Any]) -> str:
    parts: list[str] = []
    for key, value in fields.items():
        if value is None:
            continue
        parts.append(f"{key}={value}")
    return " ".join(parts)


async def _try_acquire_advisory_lock(
    session: AsyncSession,
    *,
    lock_key: int,
) -> bool:
    connection = await session.connection()
    acquired = await connection.scalar(select(func.pg_try_advisory_lock(lock_key)))
    return bool(acquired)


async def _release_advisory_lock(
    session: AsyncSession,
    *,
    lock_key: int,
) -> bool:
    connection = await session.connection()
    released = await connection.scalar(select(func.pg_advisory_unlock(lock_key)))
    return bool(released)


async def run_managed_job(
    *,
    job_name: str,
    job_callable: JobCallable,
    job_logger: logging.Logger | None = None,
) -> JobRunResult:
    active_logger = job_logger or logger
    lock_key = advisory_lock_key_for_job(job_name)
    started_at = datetime.now(timezone.utc)
    started_timer = perf_counter()
    ensure_model_registry_loaded()

    async with async_session_maker() as session:
        if not await _try_acquire_advisory_lock(session, lock_key=lock_key):
            finished_at = datetime.now(timezone.utc)
            duration_ms = round((perf_counter() - started_timer) * 1000, 2)
            active_logger.info(
                "Job skipped %s",
                _format_log_fields(
                    {
                        "job_name": job_name,
                        "status": "skipped",
                        "lock_key": lock_key,
                        "started_at": started_at.isoformat(),
                        "finished_at": finished_at.isoformat(),
                        "duration_ms": duration_ms,
                    }
                ),
            )
            return JobRunResult(job_name=job_name, status="skipped", metrics={})

        active_logger.info(
            "Job started %s",
            _format_log_fields(
                {
                    "job_name": job_name,
                    "lock_key": lock_key,
                    "started_at": started_at.isoformat(),
                }
            ),
        )

        try:
            metrics = dict(await job_callable(session) or {})
        except Exception:
            finished_at = datetime.now(timezone.utc)
            duration_ms = round((perf_counter() - started_timer) * 1000, 2)
            active_logger.exception(
                "Job failed %s",
                _format_log_fields(
                    {
                        "job_name": job_name,
                        "status": "failed",
                        "lock_key": lock_key,
                        "started_at": started_at.isoformat(),
                        "finished_at": finished_at.isoformat(),
                        "duration_ms": duration_ms,
                    }
                ),
            )
            raise
        else:
            finished_at = datetime.now(timezone.utc)
            duration_ms = round((perf_counter() - started_timer) * 1000, 2)
            active_logger.info(
                "Job finished %s",
                _format_log_fields(
                    {
                        "job_name": job_name,
                        "status": "success",
                        "lock_key": lock_key,
                        "started_at": started_at.isoformat(),
                        "finished_at": finished_at.isoformat(),
                        "duration_ms": duration_ms,
                        **metrics,
                    }
                ),
            )
            return JobRunResult(job_name=job_name, status="success", metrics=metrics)
        finally:
            try:
                released = await _release_advisory_lock(session, lock_key=lock_key)
            except Exception:
                active_logger.warning(
                    "Job lock release failed %s",
                    _format_log_fields(
                        {
                            "job_name": job_name,
                            "lock_key": lock_key,
                        }
                    ),
                    exc_info=True,
                )
            else:
                if not released:
                    active_logger.warning(
                        "Job lock was not held at release %s",
                        _format_log_fields(
                            {
                                "job_name": job_name,
                                "lock_key": lock_key,
                            }
                        ),
                    )
