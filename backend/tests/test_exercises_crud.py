from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import event
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from src.core.errors import DomainValidationError
from src.exercise_sets.models import ExerciseSet
from src.exercises import crud
from src.exercises.intensity_units import normalize_intensity_for_storage
from src.exercises.models import (
    Exercise,
    ExerciseMuscle,
    ExerciseType,
    IntensityUnit,
    Muscle,
    MuscleGroup,
)
from src.exercises.schemas import ExerciseCreate, ExerciseTypeCreate
from src.users.models import User
from src.workouts.models import Workout, WorkoutType


pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _seed_user(db_session, email: str) -> User:
    user = User(
        email=email,
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _seed_workout_type(db_session, name: str) -> WorkoutType:
    workout_type = WorkoutType(name=name, description=f"{name} description")
    db_session.add(workout_type)
    await db_session.flush()
    return workout_type


async def _seed_workout(
    db_session,
    owner_id: int,
    workout_type_id: int,
    name: str = "Workout",
) -> Workout:
    workout = Workout(
        name=name,
        start_time=datetime.now(timezone.utc),
        owner_id=owner_id,
        workout_type_id=workout_type_id,
    )
    db_session.add(workout)
    await db_session.flush()
    return workout


async def _seed_intensity_unit(
    db_session, name: str = "Kilograms", abbreviation: str = "kg"
) -> IntensityUnit:
    unit = IntensityUnit(name=name, abbreviation=abbreviation)
    db_session.add(unit)
    await db_session.flush()
    return unit


async def _seed_exercise_type(
    db_session,
    name: str,
    *,
    description: str = "Exercise",
    default_intensity_unit: int | None = None,
    times_used: int = 0,
    owner_id: int | None = None,
    status: ExerciseType.ExerciseTypeStatus = ExerciseType.ExerciseTypeStatus.released,
    released_at: datetime | None = None,
) -> ExerciseType:
    exercise_type = ExerciseType(
        name=name,
        description=description,
        default_intensity_unit=default_intensity_unit,
        times_used=times_used,
        owner_id=owner_id,
        status=status,
        released_at=released_at,
    )
    db_session.add(exercise_type)
    await db_session.flush()
    return exercise_type


async def _seed_exercise(
    db_session,
    *,
    workout_id: int,
    exercise_type_id: int,
    created_at: datetime,
    notes: str = "notes",
    deleted_at: datetime | None = None,
) -> Exercise:
    exercise = Exercise(
        workout_id=workout_id,
        exercise_type_id=exercise_type_id,
        notes=notes,
        timestamp=created_at,
        created_at=created_at,
        updated_at=created_at,
        deleted_at=deleted_at,
    )
    db_session.add(exercise)
    await db_session.flush()
    return exercise


async def _seed_exercise_set(
    db_session,
    *,
    exercise_id: int,
    intensity_unit_id: int,
    intensity,
    reps: int | None,
    created_at: datetime | None = None,
    deleted_at: datetime | None = None,
) -> ExerciseSet:
    timestamp = created_at or datetime.now(timezone.utc)
    intensity_unit = await db_session.get(IntensityUnit, intensity_unit_id)
    canonical_intensity, canonical_unit_key = normalize_intensity_for_storage(
        intensity,
        intensity_unit,
    )
    canonical_intensity_unit_id = intensity_unit_id
    if canonical_unit_key is not None:
        canonical_intensity_unit_id = (
            (
                await db_session.execute(
                    select(IntensityUnit).where(
                        func.lower(IntensityUnit.abbreviation) == canonical_unit_key
                    )
                )
            )
            .scalar_one()
            .id
        )
    exercise_set = ExerciseSet(
        exercise_id=exercise_id,
        intensity_unit_id=intensity_unit_id,
        intensity=intensity,
        canonical_intensity=canonical_intensity,
        canonical_intensity_unit_id=canonical_intensity_unit_id,
        reps=reps,
        created_at=timestamp,
        updated_at=timestamp,
        deleted_at=deleted_at,
    )
    db_session.add(exercise_set)
    await db_session.flush()
    return exercise_set


async def _seed_muscle_group(db_session, name: str) -> MuscleGroup:
    muscle_group = MuscleGroup(name=name)
    db_session.add(muscle_group)
    await db_session.flush()
    return muscle_group


async def _seed_muscle(db_session, name: str, muscle_group_id: int) -> Muscle:
    muscle = Muscle(name=name, muscle_group_id=muscle_group_id)
    db_session.add(muscle)
    await db_session.flush()
    return muscle


async def test_get_muscle_groups_orders_alphabetically(db_session):
    await _seed_muscle_group(db_session, "Legs Crud")
    await _seed_muscle_group(db_session, "Arms Crud")
    await db_session.commit()

    result = await crud.get_muscle_groups(db_session)

    assert [group.name for group in result] == ["Arms Crud", "Legs Crud"]


async def test_get_exercise_queries_filter_deleted_exercises_and_sets(db_session):
    owner = await _seed_user(db_session, "exercise-queries@example.com")
    workout_type = await _seed_workout_type(db_session, "Strength")
    workout = await _seed_workout(db_session, owner.id, workout_type.id)
    unit = await _seed_intensity_unit(db_session)
    exercise_type = await _seed_exercise_type(db_session, "Bench Press Query Test")
    deleted_at = datetime(2026, 1, 3, tzinfo=timezone.utc)

    first = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        notes="first",
    )
    deleted = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
        notes="deleted",
        deleted_at=deleted_at,
    )
    third = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 1, 4, tzinfo=timezone.utc),
        notes="third",
    )

    newer_kept_set = await _seed_exercise_set(
        db_session,
        exercise_id=first.id,
        intensity_unit_id=unit.id,
        intensity=100,
        reps=5,
        created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )
    older_kept_set = await _seed_exercise_set(
        db_session,
        exercise_id=first.id,
        intensity_unit_id=unit.id,
        intensity=95,
        reps=8,
        created_at=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc),
    )
    await _seed_exercise_set(
        db_session,
        exercise_id=first.id,
        intensity_unit_id=unit.id,
        intensity=120,
        reps=1,
        created_at=datetime(2026, 1, 3, tzinfo=timezone.utc),
        deleted_at=deleted_at,
    )
    await db_session.commit()

    found = await crud.get_exercise_by_id(db_session, first.id)
    assert found is not None
    assert found.id == first.id
    assert [exercise_set.id for exercise_set in found.exercise_sets] == [
        older_kept_set.id,
        newer_kept_set.id,
    ]
    assert await crud.get_exercise_by_id(db_session, deleted.id) is None

    exercises = await crud.get_exercises_for_workout(db_session, workout.id)
    assert [exercise.id for exercise in exercises] == [first.id, third.id]
    assert [exercise_set.id for exercise_set in exercises[0].exercise_sets] == [
        older_kept_set.id,
        newer_kept_set.id,
    ]


