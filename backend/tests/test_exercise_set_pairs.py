import uuid
from datetime import datetime, timezone

import pytest

from src.core.config import settings
from src.exercises.models import Exercise, ExerciseType, IntensityUnit
from src.main import app
from src.users.router import current_active_user
from src.workouts.models import Workout, WorkoutType
from tests.test_integrity_error_mapping import _override_authenticated_user


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_left_right_pair_and_replay(db_session, async_client):
    user = await _override_authenticated_user(db_session)
    wt = WorkoutType(name="X", description="x")
    db_session.add(wt)
    await db_session.flush()
    w = Workout(
        name="w",
        start_time=datetime.now(timezone.utc),
        workout_type_id=wt.id,
        owner_id=user.id,
    )
    db_session.add(w)
    et = ExerciseType(name="T", description="d", default_intensity_unit=None)
    db_session.add(et)
    unit = IntensityUnit(name="Kilograms", abbreviation="kg")
    db_session.add(unit)
    await db_session.flush()
    ex = Exercise(
        timestamp=datetime.now(timezone.utc), exercise_type_id=et.id, workout_id=w.id
    )
    db_session.add(ex)
    await db_session.flush()
    try:

        def item(side):
            return {
                "reps": 5,
                "intensity": 0,
                "rpe": None,
                "rir": None,
                "intensity_unit_id": unit.id,
                "rest_time_seconds": 0,
                "done": False,
                "type": "warmup",
                "side": side,
            }

        url = f"{settings.API_PREFIX}/exercise-sets/pairs/"
        body = {"exercise_id": ex.id, "sets": [item("left"), item("right")]}
        headers = {"Idempotency-Key": str(uuid.uuid4())}
        r = await async_client.post(url, json=body, headers=headers)
        assert r.status_code == 201
        assert [s["side"] for s in r.json()] == ["left", "right"]
        replay = await async_client.post(url, json=body, headers=headers)
        assert replay.status_code == 201
        assert [s["id"] for s in replay.json()] == [s["id"] for s in r.json()]
    finally:
        app.dependency_overrides.pop(current_active_user, None)
