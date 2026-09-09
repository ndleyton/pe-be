from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from src.core.config import Settings
from src.mcp.idempotency import (
    IdempotencyClaim,
    claim_idempotency_key,
)
from src.mcp.models import MCPIdempotencyRecord, MCPIdempotencyStatus
from src.mcp.server_trainer import _mark_claim_failed, generate_workout_recap


# ---------------------------------------------------------------------------
# Finding 1 & 2: Settings Validation
# ---------------------------------------------------------------------------


def test_production_rejects_default_mcp_pat_pepper():
    with pytest.raises(
        ValidationError,
        match="MCP_PAT_PEPPER must not use the development-only default",
    ):
        Settings(
            ENVIRONMENT="production",
            MCP_PAT_PEPPER="development-only-mcp-pat-pepper",
        )


def test_production_rejects_default_mcp_pat_pepper_case_and_whitespace_normalized():
    with pytest.raises(
        ValidationError,
        match="MCP_PAT_PEPPER must not use the development-only default",
    ):
        Settings(
            ENVIRONMENT="  Production  ",
            MCP_PAT_PEPPER="development-only-mcp-pat-pepper",
        )


def test_production_accepts_custom_mcp_pat_pepper():
    s = Settings(
        ENVIRONMENT="production",
        MCP_PAT_PEPPER="a-very-secret-production-pepper",
    )
    assert s.MCP_PAT_PEPPER == "a-very-secret-production-pepper"


def test_non_production_accepts_default_mcp_pat_pepper():
    for env in ("development", "test", "staging"):
        s = Settings(
            ENVIRONMENT=env,
            MCP_PAT_PEPPER="development-only-mcp-pat-pepper",
        )
        assert s.MCP_PAT_PEPPER == "development-only-mcp-pat-pepper"


def test_mcp_allowed_hosts_default():
    assert (
        Settings.model_fields["MCP_ALLOWED_HOSTS"].default == "localhost:*,127.0.0.1:*"
    )


# ---------------------------------------------------------------------------
# Finding 3: Idempotency Savepoint & Retry
# ---------------------------------------------------------------------------


class _MockNestedTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return False


@pytest.mark.asyncio
async def test_claim_idempotency_key_retries_on_concurrent_integrity_error():
    session = AsyncMock()

    existing_winner = MCPIdempotencyRecord(
        id=1,
        user_id=42,
        operation="log_workout",
        idempotency_key="key-12345",
        request_hash="hash-abc",
        status=MCPIdempotencyStatus.completed,
        result_payload={"created": True},
    )

    first_select_result = MagicMock()
    first_select_result.scalar_one_or_none.return_value = None

    second_select_result = MagicMock()
    second_select_result.scalar_one_or_none.return_value = existing_winner

    session.execute.side_effect = [first_select_result, second_select_result]
    session.add = MagicMock()
    session.begin_nested = MagicMock(return_value=_MockNestedTransaction())
    session.flush.side_effect = IntegrityError(
        "duplicate key", params={}, orig=Exception("uq conflict")
    )

    claim = await claim_idempotency_key(
        session,
        user_id=42,
        operation="log_workout",
        key="key-12345",
        request_hash="hash-abc",
    )

    session.begin_nested.assert_called_once()
    # Verify full session.rollback() was NOT called
    session.rollback.assert_not_called()
    assert claim.record == existing_winner
    assert claim.cached_payload == {"created": True}


@pytest.mark.asyncio
async def test_claim_idempotency_key_propagates_integrity_error_when_retry_exhausted():
    session = AsyncMock()

    first_select_result = MagicMock()
    first_select_result.scalar_one_or_none.return_value = None
    session.execute.return_value = first_select_result
    session.add = MagicMock()

    session.begin_nested = MagicMock(return_value=_MockNestedTransaction())
    session.flush.side_effect = IntegrityError(
        "duplicate key", params={}, orig=Exception("uq conflict")
    )

    with pytest.raises(IntegrityError):
        await claim_idempotency_key(
            session,
            user_id=42,
            operation="log_workout",
            key="key-12345",
            request_hash="hash-abc",
            _retry=True,  # Already retrying, should propagate without looping
        )


# ---------------------------------------------------------------------------
# Finding 4: Trainer Recap Generation Failure Handling
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mark_claim_failed_rolls_back_and_marks_record():
    session = AsyncMock()
    mock_record = MagicMock(id=99, status=MCPIdempotencyStatus.pending, error_code=None)
    session.get.return_value = mock_record

    claim = IdempotencyClaim(record=mock_record, cached_payload=None)

    await _mark_claim_failed(session, claim, "generation_failed")

    session.rollback.assert_awaited_once()
    session.get.assert_awaited_once_with(MCPIdempotencyRecord, 99)
    assert mock_record.status == MCPIdempotencyStatus.failed
    assert mock_record.error_code == "generation_failed"
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_workout_recap_marks_failed_on_exception():
    mock_session = AsyncMock()
    mock_workout = MagicMock(id=10, recap=None)
    mock_record = MagicMock(id=88, status=MCPIdempotencyStatus.pending)
    mock_claim = IdempotencyClaim(record=mock_record, cached_payload=None)

    mock_principal = MagicMock(user_id=1, scopes=["trainer:write"])

    with (
        patch("src.mcp.server_trainer.current_principal", return_value=mock_principal),
        patch("src.mcp.server_trainer.async_session_maker") as mock_maker,
        patch("src.mcp.server_trainer.get_workout_by_id", return_value=mock_workout),
        patch("src.mcp.server_trainer.claim_idempotency_key", return_value=mock_claim),
        patch(
            "src.mcp.server_trainer.WorkoutRecapService.generate_recap",
            side_effect=RuntimeError("LLM failed"),
        ),
        patch(
            "src.mcp.server_trainer._mark_claim_failed", new_callable=AsyncMock
        ) as mock_mark_failed,
    ):
        mock_maker.return_value.__aenter__.return_value = mock_session

        with pytest.raises(RuntimeError, match="LLM failed"):
            await generate_workout_recap(
                workout_id=10, idempotency_key="key-abc-123", force=True
            )

        mock_mark_failed.assert_awaited_once_with(
            mock_session, mock_claim, "generation_failed"
        )


@pytest.mark.asyncio
async def test_generate_workout_recap_marks_failed_when_recap_is_none():
    mock_session = AsyncMock()
    mock_workout = MagicMock(id=10, recap=None)
    mock_record = MagicMock(id=88, status=MCPIdempotencyStatus.pending)
    mock_claim = IdempotencyClaim(record=mock_record, cached_payload=None)

    mock_principal = MagicMock(user_id=1, scopes=["trainer:write"])

    with (
        patch("src.mcp.server_trainer.current_principal", return_value=mock_principal),
        patch("src.mcp.server_trainer.async_session_maker") as mock_maker,
        patch("src.mcp.server_trainer.get_workout_by_id", return_value=mock_workout),
        patch("src.mcp.server_trainer.claim_idempotency_key", return_value=mock_claim),
        patch(
            "src.mcp.server_trainer.WorkoutRecapService.generate_recap",
            return_value=None,
        ),
        patch(
            "src.mcp.server_trainer._mark_claim_failed", new_callable=AsyncMock
        ) as mock_mark_failed,
    ):
        mock_maker.return_value.__aenter__.return_value = mock_session

        with pytest.raises(ValueError, match="Workout not found"):
            await generate_workout_recap(
                workout_id=10, idempotency_key="key-abc-123", force=True
            )

        mock_mark_failed.assert_awaited_once_with(
            mock_session, mock_claim, "workout_not_found"
        )