async def test_create_exercise_increments_times_used_and_loads_relationships(
    db_session,
):
    owner = await _seed_user(db_session, "exercise-create@example.com")
    workout_type = await _seed_workout_type(db_session, "Hypertrophy")
    workout = await _seed_workout(db_session, owner.id, workout_type.id)
    exercise_type = await _seed_exercise_type(
        db_session, "Incline Press Create Test", times_used=2
    )
    await db_session.commit()

    created = await crud.create_exercise(
        db_session,
        ExerciseCreate(
            timestamp=datetime(2026, 2, 1, 9, 30),
            notes="top set",
            exercise_type_id=exercise_type.id,
            workout_id=workout.id,
        ),
    )

    assert created.id is not None
    assert created.exercise_type.id == exercise_type.id
    assert created.workout_id == workout.id
    assert created.timestamp.tzinfo == timezone.utc

    refreshed_type = await crud.get_exercise_type_by_id(db_session, exercise_type.id)
    assert refreshed_type is not None
    assert refreshed_type.times_used == 3


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        (
            {"exercise_type_id": 999999, "workout_id": lambda ctx: ctx["workout_id"]},
            "exercise_type_id",
        ),
        (
            {
                "exercise_type_id": lambda ctx: ctx["exercise_type_id"],
                "workout_id": 999999,
            },
            "workout_id",
        ),
    ],
)
async def test_create_exercise_maps_invalid_foreign_keys(db_session, payload, field):
    owner = await _seed_user(db_session, f"{field}@example.com")
    workout_type = await _seed_workout_type(db_session, f"{field}-type")
    workout = await _seed_workout(db_session, owner.id, workout_type.id)
    exercise_type = await _seed_exercise_type(db_session, f"{field}-exercise")
    await db_session.commit()

    resolved = {
        key: value({"exercise_type_id": exercise_type.id, "workout_id": workout.id})
        if callable(value)
        else value
        for key, value in payload.items()
    }

    with pytest.raises(DomainValidationError) as exc_info:
        await crud.create_exercise(
            db_session,
            ExerciseCreate(
                notes="should fail",
                timestamp=datetime(2026, 2, 2, tzinfo=timezone.utc),
                exercise_type_id=resolved["exercise_type_id"],
                workout_id=resolved["workout_id"],
            ),
        )

    assert exc_info.value.field == field


