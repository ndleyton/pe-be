from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.mcp.models import MCPIdempotencyRecord, MCPIdempotencyStatus


class IdempotencyConflictError(ValueError):
    """Raised when an idempotency key is reused for a different request."""


@dataclass(frozen=True)
class IdempotencyClaim:
    record: MCPIdempotencyRecord
    cached_payload: dict[str, Any] | None


def request_fingerprint(payload: BaseModel | dict[str, Any]) -> str:
    value = payload.model_dump(mode="json") if isinstance(payload, BaseModel) else payload
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


async def claim_idempotency_key(
    session: AsyncSession,
    *,
    user_id: int,
    operation: str,
    key: str,
    request_hash: str,
) -> IdempotencyClaim:
    result = await session.execute(
        select(MCPIdempotencyRecord).where(
            MCPIdempotencyRecord.user_id == user_id,
            MCPIdempotencyRecord.operation == operation,
            MCPIdempotencyRecord.idempotency_key == key,
        )
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        if existing.request_hash != request_hash:
            raise IdempotencyConflictError(
                "The idempotency key was already used with a different payload"
            )
        if existing.status == MCPIdempotencyStatus.completed:
            return IdempotencyClaim(existing, existing.result_payload or {})
        if existing.status == MCPIdempotencyStatus.failed:
            existing.status = MCPIdempotencyStatus.pending
            existing.error_code = None
            await session.flush()
            return IdempotencyClaim(existing, None)
        raise IdempotencyConflictError(
            "An operation with this idempotency key is already in progress"
        )

    record = MCPIdempotencyRecord(
        user_id=user_id,
        operation=operation,
        idempotency_key=key,
        request_hash=request_hash,
        status=MCPIdempotencyStatus.pending,
    )
    session.add(record)
    try:
        await session.flush()
    except IntegrityError:
        # A concurrent request won the unique-key race. Discard this transaction
        # and resolve the committed winner using the normal replay rules.
        await session.rollback()
        return await claim_idempotency_key(
            session,
            user_id=user_id,
            operation=operation,
            key=key,
            request_hash=request_hash,
        )
    return IdempotencyClaim(record, None)


def complete_idempotent_operation(
    claim: IdempotencyClaim,
    *,
    entity_type: str,
    entity_id: int,
    payload: dict[str, Any],
) -> None:
    claim.record.status = MCPIdempotencyStatus.completed
    claim.record.result_entity_type = entity_type
    claim.record.result_entity_id = entity_id
    claim.record.result_payload = payload
