import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from src.routines import crud
from src.routines.models import Routine
from src.routines.schemas import (
    AdminRoutineCreate,
    ExerciseTemplateCreate,
    RoutineCreate,
    SetTemplateCreate,
    RoutineUpdate,
)
from src.users.models import User
from src.exercises.models import ExerciseType, IntensityUnit
from src.workouts.models import WorkoutType


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_routine_admin_sets_visibility_and_readonly(
    db_session: AsyncSession,
):
    """create_routine_admin should honor visibility and is_readonly and create nested templates."""
    # Seed reference data
    wt = WorkoutType(name="Strength", description="desc")
    canonical_iu = IntensityUnit(name="Kilograms", abbreviation="kg")
    iu = IntensityUnit(name="Pounds", abbreviation="lb")
    db_session.add_all([wt, canonical_iu, iu])
    await db_session.flush()

    et = ExerciseType(
        name="CRUD Admin Exercise", description="x", default_intensity_unit=iu.id
    )
    db_session.add(et)
    await db_session.flush()

    user = User(
        email="admin-crud@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    payload = AdminRoutineCreate(
        name="Admin Routine",
        description="via admin",
        workout_type_id=wt.id,
        visibility=Routine.RoutineVisibility.public,
        is_readonly=True,
        exercise_templates=[
            ExerciseTemplateCreate(
                exercise_type_id=et.id,
                set_templates=[
                    SetTemplateCreate(
                        reps=5,
                        intensity=45.0,
                        intensity_unit_id=iu.id,
                        notes="Controlled eccentric",
                        type="reps",
                    )
                ],
            )
        ],
    )

    # Act
    created = await crud.create_routine_admin(db_session, payload, user.id)

    # Assert basic fields
    assert created.visibility == Routine.RoutineVisibility.public
    assert created.is_readonly is True
    assert created.creator_id == user.id

    # Assert nested content
    assert len(created.exercise_templates) == 1
    tmpl = created.exercise_templates[0]
    assert tmpl.exercise_type_id == et.id
    assert len(tmpl.set_templates) == 1
    st = tmpl.set_templates[0]
    assert st.reps == 5
    assert st.notes == "Controlled eccentric"
    assert st.type == "reps"
    assert st.intensity_unit_id == iu.id
    assert st.canonical_intensity == Decimal("20.41166")
    assert st.canonical_intensity_unit_id == canonical_iu.id


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_routine_persists_set_template_notes_and_type(
    db_session: AsyncSession,
):
    wt = WorkoutType(name="Strength Create", description="desc")
    iu = IntensityUnit(name="Seconds", abbreviation="sec")
    db_session.add_all([wt, iu])
    await db_session.flush()

    et = ExerciseType(
        name="CRUD Create Exercise", description="x", default_intensity_unit=iu.id
    )
    db_session.add(et)
    await db_session.flush()

    user = User(
        email="crud-create@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    payload = RoutineCreate(
        name="Routine With Set Metadata",
        description="desc",
        workout_type_id=wt.id,
        exercise_templates=[
            ExerciseTemplateCreate(
                exercise_type_id=et.id,
                set_templates=[
                    SetTemplateCreate(
                        duration_seconds=90,
                        intensity_unit_id=iu.id,
                        notes="Smooth tempo",
                        type="time",
                    )
                ],
            )
        ],
    )

    created = await crud.create_routine(db_session, payload, user.id)

    st = created.exercise_templates[0].set_templates[0]
    assert st.duration_seconds == 90
    assert st.notes == "Smooth tempo"
    assert st.type == "time"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_routine_persists_set_template_notes_and_type(
    db_session: AsyncSession,
):
    wt = WorkoutType(name="Strength Update", description="desc")
    iu = IntensityUnit(name="Pounds Update", abbreviation="lb")
    db_session.add_all([wt, iu])
    await db_session.flush()

    et = ExerciseType(
        name="CRUD Update Exercise", description="x", default_intensity_unit=iu.id
    )
    db_session.add(et)
    await db_session.flush()

    user = User(
        email="crud-update@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    created = await crud.create_routine(
        db_session,
        RoutineCreate(
            name="Routine To Update",
            description="desc",
            workout_type_id=wt.id,
            exercise_templates=[
                ExerciseTemplateCreate(
                    exercise_type_id=et.id,
                    set_templates=[
                        SetTemplateCreate(reps=5, intensity=45.0, intensity_unit_id=iu.id)
                    ],
                )
            ],
        ),
        user.id,
    )

    updated = await crud.update_routine(
        db_session,
        created.id,
        RoutineUpdate(
            exercise_templates=[
                ExerciseTemplateCreate(
                    exercise_type_id=et.id,
                    set_templates=[
                        SetTemplateCreate(
                            reps=8,
                            intensity=55.0,
                            intensity_unit_id=iu.id,
                            notes="Leave one rep in reserve",
                            type="reps",
                        )
                    ],
                )
            ]
        ),
        user.id,
    )

    assert updated is not None
    st = updated.exercise_templates[0].set_templates[0]
    assert st.reps == 8
    assert st.notes == "Leave one rep in reserve"
    assert st.type == "reps"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_and_delete_routine_paths(db_session: AsyncSession):
    """Cover update success/None branches and delete True/False paths."""
    wt = WorkoutType(name="Strength2", description="desc")
    db_session.add(wt)
    await db_session.flush()

    owner = User(
        email="owner@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    other = User(
        email="other@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    admin = User(
        email="admin@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db_session.add_all([owner, other, admin])
    await db_session.flush()

    # Create directly minimal routine
    r = Routine(name="To Update", workout_type_id=wt.id, creator_id=owner.id)
    db_session.add(r)
    await db_session.flush()

    # Update by non-owner -> None
    got_none = await crud.update_routine(
        db_session, r.id, RoutineUpdate(name="X"), other.id
    )
    assert got_none is None

    # Update by owner -> changed
    updated = await crud.update_routine(
        db_session,
        r.id,
        RoutineUpdate(
            name="Updated",
            description="d",
            workout_type_id=wt.id,
            visibility=Routine.RoutineVisibility.public,
        ),
        owner.id,
    )
    assert (
        updated is not None and updated.name == "Updated" and updated.description == "d"
    )
    assert (
        updated is not None and updated.visibility == Routine.RoutineVisibility.public
    )

    # Update by superuser -> changed
    updated_by_admin = await crud.update_routine(
        db_session,
        r.id,
        RoutineUpdate(name="Admin Updated"),
        admin.id,
        is_superuser=True,
    )
    assert updated_by_admin is not None and updated_by_admin.name == "Admin Updated"

    # Delete by non-owner -> False
    deleted = await crud.delete_routine(db_session, r.id, other.id)
    assert deleted is False

    # Delete by superuser -> True
    deleted_by_admin = await crud.delete_routine(
        db_session, r.id, admin.id, is_superuser=True
    )
    assert deleted_by_admin is True

    # Delete by owner after superuser delete -> False
    deleted2 = await crud.delete_routine(db_session, r.id, owner.id)
    assert deleted2 is False

    # Create a fresh routine to keep owner delete coverage
    r2 = Routine(name="Owner Delete", workout_type_id=wt.id, creator_id=owner.id)
    db_session.add(r2)
    await db_session.flush()

    deleted3 = await crud.delete_routine(db_session, r2.id, owner.id)
    assert deleted3 is True