async def test_get_exercise_types_orders_paginates_and_matches_names(db_session):
    suffix = "order-search"
    await _seed_exercise_type(
        db_session, f"Zercher Squat {suffix}", times_used=1, description="legs"
    )
    await _seed_exercise_type(
        db_session, f"Bench Press {suffix}", times_used=5, description="push"
    )
    await _seed_exercise_type(
        db_session, f"Arnold Press {suffix}", times_used=5, description="shoulders"
    )
    await db_session.commit()

    usage_page = await crud.get_exercise_types(
        db_session, order_by="usage", offset=0, limit=2
    )
    assert [exercise_type.name for exercise_type in usage_page.data] == [
        f"Arnold Press {suffix}",
        f"Bench Press {suffix}",
    ]
    assert usage_page.next_cursor == 2

    name_page = await crud.get_exercise_types(db_session, order_by="name", limit=10)
    assert [exercise_type.name for exercise_type in name_page.data[:3]] == [
        f"Arnold Press {suffix}",
        f"Bench Press {suffix}",
        f"Zercher Squat {suffix}",
    ]

    fallback_order_page = await crud.get_exercise_types(
        db_session, order_by="unexpected", limit=10
    )
    assert [exercise_type.name for exercise_type in fallback_order_page.data[:2]] == [
        f"Arnold Press {suffix}",
        f"Bench Press {suffix}",
    ]

    exact = await crud.get_exercise_types(
        db_session, name=f"bench press {suffix}", offset=0, limit=10
    )
    assert [exercise_type.name for exercise_type in exact.data] == [
        f"Bench Press {suffix}"
    ]
    assert exact.next_cursor is None

    db_session.add(ExerciseType(name="   ", description="skip me"))
    await db_session.commit()

    fuzzy = await crud.get_exercise_types(
        db_session, name=f"Bench Pres {suffix}", offset=0, limit=10
    )
    assert fuzzy.data
    assert fuzzy.data[0].name == f"Bench Press {suffix}"

    no_match = await crud.get_exercise_types(
        db_session, name="completely unrelated phrase", offset=0, limit=10
    )
    assert no_match.data == []
    assert no_match.next_cursor is None


async def test_get_exercise_types_filters_by_muscle_group_before_pagination(
    db_session,
):
    upper = await _seed_muscle_group(db_session, "Upper Body Filter")
    lower = await _seed_muscle_group(db_session, "Lower Body Filter")
    biceps = await _seed_muscle(db_session, "Biceps Filter", upper.id)
    quads = await _seed_muscle(db_session, "Quads Filter", lower.id)
    curl = await _seed_exercise_type(
        db_session, "Filter Biceps Curl", times_used=10, description="arms"
    )
    row = await _seed_exercise_type(
        db_session, "Filter Bent Row", times_used=8, description="back"
    )
    squat = await _seed_exercise_type(
        db_session, "Filter Back Squat", times_used=12, description="legs"
    )
    db_session.add_all(
        [
            ExerciseMuscle(exercise_type_id=curl.id, muscle_id=biceps.id),
            ExerciseMuscle(exercise_type_id=row.id, muscle_id=biceps.id),
            ExerciseMuscle(exercise_type_id=squat.id, muscle_id=quads.id),
        ]
    )
    await db_session.commit()

    result = await crud.get_exercise_types(
        db_session, muscle_group_id=upper.id, order_by="usage", limit=10
    )

    assert [item.id for item in result.data] == [curl.id, row.id]
    assert [item.name for item in result.data] == [
        "Filter Biceps Curl",
        "Filter Bent Row",
    ]
    assert result.next_cursor is None


async def test_get_exercise_types_applies_name_search_within_muscle_group_filter(
    db_session,
    monkeypatch,
):
    arms = await _seed_muscle_group(db_session, "Arms Search Filter")
    legs = await _seed_muscle_group(db_session, "Legs Search Filter")
    biceps = await _seed_muscle(db_session, "Biceps Search Filter", arms.id)
    quads = await _seed_muscle(db_session, "Quads Search Filter", legs.id)
    arms_type = await _seed_exercise_type(
        db_session, "Search Filter Curl", description="arms"
    )
    legs_type = await _seed_exercise_type(
        db_session, "Search Filter Squat", description="legs"
    )
    db_session.add_all(
        [
            ExerciseMuscle(exercise_type_id=arms_type.id, muscle_id=biceps.id),
            ExerciseMuscle(exercise_type_id=legs_type.id, muscle_id=quads.id),
        ]
    )
    await db_session.commit()

    monkeypatch.setattr(crud.process, "extractBests", lambda *args, **kwargs: [])
    monkeypatch.setattr(crud.process, "extractOne", lambda *args, **kwargs: None)

    no_match = await crud.get_exercise_types(
        db_session,
        name="search filter squat",
        muscle_group_id=arms.id,
        limit=10,
    )
    assert no_match.data == []

    exact = await crud.get_exercise_types(
        db_session,
        name="search filter curl",
        muscle_group_id=arms.id,
        limit=10,
    )
    assert [item.id for item in exact.data] == [arms_type.id]


