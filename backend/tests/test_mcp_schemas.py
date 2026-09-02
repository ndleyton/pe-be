from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from src.mcp.idempotency import request_fingerprint
from src.mcp.server_catalog import _public_dto
from src.mcp.trainer_schemas import WorkoutLogInput
from src.users.pat_schemas import PersonalAccessTokenCreate


def test_pat_scopes_are_bounded_and_deduplicated():
    payload = PersonalAccessTokenCreate(
        name=" Desktop ", scopes=["trainer:read", "trainer:read"]
    )
    assert payload.name == "Desktop"
    assert payload.scopes == ["trainer:read"]

    with pytest.raises(ValidationError):
        PersonalAccessTokenCreate(name="bad", scopes=["admin:write"])
    with pytest.raises(ValidationError, match="requires trainer:read"):
        PersonalAccessTokenCreate(name="write only", scopes=["trainer:write"])


def test_workout_payload_is_bounded_and_fingerprint_is_stable():
    payload = WorkoutLogInput(
        name="Push",
        idempotency_key="request-123",
        exercises=[
            {
                "exercise_type_id": 1,
                "sets": [{"reps": 5, "intensity": 80, "intensity_unit": "kg"}],
            }
        ],
    )
    assert request_fingerprint(payload) == request_fingerprint(
        payload.model_dump(mode="json")
    )

    with pytest.raises(ValidationError):
        WorkoutLogInput(
            name="Too large",
            idempotency_key="request-123",
            exercises=[
                {"exercise_type_id": index + 1, "sets": [{"reps": 1}]}
                for index in range(21)
            ],
        )


def test_public_exercise_dto_drops_moderation_and_owner_fields():
    muscle_group = SimpleNamespace(id=1, name="Chest")
    muscle = SimpleNamespace(id=2, name="Pectoralis", muscle_group=muscle_group)
    association = SimpleNamespace(muscle=muscle, is_primary=True)
    exercise = SimpleNamespace(
        id=3,
        name="Bench Press",
        description="Press from a bench",
        equipment="barbell",
        category="strength",
        instructions="Lower and press",
        images_url=None,
        exercise_muscles=[association],
        owner_id=999,
        reviewed_by=888,
        review_notes="private",
    )

    serialized = _public_dto(exercise).model_dump()
    assert serialized["name"] == "Bench Press"
    assert serialized["muscles"][0]["group"] == "Chest"
    assert "owner_id" not in serialized
    assert "reviewed_by" not in serialized
    assert "review_notes" not in serialized
