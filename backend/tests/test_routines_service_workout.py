import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal
from datetime import datetime, timezone

from sqlalchemy import select, func
from src.routines.service import routine_service
from src.routines.models import Routine, ExerciseTemplate, SetTemplate
from src.exercises.models import ExerciseType, IntensityUnit
from src.exercises.models import Exercise
from src.exercise_sets.models import ExerciseSet
from src.workouts.models import Workout, WorkoutType
from src.workouts.schemas import SaveWorkoutAsRoutineRequest
from src.users.models import User


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_workout_from_routine_success(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """Service creates a workout from a routine with nested templates."""
    wt = WorkoutType(name="Strength Svc", description="desc")
    iu = IntensityUnit(name="Kilograms", abbreviation="kg")
    db_session.add_all([wt, iu])
    await db_session.flush()

    et = ExerciseType(
        name="Svc Exercise", description="x", default_intensity_unit=iu.id
    )
    db_session.add(et)
    await db_session.flush()

    user = User(
        email="svc@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    # Create a routine with one exercise template and two set templates
    r = Routine(name="Svc Routine", workout_type_id=wt.id, creator_id=user.id)
    db_session.add(r)
    await db_session.flush()

    etmpl = ExerciseTemplate(exercise_type_id=et.id, routine_id=r.id)
    db_session.add(etmpl)
    await db_session.flush()

    db_session.add_all(
        [
            SetTemplate(
                reps=12,
                duration_seconds=900,
                intensity=30.0,
                intensity_unit_id=iu.id,
                exercise_template_id=etmpl.id,
            ),
            SetTemplate(
                reps=10,
                intensity=35.0,
                intensity_unit_id=iu.id,
                exercise_template_id=etmpl.id,
            ),
        ]
    )
    await db_session.commit()

    commit_calls = 0
    original_commit = db_session.commit

    async def tracked_commit():
        nonlocal commit_calls
        commit_calls += 1
        return await original_commit()

    monkeypatch.setattr(db_session, "commit", tracked_commit)

    # Act
    workout = await routine_service.create_workout_from_routine(
        db_session, user.id, r.id
    )

    # Assert workout created
    assert workout is not None
    assert workout.workout_type_id == wt.id
    assert commit_calls == 1
    assert len(workout.exercises) == 1
    assert len(workout.exercises[0].exercise_sets) == 2

    created_exercise = workout.exercises[0]
    first_set = created_exercise.exercise_sets[0]
    second_set = created_exercise.exercise_sets[1]
    assert isinstance(first_set.intensity_unit, IntensityUnit)
    assert isinstance(first_set.canonical_intensity_unit, IntensityUnit)
    assert first_set.intensity_unit.id == iu.id
    assert first_set.canonical_intensity_unit.id == iu.id
    assert isinstance(second_set.intensity_unit, IntensityUnit)
    assert isinstance(second_set.canonical_intensity_unit, IntensityUnit)
    assert second_set.intensity_unit.id == iu.id
    assert second_set.canonical_intensity_unit.id == iu.id

    # Verify via explicit queries to avoid async lazy-load in tests
    res = await db_session.execute(
        select(func.count())
        .select_from(Exercise)
        .where(Exercise.workout_id == workout.id)
    )
    exercise_count = res.scalar()
    assert exercise_count == 1

    res2 = await db_session.execute(
        select(Exercise.id).where(Exercise.workout_id == workout.id)
    )
    ex_id = res2.scalar_one()

    from src.exercise_sets.models import ExerciseSet

    res3 = await db_session.execute(
        select(ExerciseSet)
        .where(ExerciseSet.exercise_id == ex_id)
        .order_by(ExerciseSet.id)
    )
    created_sets = res3.scalars().all()
    assert len(created_sets) == 2
    assert {exercise_set.duration_seconds for exercise_set in created_sets} == {
        900,
        None,
    }
    assert {exercise_set.canonical_intensity for exercise_set in created_sets} == {
        Decimal("30.00000"),
        Decimal("35.00000"),
    }
    assert {
        exercise_set.canonical_intensity_unit_id for exercise_set in created_sets
    } == {iu.id}


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_workout_from_routine_resolves_canonical_intensity_unit(
    db_session: AsyncSession,
):
    """Service should store the canonical intensity unit, not the source unit."""
    wt = WorkoutType(name="Strength Canonical", description="desc")
    kg = IntensityUnit(name="Kilograms", abbreviation="kg")
    lbs = IntensityUnit(name="Pounds", abbreviation="lbs")
    db_session.add_all([wt, kg, lbs])
    await db_session.flush()

    et = ExerciseType(
        name="Canonical Exercise", description="x", default_intensity_unit=lbs.id
    )
    db_session.add(et)
    await db_session.flush()

    user = User(
        email="canonical@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    r = Routine(name="Canonical Routine", workout_type_id=wt.id, creator_id=user.id)
    db_session.add(r)
    await db_session.flush()

    etmpl = ExerciseTemplate(exercise_type_id=et.id, routine_id=r.id)
    db_session.add(etmpl)
    await db_session.flush()

    db_session.add(
        SetTemplate(
            reps=10,
            intensity=100.0,
            intensity_unit_id=lbs.id,
            exercise_template_id=etmpl.id,
        )
    )
    await db_session.commit()

    workout = await routine_service.create_workout_from_routine(
        db_session, user.id, r.id
    )

    from src.exercise_sets.models import ExerciseSet

    res = await db_session.execute(
        select(ExerciseSet).join(Exercise).where(Exercise.workout_id == workout.id)
    )
    created_set = res.scalar_one()
    assert created_set.intensity_unit_id == lbs.id
    assert created_set.canonical_intensity_unit_id == kg.id
    assert workout.exercises[0].exercise_sets[0].intensity_unit_id == lbs.id
    assert workout.exercises[0].exercise_sets[0].canonical_intensity_unit_id == kg.id


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_workout_from_routine_preserves_source_unit_when_no_intensity(
    db_session: AsyncSession,
):
    """Service should fall back to the source unit when no canonical key is derived."""
    wt = WorkoutType(name="Strength No Intensity", description="desc")
    lbs = IntensityUnit(name="Pounds", abbreviation="lbs")
    db_session.add_all([wt, lbs])
    await db_session.flush()

    et = ExerciseType(
        name="No Intensity Exercise", description="x", default_intensity_unit=lbs.id
    )
    db_session.add(et)
    await db_session.flush()

    user = User(
        email="no-intensity@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    routine = Routine(
        name="No Intensity Routine",
        workout_type_id=wt.id,
        creator_id=user.id,
    )
    db_session.add(routine)
    await db_session.flush()

    exercise_template = ExerciseTemplate(exercise_type_id=et.id, routine_id=routine.id)
    db_session.add(exercise_template)
    await db_session.flush()

    db_session.add(
        SetTemplate(
            reps=8,
            intensity=None,
            intensity_unit_id=lbs.id,
            exercise_template_id=exercise_template.id,
        )
    )
    await db_session.commit()

    workout = await routine_service.create_workout_from_routine(
        db_session, user.id, routine.id
    )

    created_set = workout.exercises[0].exercise_sets[0]
    assert created_set.canonical_intensity is None
    assert created_set.intensity_unit_id == lbs.id
    assert created_set.canonical_intensity_unit_id == lbs.id
    assert created_set.canonical_intensity_unit.id == lbs.id


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clone_public_workout_to_private_routine_strips_sensitive_fields(
    db_session: AsyncSession,
):
    workout_type = WorkoutType(name="Clone Source", description="desc")
    kg = IntensityUnit(name="Kilograms", abbreviation="kg")
    db_session.add_all([workout_type, kg])
    await db_session.flush()

    exercise_type = ExerciseType(
        name="Clone Exercise",
        description="x",
        default_intensity_unit=kg.id,
    )
    db_session.add(exercise_type)
    await db_session.flush()

    owner = User(
        email="clone-owner@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    viewer = User(
        email="clone-viewer@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add_all([owner, viewer])
    await db_session.flush()

    source_workout = Workout(
        name="Public Push Day",
        notes="Private workout note",
        recap="Sensitive recap",
        start_time=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc),
        end_time=datetime(2026, 4, 20, 13, 0, tzinfo=timezone.utc),
        workout_type_id=workout_type.id,
        owner_id=owner.id,
        visibility=Workout.WorkoutVisibility.public,
    )
    db_session.add(source_workout)
    await db_session.flush()

    exercise = Exercise(
        timestamp=source_workout.start_time,
        notes="Private exercise note",
        exercise_type_id=exercise_type.id,
        workout_id=source_workout.id,
    )
    db_session.add(exercise)
    await db_session.flush()

    db_session.add(
        ExerciseSet(
            reps=8,
            duration_seconds=90,
            intensity=Decimal("100.0"),
            rpe=Decimal("8.5"),
            rir=Decimal("1.5"),
            intensity_unit_id=kg.id,
            canonical_intensity=Decimal("100.00000"),
            canonical_intensity_unit_id=kg.id,
            exercise_id=exercise.id,
            rest_time_seconds=180,
            done=True,
            notes="Private set note",
            type="working",
        )
    )
    db_session.add(
        ExerciseSet(
            reps=99,
            intensity_unit_id=kg.id,
            exercise_id=exercise.id,
            done=True,
            deleted_at=datetime(2026, 4, 20, 13, 30, tzinfo=timezone.utc),
            type="working",
        )
    )
    deleted_exercise = Exercise(
        timestamp=source_workout.start_time,
        notes="Deleted exercise note",
        exercise_type_id=exercise_type.id,
        workout_id=source_workout.id,
        deleted_at=datetime(2026, 4, 20, 13, 45, tzinfo=timezone.utc),
    )
    db_session.add(deleted_exercise)
    await db_session.commit()

    routine = await routine_service.clone_public_workout_to_private_routine(
        db_session,
        source_workout_id=source_workout.id,
        user_id=viewer.id,
        clone_request=SaveWorkoutAsRoutineRequest(
            name="Viewer Routine",
            description="Reusable copy",
        ),
    )

    assert routine.name == "Viewer Routine"
    assert routine.description == "Reusable copy"
    assert routine.creator_id == viewer.id
    assert routine.visibility == Routine.RoutineVisibility.private
    assert routine.workout_type_id == workout_type.id
    assert len(routine.exercise_templates) == 1

    cloned_exercise = routine.exercise_templates[0]
    assert cloned_exercise.exercise_type_id == exercise_type.id
    assert cloned_exercise.notes is None
    assert len(cloned_exercise.set_templates) == 1

    cloned_set = cloned_exercise.set_templates[0]
    assert cloned_set.reps == 8
    assert cloned_set.duration_seconds == 90
    assert cloned_set.intensity == Decimal("100.0")
    assert cloned_set.rpe == Decimal("8.5")
    assert cloned_set.rir == Decimal("1.5")
    assert cloned_set.intensity_unit_id == kg.id
    assert cloned_set.type == "working"
    assert cloned_set.notes is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clone_public_workout_to_private_routine_rejects_private_or_open_source(
    db_session: AsyncSession,
):
    workout_type = WorkoutType(name="Clone Guard", description="desc")
    db_session.add(workout_type)
    await db_session.flush()

    owner = User(
        email="clone-guard-owner@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    viewer = User(
        email="clone-guard-viewer@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add_all([owner, viewer])
    await db_session.flush()

    private_workout = Workout(
        name="Private Workout",
        start_time=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc),
        end_time=datetime(2026, 4, 20, 13, 0, tzinfo=timezone.utc),
        workout_type_id=workout_type.id,
        owner_id=owner.id,
        visibility=Workout.WorkoutVisibility.private,
    )
    open_public_workout = Workout(
        name="Open Workout",
        start_time=datetime(2026, 4, 20, 14, 0, tzinfo=timezone.utc),
        end_time=None,
        workout_type_id=workout_type.id,
        owner_id=owner.id,
        visibility=Workout.WorkoutVisibility.public,
    )
    db_session.add_all([private_workout, open_public_workout])
    await db_session.commit()

    with pytest.raises(LookupError, match="Workout not found"):
        await routine_service.clone_public_workout_to_private_routine(
            db_session,
            source_workout_id=private_workout.id,
            user_id=viewer.id,
        )

    with pytest.raises(LookupError, match="Workout not found"):
        await routine_service.clone_public_workout_to_private_routine(
            db_session,
            source_workout_id=open_public_workout.id,
            user_id=viewer.id,
        )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_workout_from_routine_not_accessible_raises(
    db_session: AsyncSession,
):
    """Service raises ValueError when the routine is not accessible or missing."""
    # Two users, routine owned by one
    wt = WorkoutType(name="Strength Svc2", description="desc")
    db_session.add(wt)
    await db_session.flush()

    u1 = User(
        email="a@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    u2 = User(
        email="b@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add_all([u1, u2])
    await db_session.flush()

    r = Routine(name="Private", workout_type_id=wt.id, creator_id=u1.id)
    db_session.add(r)
    await db_session.commit()

    # Different user cannot access -> ValueError
    with pytest.raises(ValueError):
        await routine_service.create_workout_from_routine(db_session, u2.id, r.id)

    # Non-existent id also raises
    with pytest.raises(ValueError):
        await routine_service.create_workout_from_routine(db_session, u1.id, 999999)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_workout_from_public_routine_allows_nonreleased_exercise_types(
    db_session: AsyncSession,
):
    wt = WorkoutType(name="Strength Hidden Exercise", description="desc")
    iu = IntensityUnit(name="Kilograms", abbreviation="kg")
    db_session.add_all([wt, iu])
    await db_session.flush()

    routine_owner = User(
        email="routine-owner@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    viewer = User(
        email="routine-viewer@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add_all([routine_owner, viewer])
    await db_session.flush()

    hidden_exercise_type = ExerciseType(
        name="Hidden Draft Exercise",
        description="x",
        default_intensity_unit=iu.id,
        owner_id=routine_owner.id,
        status=ExerciseType.ExerciseTypeStatus.candidate,
    )
    db_session.add(hidden_exercise_type)
    await db_session.flush()

    public_routine = Routine(
        name="Public Routine With Hidden Exercise",
        workout_type_id=wt.id,
        creator_id=routine_owner.id,
        visibility=Routine.RoutineVisibility.public,
    )
    db_session.add(public_routine)
    await db_session.flush()

    exercise_template = ExerciseTemplate(
        exercise_type_id=hidden_exercise_type.id,
        routine_id=public_routine.id,
    )
    db_session.add(exercise_template)
    await db_session.flush()

    db_session.add(
        SetTemplate(
            reps=8,
            duration_seconds=300,
            intensity=40.0,
            intensity_unit_id=iu.id,
            exercise_template_id=exercise_template.id,
        )
    )
    await db_session.commit()

    workout = await routine_service.create_workout_from_routine(
        db_session, viewer.id, public_routine.id
    )

    assert workout is not None

    res = await db_session.execute(
        select(func.count())
        .select_from(Exercise)
        .where(Exercise.workout_id == workout.id)
    )
    assert res.scalar() == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_workout_from_routine_increments_times_used(
    db_session: AsyncSession,
):
    """The routine.times_used should be incremented upon usage."""
    wt = WorkoutType(name="Incr Test", description="desc")
    db_session.add(wt)
    await db_session.flush()

    user = User(
        email="incr@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    routine = Routine(name="Incr Routine", workout_type_id=wt.id, creator_id=user.id)
    db_session.add(routine)
    await db_session.commit()

    assert routine.times_used == 0

    # Usage 1
    await routine_service.create_workout_from_routine(db_session, user.id, routine.id)
    await db_session.refresh(routine)
    assert routine.times_used == 1

    # Bypass the 10-second rate limit by deleting the recent workout
    from src.workouts.models import Workout
    from sqlalchemy import delete

    await db_session.execute(delete(Workout))
    await db_session.commit()

    # Usage 2
    await routine_service.create_workout_from_routine(db_session, user.id, routine.id)
    await db_session.refresh(routine)
    assert routine.times_used == 2