async def test_get_exercise_types_uses_extract_one_fallback(db_session, monkeypatch):
    exercise_type = await _seed_exercise_type(
        db_session, "Fallback Lift", description="fallback"
    )
    await db_session.commit()

    monkeypatch.setattr(crud.process, "extractBests", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        crud.process,
        "extractOne",
        lambda *args, **kwargs: ("Fallback Lift", 61),
    )

    accepted = await crud.get_exercise_types(db_session, name="fallbak lift", limit=10)
    assert [item.id for item in accepted.data] == [exercise_type.id]

    monkeypatch.setattr(
        crud.process,
        "extractOne",
        lambda *args, **kwargs: ("Fallback Lift", 59),
    )

    rejected = await crud.get_exercise_types(db_session, name="fallbak lift", limit=10)
    assert rejected.data == []
    assert rejected.next_cursor is None


async def test_get_exercise_types_preserves_fuzzy_order_after_hydration(
    db_session, monkeypatch
):
    first = await _seed_exercise_type(db_session, "First Ranked Lift")
    second = await _seed_exercise_type(db_session, "Second Ranked Lift")
    await db_session.commit()

    monkeypatch.setattr(
        crud.process,
        "extractBests",
        lambda *args, **kwargs: [
            ("Second Ranked Lift", 95),
            ("First Ranked Lift", 90),
        ],
    )

    result = await crud.get_exercise_types(db_session, name="ranked", limit=10)

    assert [item.id for item in result.data] == [second.id, first.id]
    assert [item.name for item in result.data] == [
        "Second Ranked Lift",
        "First Ranked Lift",
    ]
    assert result.next_cursor is None


