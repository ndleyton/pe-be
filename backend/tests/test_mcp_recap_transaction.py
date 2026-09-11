from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from src.mcp import server_trainer
from src.mcp.idempotency import claim_idempotency_key, request_fingerprint
from src.mcp.models import MCPIdempotencyRecord, MCPIdempotencyStatus
from src.workouts.models import Workout
from tests.test_mcp_integration import _seed_catalog


@pytest.mark.asyncio(loop_scope="session")
async def test_final_commit_failure_rolls_back_recap_and_allows_retry(
    db_session, monkeypatch
):
    user, workout_type, _ = await _seed_catalog(db_session)
    user_id = user.id
    workout = Workout(
        owner_id=user_id,
        workout_type_id=workout_type.id,
        name="Push",
        recap="Previous recap",
    )
    db_session.add(workout)
    await db_session.commit()
    workout_id = workout.id
    real_commit = db_session.commit
    commits = 0

    async def fail_final_commit():
        nonlocal commits
        commits += 1
        if commits == 2:
            # Fail after both writes reach the database but before commit.
            await db_session.flush()
            record = await db_session.scalar(select(MCPIdempotencyRecord))
            assert record.status == MCPIdempotencyStatus.completed
            assert workout.recap == "New recap"
            raise RuntimeError("final commit failed")
        await real_commit()

    async def generate(session, *args, raise_on_error):
        assert raise_on_error
        workout.recap = "New recap"
        await session.flush()
        return workout.recap

    @asynccontextmanager
    async def session_maker():
        yield db_session

    monkeypatch.setattr(db_session, "commit", fail_final_commit)
    monkeypatch.setattr(server_trainer, "async_session_maker", session_maker)
    monkeypatch.setattr(
        server_trainer,
        "current_principal",
        AsyncMock(
            return_value=SimpleNamespace(user_id=user_id, scopes=["trainer:write"])
        ),
    )
    monkeypatch.setattr(server_trainer.WorkoutRecapService, "generate_recap", generate)
    with pytest.raises(RuntimeError, match="final commit failed"):
        await server_trainer.generate_workout_recap(
            workout_id, "recap-commit-failure", force=True
        )

    await db_session.refresh(workout)
    assert workout.recap == "Previous recap"
    record = await db_session.scalar(select(MCPIdempotencyRecord))
    assert record.status == MCPIdempotencyStatus.failed
    assert record.error_code == "generation_failed"
    assert record.result_payload is None
    retry = await claim_idempotency_key(
        db_session,
        user_id=user_id,
        operation="generate_workout_recap",
        key="recap-commit-failure",
        request_hash=request_fingerprint({"workout_id": workout_id, "force": True}),
    )
    assert retry.record.id == record.id
    assert retry.cached_payload is None
    assert retry.record.status == MCPIdempotencyStatus.pending