async def test_get_exercise_types_exact_match_prefers_released_before_owned_draft(
    db_session,
):
    owner = await _seed_user(db_session, "exact-precedence@example.com")
    released = await _seed_exercise_type(
        db_session,
        "Bench Press",
        released_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    owner_candidate = await _seed_exercise_type(
        db_session,
        "Bench Press",
        owner_id=owner.id,
        status=ExerciseType.ExerciseTypeStatus.candidate,
    )
    await db_session.commit()

    first_page = await crud.get_exercise_types(
        db_session,
        name="Bench Press",
        user_id=owner.id,
        offset=0,
        limit=1,
    )
    second_page = await crud.get_exercise_types(
        db_session,
        name="Bench Press",
        user_id=owner.id,
        offset=1,
        limit=1,
    )

    assert [item.id for item in first_page.data] == [released.id]
    assert [item.id for item in second_page.data] == [owner_candidate.id]


async def test_create_exercise_type_creates_muscles_and_is_idempotent(db_session):
    unit = await _seed_intensity_unit(db_session, "Pounds", "lb")
    group = await _seed_muscle_group(db_session, "Upper Body")
    biceps = await _seed_muscle(db_session, "Biceps", group.id)
    back = await _seed_muscle(db_session, "Back", group.id)
    await db_session.commit()

    created = await crud.create_exercise_type(
        db_session,
        ExerciseTypeCreate(
            name="Weighted Chin-Up",
            description="Pull movement",
            default_intensity_unit=unit.id,
            muscle_ids=[biceps.id, back.id],
        ),
    )

    assert created.default_intensity_unit == unit.id
    assert {item.muscle.id for item in created.exercise_muscles} == {
        biceps.id,
        back.id,
    }
    assert all(item.is_primary is False for item in created.exercise_muscles)

    duplicate = await crud.create_exercise_type(
        db_session,
        ExerciseTypeCreate(
            name="Weighted Chin-Up",
            description="Duplicate insert",
            default_intensity_unit=unit.id,
        ),
    )
    count = await db_session.scalar(
        select(func.count())
        .select_from(ExerciseType)
        .where(ExerciseType.name == "Weighted Chin-Up")
    )

    assert duplicate.id == created.id
    assert count == 1


async def test_exercise_type_visibility_filters_by_user_and_status(db_session):
    owner = await _seed_user(db_session, "visibility-owner@example.com")
    other_user = await _seed_user(db_session, "visibility-other@example.com")

    released = await _seed_exercise_type(
        db_session,
        "Visibility Released",
        released_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    owner_candidate = await _seed_exercise_type(
        db_session,
        "Visibility Owner Candidate",
        owner_id=owner.id,
        status=ExerciseType.ExerciseTypeStatus.candidate,
    )
    owner_in_review = await _seed_exercise_type(
        db_session,
        "Visibility Owner Review",
        owner_id=owner.id,
        status=ExerciseType.ExerciseTypeStatus.in_review,
    )
    other_candidate = await _seed_exercise_type(
        db_session,
        "Visibility Other Candidate",
        owner_id=other_user.id,
        status=ExerciseType.ExerciseTypeStatus.candidate,
    )
    await db_session.commit()

    anonymous = await crud.get_exercise_types(db_session)
    assert [item.id for item in anonymous.data] == [released.id]

    owner_visible = await crud.get_exercise_types(db_session, user_id=owner.id)
    assert {item.id for item in owner_visible.data} == {
        released.id,
        owner_candidate.id,
        owner_in_review.id,
    }

    other_visible = await crud.get_exercise_types(db_session, user_id=other_user.id)
    assert {item.id for item in other_visible.data} == {
        released.id,
        other_candidate.id,
    }

    admin_visible = await crud.get_exercise_types(db_session, is_admin=True)
    assert {item.id for item in admin_visible.data} == {
        released.id,
        owner_candidate.id,
        owner_in_review.id,
        other_candidate.id,
    }

    owner_detail = await crud.get_exercise_type_by_id(
        db_session,
        owner_candidate.id,
        user_id=owner.id,
    )
    assert owner_detail is not None

    hidden_detail = await crud.get_exercise_type_by_id(
        db_session,
        owner_candidate.id,
        user_id=other_user.id,
    )
    assert hidden_detail is None

    admin_detail = await crud.get_exercise_type_by_id(
        db_session,
        owner_candidate.id,
        is_admin=True,
    )
    assert admin_detail is not None

    anonymous_search = await crud.get_exercise_types(
        db_session,
        name="Visibility Owner Candidate",
    )
    assert owner_candidate.id not in {item.id for item in anonymous_search.data}

    owner_search = await crud.get_exercise_types(
        db_session,
        name="Visibility Owner Candidate",
        user_id=owner.id,
    )
    assert [item.id for item in owner_search.data] == [owner_candidate.id]


async def test_exercise_type_review_lifecycle_updates_status_and_release_metadata(
    db_session,
):
    owner = await _seed_user(db_session, "review-owner@example.com")
    reviewer = await _seed_user(db_session, "review-admin@example.com")
    await db_session.commit()

    created = await crud.create_exercise_type(
        db_session,
        ExerciseTypeCreate(
            name="Lifecycle Exercise",
            description="Review me",
        ),
        owner_id=owner.id,
    )

    assert created.owner_id == owner.id
    assert created.status == ExerciseType.ExerciseTypeStatus.candidate
    assert created.released_at is None

    in_review = await crud.request_exercise_type_evaluation(db_session, created)
    assert in_review is not None
    assert in_review.status == ExerciseType.ExerciseTypeStatus.in_review
    assert in_review.review_requested_at is not None

    released = await crud.release_exercise_type(
        db_session,
        in_review,
        reviewer_id=reviewer.id,
        review_notes="Looks good",
    )
    assert released is not None
    assert released.status == ExerciseType.ExerciseTypeStatus.released
    assert released.released_at is not None
    assert released.reviewed_by == reviewer.id
    assert released.review_notes == "Looks good"

    public_detail = await crud.get_exercise_type_by_id(db_session, released.id)
    assert public_detail is not None


async def test_create_exercise_type_rejects_missing_muscles_and_invalid_unit(
    db_session,
):
    with pytest.raises(ValueError, match="Muscle IDs not found: 999"):
        await crud.create_exercise_type(
            db_session,
            ExerciseTypeCreate(
                name="Missing Muscles",
                description="Should fail",
                muscle_ids=[999],
            ),
        )

    with pytest.raises(IntegrityError):
        await crud.create_exercise_type(
            db_session,
            ExerciseTypeCreate(
                name="Invalid Unit",
                description="Should fail",
                default_intensity_unit=999,
            ),
        )


async def test_get_intensity_units_and_exercise_type_by_id(db_session):
    await _seed_intensity_unit(db_session, "Kilograms", "kg")
    await _seed_intensity_unit(db_session, "Pounds", "lb")
    exercise_type = await _seed_exercise_type(db_session, "Lookup Exercise")
    await db_session.commit()

    intensity_units = await crud.get_intensity_units(db_session)
    assert {(unit.name, unit.abbreviation) for unit in intensity_units} == {
        ("Kilograms", "kg"),
        ("Pounds", "lb"),
    }

    found = await crud.get_exercise_type_by_id(db_session, exercise_type.id)
    assert found is not None
    assert found.id == exercise_type.id
    assert await crud.get_exercise_type_by_id(db_session, 999999) is None


async def test_get_exercise_type_by_id_uses_single_joined_query(db_session):
    group = await _seed_muscle_group(db_session, "Back")
    muscle = await _seed_muscle(db_session, "Lats", group.id)
    exercise_type = await _seed_exercise_type(db_session, "Pull-Up")
    exercise_type_id = exercise_type.id
    db_session.add(
        ExerciseMuscle(
            exercise_type_id=exercise_type_id,
            muscle_id=muscle.id,
            is_primary=True,
        )
    )
    await db_session.commit()
    db_session.expire_all()

    statements: list[str] = []

    def capture_selects(
        conn, cursor, statement, parameters, context, executemany
    ) -> None:
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    sync_engine = db_session.bind.sync_engine
    event.listen(sync_engine, "before_cursor_execute", capture_selects)
    try:
        found = await crud.get_exercise_type_by_id(db_session, exercise_type_id)
    finally:
        event.remove(sync_engine, "before_cursor_execute", capture_selects)

    assert found is not None
    assert len(statements) == 1
    assert found.exercise_muscles[0].muscle.name == "Lats"
    assert found.exercise_muscles[0].muscle.muscle_group.name == "Back"


async def test_get_exercise_type_stats_handles_missing_empty_and_populated_cases(
    db_session,
):
    owner = await _seed_user(db_session, "stats@example.com")

    missing = await crud.get_exercise_type_stats(db_session, 999999, owner.id)
    assert missing == {
        "progressiveOverload": [],
        "lastWorkout": None,
        "personalBest": None,
        "totalSets": 0,
        "intensityUnit": None,
    }

    workout_type = await _seed_workout_type(db_session, "Stats Type")
    workout = await _seed_workout(
        db_session, owner.id, workout_type.id, "Stats Workout"
    )
    unit = await _seed_intensity_unit(db_session, "Kilograms", "kg")
    pounds_unit = await _seed_intensity_unit(db_session, "Pounds", "lbs")
    exercise_type = await _seed_exercise_type(
        db_session,
        "Stats Exercise",
        default_intensity_unit=unit.id,
    )
    await db_session.commit()

    empty = await crud.get_exercise_type_stats(db_session, exercise_type.id, owner.id)
    assert empty == {
        "progressiveOverload": [],
        "lastWorkout": None,
        "personalBest": None,
        "totalSets": 0,
        "intensityUnit": {"id": unit.id, "name": "Kilograms", "abbreviation": "kg"},
    }

    first = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc),
        notes="first",
    )
    second = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc),
        notes="second",
    )
    deleted_exercise = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 1, 7, 12, 0, tzinfo=timezone.utc),
        notes="deleted exercise",
        deleted_at=datetime(2026, 1, 8, tzinfo=timezone.utc),
    )
    other_owner = await _seed_user(db_session, "other-stats@example.com")
    other_workout = await _seed_workout(
        db_session, other_owner.id, workout_type.id, "Other Stats Workout"
    )
    other_exercise = await _seed_exercise(
        db_session,
        workout_id=other_workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 1, 9, 12, 0, tzinfo=timezone.utc),
        notes="other owner",
    )
    deleted_at = datetime(2026, 1, 6, tzinfo=timezone.utc)
    await _seed_exercise_set(
        db_session,
        exercise_id=first.id,
        intensity_unit_id=unit.id,
        intensity=100,
        reps=5,
    )
    await _seed_exercise_set(
        db_session,
        exercise_id=first.id,
        intensity_unit_id=unit.id,
        intensity=105,
        reps=3,
    )
    await _seed_exercise_set(
        db_session,
        exercise_id=first.id,
        intensity_unit_id=unit.id,
        intensity=999,
        reps=1,
        deleted_at=deleted_at,
    )
    await _seed_exercise_set(
        db_session,
        exercise_id=second.id,
        intensity_unit_id=pounds_unit.id,
        intensity=225,
        reps=2,
    )
    await _seed_exercise_set(
        db_session,
        exercise_id=second.id,
        intensity_unit_id=unit.id,
        intensity=90,
        reps=None,
    )
    await _seed_exercise_set(
        db_session,
        exercise_id=deleted_exercise.id,
        intensity_unit_id=unit.id,
        intensity=400,
        reps=1,
    )
    await _seed_exercise_set(
        db_session,
        exercise_id=other_exercise.id,
        intensity_unit_id=unit.id,
        intensity=500,
        reps=1,
    )
    await db_session.commit()

    stats = await crud.get_exercise_type_stats(db_session, exercise_type.id, owner.id)

    assert stats["progressiveOverload"] == [
        {"date": "2026-01-01", "maxWeight": 105, "totalVolume": 815, "reps": 8},
        {
            "date": "2026-01-05",
            "maxWeight": 102.058,
            "totalVolume": 204.116,
            "reps": 2,
        },
    ]
    assert stats["lastWorkout"] == {
        "date": "2026-01-05T12:00:00+00:00",
        "sets": 2,
        "totalReps": 2,
        "maxWeight": 102.058,
        "totalVolume": 204.116,
    }
    assert stats["personalBest"] == {
        "date": "2026-01-01T12:00:00+00:00",
        "weight": 105,
        "reps": 3,
        "volume": 315,
    }
    assert stats["totalSets"] == 4
    assert stats["intensityUnit"] == {
        "id": unit.id,
        "name": "Kilograms",
        "abbreviation": "kg",
    }

    other_owner_stats = await crud.get_exercise_type_stats(
        db_session, exercise_type.id, other_owner.id
    )
    assert other_owner_stats["progressiveOverload"] == [
        {"date": "2026-01-09", "maxWeight": 500, "totalVolume": 500, "reps": 1}
    ]
    assert other_owner_stats["lastWorkout"] == {
        "date": "2026-01-09T12:00:00+00:00",
        "sets": 1,
        "totalReps": 1,
        "maxWeight": 500,
        "totalVolume": 500,
    }
    assert other_owner_stats["personalBest"] == {
        "date": "2026-01-09T12:00:00+00:00",
        "weight": 500,
        "reps": 1,
        "volume": 500,
    }
    assert other_owner_stats["totalSets"] == 1


async def test_get_exercise_type_stats_last_workout_handles_no_active_sets(db_session):
    owner = await _seed_user(db_session, "stats-no-active-sets@example.com")
    workout_type = await _seed_workout_type(db_session, "Stats No Active Sets Type")
    workout = await _seed_workout(
        db_session, owner.id, workout_type.id, "Stats Workout"
    )
    unit = await _seed_intensity_unit(db_session, "Kilograms", "kg")
    exercise_type = await _seed_exercise_type(
        db_session,
        "Stats No Active Sets Exercise",
        default_intensity_unit=unit.id,
    )

    populated_exercise = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc),
        notes="populated",
    )
    latest_exercise = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 1, 2, 12, 0, tzinfo=timezone.utc),
        notes="latest",
    )
    await _seed_exercise_set(
        db_session,
        exercise_id=populated_exercise.id,
        intensity_unit_id=unit.id,
        intensity=100,
        reps=5,
    )
    await _seed_exercise_set(
        db_session,
        exercise_id=latest_exercise.id,
        intensity_unit_id=unit.id,
        intensity=110,
        reps=3,
        deleted_at=datetime(2026, 1, 2, 12, 30, tzinfo=timezone.utc),
    )
    await db_session.commit()

    stats = await crud.get_exercise_type_stats(db_session, exercise_type.id, owner.id)

    assert stats["lastWorkout"] == {
        "date": "2026-01-02T12:00:00+00:00",
        "sets": 0,
        "totalReps": 0,
        "maxWeight": 0,
        "totalVolume": 0,
    }
    assert stats["personalBest"] == {
        "date": "2026-01-01T12:00:00+00:00",
        "weight": 100,
        "reps": 5,
        "volume": 500,
    }
    assert stats["totalSets"] == 1


async def test_get_exercise_type_stats_handles_latest_exercise_without_sets(db_session):
    owner = await _seed_user(db_session, "stats-no-sets@example.com")
    workout_type = await _seed_workout_type(db_session, "Stats Empty Latest Type")
    workout = await _seed_workout(
        db_session, owner.id, workout_type.id, "Stats Empty Latest Workout"
    )
    unit = await _seed_intensity_unit(db_session, "Kilograms", "kg")
    exercise_type = await _seed_exercise_type(
        db_session,
        "Stats Empty Latest Exercise",
        default_intensity_unit=unit.id,
    )

    previous_exercise = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 2, 1, 12, 0, tzinfo=timezone.utc),
        notes="previous",
    )
    latest_exercise = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 2, 3, 12, 0, tzinfo=timezone.utc),
        notes="latest without sets",
    )
    await _seed_exercise_set(
        db_session,
        exercise_id=previous_exercise.id,
        intensity_unit_id=unit.id,
        intensity=80,
        reps=5,
    )
    await db_session.commit()

    stats = await crud.get_exercise_type_stats(db_session, exercise_type.id, owner.id)

    assert stats["progressiveOverload"] == [
        {"date": "2026-02-01", "maxWeight": 80, "totalVolume": 400, "reps": 5},
        {"date": "2026-02-03", "maxWeight": 0, "totalVolume": 0, "reps": 0},
    ]
    assert stats["lastWorkout"] == {
        "date": latest_exercise.created_at.isoformat(),
        "sets": 0,
        "totalReps": 0,
        "maxWeight": 0,
        "totalVolume": 0,
    }
    assert stats["personalBest"] == {
        "date": previous_exercise.created_at.isoformat(),
        "weight": 80,
        "reps": 5,
        "volume": 400,
    }
    assert stats["totalSets"] == 1


async def test_soft_delete_exercise_marks_active_sets_and_handles_missing(db_session):
    owner = await _seed_user(db_session, "soft-delete@example.com")
    workout_type = await _seed_workout_type(db_session, "Delete Type")
    workout = await _seed_workout(db_session, owner.id, workout_type.id)
    unit = await _seed_intensity_unit(db_session)
    exercise_type = await _seed_exercise_type(db_session, "Delete Exercise")
    exercise = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 2, 10, tzinfo=timezone.utc),
    )
    existing_deleted_at = datetime(2026, 2, 11, tzinfo=timezone.utc)
    active_set = await _seed_exercise_set(
        db_session,
        exercise_id=exercise.id,
        intensity_unit_id=unit.id,
        intensity=80,
        reps=8,
    )
    already_deleted_set = await _seed_exercise_set(
        db_session,
        exercise_id=exercise.id,
        intensity_unit_id=unit.id,
        intensity=90,
        reps=5,
        deleted_at=existing_deleted_at,
    )
    await db_session.commit()

    assert await crud.soft_delete_exercise(db_session, 999999) is False
    assert await crud.soft_delete_exercise(db_session, exercise.id) is True

    await db_session.refresh(exercise)
    await db_session.refresh(active_set)
    await db_session.refresh(already_deleted_set)

    assert exercise.deleted_at is not None
    assert active_set.deleted_at == exercise.deleted_at
    assert already_deleted_set.deleted_at == existing_deleted_at


async def test_soft_delete_exercise_rolls_back_when_commit_fails(
    db_session, monkeypatch
):
    owner = await _seed_user(db_session, "soft-delete-failure@example.com")
    workout_type = await _seed_workout_type(db_session, "Delete Failure Type")
    workout = await _seed_workout(db_session, owner.id, workout_type.id)
    exercise_type = await _seed_exercise_type(db_session, "Delete Failure Exercise")
    exercise = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 2, 12, tzinfo=timezone.utc),
    )
    await db_session.commit()

    rollback = AsyncMock()
    monkeypatch.setattr(
        db_session,
        "commit",
        AsyncMock(side_effect=RuntimeError("commit failed")),
    )
    monkeypatch.setattr(db_session, "rollback", rollback)

    with pytest.raises(RuntimeError, match="commit failed"):
        await crud.soft_delete_exercise(db_session, exercise.id)

    rollback.assert_awaited_once()


async def test_exercise_owner_queries_respect_user_and_deleted_state(db_session):
    owner = await _seed_user(db_session, "owner@example.com")
    other = await _seed_user(db_session, "other@example.com")
    workout_type = await _seed_workout_type(db_session, "Ownership Type")
    workout = await _seed_workout(db_session, owner.id, workout_type.id)
    exercise_type = await _seed_exercise_type(db_session, "Ownership Exercise")
    active = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 2, 13, tzinfo=timezone.utc),
    )
    deleted = await _seed_exercise(
        db_session,
        workout_id=workout.id,
        exercise_type_id=exercise_type.id,
        created_at=datetime(2026, 2, 14, tzinfo=timezone.utc),
        deleted_at=datetime(2026, 2, 15, tzinfo=timezone.utc),
    )
    await db_session.commit()

    assert await crud.get_exercise_owner_id(db_session, active.id) == owner.id
    assert await crud.get_exercise_owner_id(db_session, 999999) is None

    verified = await crud.verify_exercise_ownership(db_session, active.id, owner.id)
    assert verified is not None
    assert verified.id == active.id
    assert await crud.verify_exercise_ownership(db_session, active.id, other.id) is None
    assert (
        await crud.verify_exercise_ownership(db_session, deleted.id, owner.id) is None
    )
