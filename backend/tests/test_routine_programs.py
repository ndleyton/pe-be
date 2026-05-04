from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.errors import DomainValidationError
from src.exercises.models import ExerciseType, IntensityUnit
from src.main import app
from src.routine_programs import crud as program_crud
from src.routine_programs.models import RoutineProgram, RoutineProgramDay
from src.routine_programs.schemas import (
    AdminRoutineProgramCreate,
    RoutineProgramCreate,
    RoutineProgramDayCreate,
    RoutineProgramUpdate,
)
from src.routines.models import ExerciseTemplate, Routine, SetTemplate
from src.users.models import User
from src.users.router import current_active_user
from src.workouts.models import WorkoutType


async def _seed_user(
    db_session: AsyncSession, email: str, *, admin: bool = False
) -> User:
    user = User(
        email=email,
        hashed_password="not-used",
        is_active=True,
        is_superuser=admin,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _seed_reference_data(db_session: AsyncSession):
    intensity_unit = IntensityUnit(name="Pounds", abbreviation="lb")
    workout_type = WorkoutType(name="Strength", description="Strength training")
    db_session.add_all([intensity_unit, workout_type])
    await db_session.flush()

    exercise_type = ExerciseType(
        name="Routine Program Exercise",
        description="Used by routine program tests",
        default_intensity_unit=intensity_unit.id,
    )
    db_session.add(exercise_type)
    await db_session.flush()

    return workout_type, intensity_unit, exercise_type


async def _seed_routine(
    db_session: AsyncSession,
    *,
    owner: User,
    workout_type: WorkoutType,
    intensity_unit: IntensityUnit,
    exercise_type: ExerciseType,
    name: str,
    visibility: Routine.RoutineVisibility,
) -> Routine:
    routine = Routine(
        name=name,
        description=f"{name} description",
        workout_type_id=workout_type.id,
        creator_id=owner.id,
        visibility=visibility,
        is_readonly=visibility != Routine.RoutineVisibility.private,
    )
    db_session.add(routine)
    await db_session.flush()

    exercise_template = ExerciseTemplate(
        routine_id=routine.id,
        exercise_type_id=exercise_type.id,
        notes=f"{name} exercise notes",
    )
    db_session.add(exercise_template)
    await db_session.flush()

    db_session.add(
        SetTemplate(
            reps=10,
            intensity=Decimal("50.0"),
            intensity_unit_id=intensity_unit.id,
            exercise_template_id=exercise_template.id,
            notes=f"{name} set notes",
        )
    )
    await db_session.flush()
    return routine


@pytest.mark.integration
@pytest.mark.asyncio
async def test_program_summary_lists_public_only_and_counts_ordered_days(
    db_session: AsyncSession, async_client: AsyncClient
):
    workout_type, intensity_unit, exercise_type = await _seed_reference_data(db_session)
    owner = await _seed_user(db_session, "program-summary-owner@example.com")

    pull = await _seed_routine(
        db_session,
        owner=owner,
        workout_type=workout_type,
        intensity_unit=intensity_unit,
        exercise_type=exercise_type,
        name="Pull A",
        visibility=Routine.RoutineVisibility.public,
    )
    push = await _seed_routine(
        db_session,
        owner=owner,
        workout_type=workout_type,
        intensity_unit=intensity_unit,
        exercise_type=exercise_type,
        name="Push A",
        visibility=Routine.RoutineVisibility.public,
    )

    public_program = RoutineProgram(
        name="Public PPL",
        creator_id=owner.id,
        visibility=RoutineProgram.ProgramVisibility.public,
        author="Coach",
        category="Hypertrophy",
    )
    private_program = RoutineProgram(
        name="Private PPL",
        creator_id=owner.id,
        visibility=RoutineProgram.ProgramVisibility.private,
    )
    link_only_program = RoutineProgram(
        name="Link Only PPL",
        creator_id=owner.id,
        visibility=RoutineProgram.ProgramVisibility.link_only,
    )
    db_session.add_all([public_program, private_program, link_only_program])
    await db_session.flush()

    db_session.add_all(
        [
            RoutineProgramDay(
                program_id=public_program.id,
                routine_id=pull.id,
                day_label="Pull A",
                sort_order=1,
            ),
            RoutineProgramDay(
                program_id=public_program.id,
                routine_id=push.id,
                day_label="Push A",
                sort_order=2,
            ),
            RoutineProgramDay(
                program_id=private_program.id,
                routine_id=pull.id,
                day_label="Private Pull",
                sort_order=1,
            ),
            RoutineProgramDay(
                program_id=link_only_program.id,
                routine_id=pull.id,
                day_label="Link Pull",
                sort_order=1,
            ),
        ]
    )
    await db_session.commit()

    response = await async_client.get("/api/v1/routine-programs/summary")
    assert response.status_code == 200, response.text

    body = response.json()
    assert [program["name"] for program in body] == ["Public PPL"]
    assert body[0]["day_count"] == 2
    assert body[0]["routine_count"] == 2
    assert body[0]["exercise_count"] == 2
    assert body[0]["set_count"] == 2
    assert body[0]["day_labels_preview"] == ["Pull A", "Push A"]

    direct_link_response = await async_client.get(
        f"/api/v1/routine-programs/{link_only_program.id}"
    )
    assert direct_link_response.status_code == 200, direct_link_response.text
    assert direct_link_response.json()["name"] == "Link Only PPL"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_public_program_rejects_link_only_child_routine(
    db_session: AsyncSession, async_client: AsyncClient
):
    workout_type, intensity_unit, exercise_type = await _seed_reference_data(db_session)
    owner = await _seed_user(db_session, "program-create-owner@example.com")
    routine = await _seed_routine(
        db_session,
        owner=owner,
        workout_type=workout_type,
        intensity_unit=intensity_unit,
        exercise_type=exercise_type,
        name="Link Child",
        visibility=Routine.RoutineVisibility.link_only,
    )
    await db_session.commit()

    async def override_user():
        return owner

    app.dependency_overrides[current_active_user] = override_user
    try:
        response = await async_client.post(
            "/api/v1/routine-programs/",
            json={
                "name": "Invalid Public Program",
                "visibility": "public",
                "days": [
                    {
                        "routine_id": routine.id,
                        "day_label": "Day 1",
                        "sort_order": 1,
                    }
                ],
            },
        )
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    assert response.status_code == 422, response.text
    assert response.json()["field"] == "days.routine_id"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clone_program_deep_clones_routines_and_increments_times_used(
    db_session: AsyncSession, async_client: AsyncClient
):
    workout_type, intensity_unit, exercise_type = await _seed_reference_data(db_session)
    admin = await _seed_user(db_session, "program-clone-admin@example.com", admin=True)
    viewer = await _seed_user(db_session, "program-clone-viewer@example.com")
    routine = await _seed_routine(
        db_session,
        owner=admin,
        workout_type=workout_type,
        intensity_unit=intensity_unit,
        exercise_type=exercise_type,
        name="Canonical Pull",
        visibility=Routine.RoutineVisibility.public,
    )

    source_program = RoutineProgram(
        name="Canonical Program",
        description="Read-only source",
        creator_id=admin.id,
        visibility=RoutineProgram.ProgramVisibility.public,
        author="Admin Coach",
        category="Strength",
        source_label="Canonical seed",
        is_readonly=True,
    )
    db_session.add(source_program)
    await db_session.flush()
    db_session.add(
        RoutineProgramDay(
            program_id=source_program.id,
            routine_id=routine.id,
            day_label="Pull",
            sort_order=1,
        )
    )
    await db_session.commit()

    async def override_user():
        return viewer

    app.dependency_overrides[current_active_user] = override_user
    try:
        response = await async_client.post(
            f"/api/v1/routine-programs/{source_program.id}/clone"
        )
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Canonical Program"
    assert body["visibility"] == "private"
    assert body["is_readonly"] is False
    assert body["creator_id"] == viewer.id
    assert body["days"][0]["routine"]["id"] != routine.id
    assert body["days"][0]["day_label"] == "Pull"

    await db_session.refresh(source_program)
    assert source_program.times_used == 1

    cloned_routine = await db_session.get(Routine, body["days"][0]["routine"]["id"])
    assert cloned_routine is not None
    assert cloned_routine.creator_id == viewer.id
    assert cloned_routine.visibility == Routine.RoutineVisibility.private

    result = await db_session.execute(
        select(ExerciseTemplate).where(ExerciseTemplate.routine_id == cloned_routine.id)
    )
    cloned_template = result.scalar_one()
    result = await db_session.execute(
        select(SetTemplate).where(
            SetTemplate.exercise_template_id == cloned_template.id
        )
    )
    cloned_set = result.scalar_one()
    assert cloned_template.exercise_type_id == exercise_type.id
    assert cloned_set.reps == 10
    assert cloned_set.intensity_unit_id == intensity_unit.id


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_routine_referenced_by_program_returns_conflict(
    db_session: AsyncSession, async_client: AsyncClient
):
    workout_type, intensity_unit, exercise_type = await _seed_reference_data(db_session)
    owner = await _seed_user(db_session, "program-delete-owner@example.com")
    routine = await _seed_routine(
        db_session,
        owner=owner,
        workout_type=workout_type,
        intensity_unit=intensity_unit,
        exercise_type=exercise_type,
        name="Referenced Routine",
        visibility=Routine.RoutineVisibility.private,
    )
    program = RoutineProgram(
        name="Owner Program",
        creator_id=owner.id,
        visibility=RoutineProgram.ProgramVisibility.private,
    )
    db_session.add(program)
    await db_session.flush()
    db_session.add(
        RoutineProgramDay(
            program_id=program.id,
            routine_id=routine.id,
            day_label="Day 1",
            sort_order=1,
        )
    )
    await db_session.commit()

    async def override_user():
        return owner

    app.dependency_overrides[current_active_user] = override_user
    try:
        response = await async_client.delete(f"/api/v1/routines/{routine.id}")
    finally:
        app.dependency_overrides.pop(current_active_user, None)

    assert response.status_code == 409, response.text
    assert response.json()["detail"] == "Routine is used by a routine program"
    assert await db_session.get(Routine, routine.id) is not None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_program_validation_rejects_duplicate_missing_and_inaccessible_days(
    db_session: AsyncSession,
):
    workout_type, intensity_unit, exercise_type = await _seed_reference_data(db_session)
    owner = await _seed_user(db_session, "program-validation-owner@example.com")
    other = await _seed_user(db_session, "program-validation-other@example.com")
    owned_public = await _seed_routine(
        db_session,
        owner=owner,
        workout_type=workout_type,
        intensity_unit=intensity_unit,
        exercise_type=exercise_type,
        name="Owned Public",
        visibility=Routine.RoutineVisibility.public,
    )
    other_private = await _seed_routine(
        db_session,
        owner=other,
        workout_type=workout_type,
        intensity_unit=intensity_unit,
        exercise_type=exercise_type,
        name="Other Private",
        visibility=Routine.RoutineVisibility.private,
    )
    await db_session.commit()

    with pytest.raises(DomainValidationError) as duplicate_error:
        await program_crud.create_program(
            db_session,
            RoutineProgramCreate(
                name="Duplicate Sort",
                days=[
                    RoutineProgramDayCreate(
                        routine_id=owned_public.id, day_label="A", sort_order=1
                    ),
                    RoutineProgramDayCreate(
                        routine_id=owned_public.id, day_label="B", sort_order=1
                    ),
                ],
            ),
            owner.id,
        )
    assert duplicate_error.value.field == "days.sort_order"

    with pytest.raises(DomainValidationError) as missing_error:
        await program_crud.create_program(
            db_session,
            RoutineProgramCreate(
                name="Missing Routine",
                days=[
                    RoutineProgramDayCreate(
                        routine_id=999_999, day_label="Missing", sort_order=1
                    )
                ],
            ),
            owner.id,
        )
    assert missing_error.value.field == "days.routine_id"

    with pytest.raises(DomainValidationError) as inaccessible_error:
        await program_crud.create_program(
            db_session,
            RoutineProgramCreate(
                name="Inaccessible Routine",
                days=[
                    RoutineProgramDayCreate(
                        routine_id=other_private.id,
                        day_label="Private",
                        sort_order=1,
                    )
                ],
            ),
            owner.id,
        )
    assert inaccessible_error.value.field == "days.routine_id"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_program_crud_summary_sorting_filtering_and_empty_paths(
    db_session: AsyncSession,
):
    workout_type, intensity_unit, exercise_type = await _seed_reference_data(db_session)
    owner = await _seed_user(db_session, "program-summary-crud-owner@example.com")
    routine = await _seed_routine(
        db_session,
        owner=owner,
        workout_type=workout_type,
        intensity_unit=intensity_unit,
        exercise_type=exercise_type,
        name="Summary Routine",
        visibility=Routine.RoutineVisibility.public,
    )

    alpha = RoutineProgram(
        name="Alpha",
        creator_id=owner.id,
        visibility=RoutineProgram.ProgramVisibility.public,
        author="B Coach",
        category="Hypertrophy",
        times_used=3,
    )
    beta = RoutineProgram(
        name="Beta",
        creator_id=owner.id,
        visibility=RoutineProgram.ProgramVisibility.public,
        author="A Coach",
        category="Strength",
        times_used=9,
    )
    db_session.add_all([alpha, beta])
    await db_session.flush()
    db_session.add_all(
        [
            RoutineProgramDay(
                program_id=alpha.id,
                routine_id=routine.id,
                day_label="Alpha Day",
                sort_order=1,
            ),
            RoutineProgramDay(
                program_id=beta.id,
                routine_id=routine.id,
                day_label="Beta Day",
                sort_order=1,
            ),
        ]
    )
    await db_session.commit()

    assert (
        await program_crud.get_visible_programs_summary(
            db_session, user_id=None, category="Missing"
        )
        == []
    )

    by_name = await program_crud.get_visible_programs_summary(
        db_session, user_id=None, order_by="name"
    )
    assert [program["name"] for program in by_name] == ["Alpha", "Beta"]

    by_author = await program_crud.get_visible_programs_summary(
        db_session, user_id=None, order_by="author"
    )
    assert [program["author"] for program in by_author] == ["A Coach", "B Coach"]

    by_category = await program_crud.get_visible_programs_summary(
        db_session, user_id=None, order_by="category"
    )
    assert [program["category"] for program in by_category] == [
        "Hypertrophy",
        "Strength",
    ]

    by_times_used = await program_crud.get_visible_programs_summary(
        db_session, user_id=None, order_by="timesUsed"
    )
    assert [program["times_used"] for program in by_times_used] == [9, 3]

    by_updated = await program_crud.get_visible_programs_summary(
        db_session, user_id=None, order_by="updatedAt", author="A Coach"
    )
    assert [program["name"] for program in by_updated] == ["Beta"]

    visible_for_owner = await program_crud.get_visible_programs(
        db_session, user_id=owner.id
    )
    assert {program.name for program in visible_for_owner} == {"Alpha", "Beta"}


@pytest.mark.integration
@pytest.mark.asyncio
async def test_program_update_and_delete_cover_permission_and_superuser_paths(
    db_session: AsyncSession,
):
    workout_type, intensity_unit, exercise_type = await _seed_reference_data(db_session)
    owner = await _seed_user(db_session, "program-update-owner@example.com")
    admin = await _seed_user(db_session, "program-update-admin@example.com", admin=True)
    first = await _seed_routine(
        db_session,
        owner=owner,
        workout_type=workout_type,
        intensity_unit=intensity_unit,
        exercise_type=exercise_type,
        name="First Routine",
        visibility=Routine.RoutineVisibility.public,
    )
    second = await _seed_routine(
        db_session,
        owner=owner,
        workout_type=workout_type,
        intensity_unit=intensity_unit,
        exercise_type=exercise_type,
        name="Second Routine",
        visibility=Routine.RoutineVisibility.private,
    )

    created = await program_crud.create_program(
        db_session,
        AdminRoutineProgramCreate(
            name="Readonly Program",
            visibility=RoutineProgram.ProgramVisibility.public,
            is_readonly=True,
            days=[
                RoutineProgramDayCreate(
                    routine_id=first.id, day_label="First", sort_order=1
                )
            ],
        ),
        owner.id,
        is_admin=True,
    )

    assert created is not None
    assert created.is_readonly is True
    assert (
        await program_crud.update_program(
            db_session,
            999_999,
            RoutineProgramUpdate(name="Missing"),
            owner.id,
        )
        is None
    )

    with pytest.raises(PermissionError):
        await program_crud.update_program(
            db_session,
            created.id,
            RoutineProgramUpdate(name="Blocked"),
            owner.id,
        )

    updated = await program_crud.update_program(
        db_session,
        created.id,
        RoutineProgramUpdate(
            name="Admin Updated",
            description="Updated description",
            visibility=RoutineProgram.ProgramVisibility.link_only,
            author="Updated Author",
            category="Updated Category",
            source_label="Updated Source",
            days=[
                RoutineProgramDayCreate(
                    routine_id=second.id,
                    day_label="Second",
                    sort_order=1,
                    week_number=2,
                    phase_label="Phase A",
                    notes="Day notes",
                )
            ],
        ),
        admin.id,
        is_superuser=True,
    )

    assert updated is not None
    assert updated.name == "Admin Updated"
    assert updated.visibility == RoutineProgram.ProgramVisibility.link_only
    assert updated.days[0].routine_id == second.id
    assert updated.days[0].week_number == 2

    with pytest.raises(PermissionError):
        await program_crud.delete_program(db_session, created.id, owner.id)

    assert await program_crud.delete_program(db_session, 999_999, owner.id) is False
    assert (
        await program_crud.delete_program(
            db_session, created.id, admin.id, is_superuser=True
        )
        is True
    )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clone_program_reuses_single_cloned_routine_and_canonical_set_values(
    db_session: AsyncSession,
):
    workout_type, intensity_unit, exercise_type = await _seed_reference_data(db_session)
    owner = await _seed_user(db_session, "program-clone-reuse-owner@example.com")
    viewer = await _seed_user(db_session, "program-clone-reuse-viewer@example.com")
    routine = await _seed_routine(
        db_session,
        owner=owner,
        workout_type=workout_type,
        intensity_unit=intensity_unit,
        exercise_type=exercise_type,
        name="Repeated Routine",
        visibility=Routine.RoutineVisibility.public,
    )
    result = await db_session.execute(
        select(SetTemplate)
        .join(ExerciseTemplate)
        .where(ExerciseTemplate.routine_id == routine.id)
    )
    source_set = result.scalar_one()
    source_set.canonical_intensity = Decimal("22.50000")
    source_set.canonical_intensity_unit_id = intensity_unit.id

    program = RoutineProgram(
        name="Repeated Program",
        creator_id=owner.id,
        visibility=RoutineProgram.ProgramVisibility.public,
    )
    db_session.add(program)
    await db_session.flush()
    db_session.add_all(
        [
            RoutineProgramDay(
                program_id=program.id,
                routine_id=routine.id,
                day_label="Day A",
                sort_order=1,
            ),
            RoutineProgramDay(
                program_id=program.id,
                routine_id=routine.id,
                day_label="Day B",
                sort_order=2,
            ),
        ]
    )
    await db_session.commit()

    assert await program_crud.clone_program(db_session, 999_999, viewer.id) is None
    cloned = await program_crud.clone_program(db_session, program.id, viewer.id)

    assert cloned is not None
    assert cloned.source_label == "Repeated Program"
    assert len(cloned.days) == 2
    cloned_routine_ids = {day.routine_id for day in cloned.days}
    assert len(cloned_routine_ids) == 1

    cloned_routine_id = cloned_routine_ids.pop()
    result = await db_session.execute(
        select(SetTemplate)
        .join(ExerciseTemplate)
        .where(ExerciseTemplate.routine_id == cloned_routine_id)
    )
    cloned_set = result.scalar_one()
    assert cloned_set.canonical_intensity == Decimal("22.50000")
    assert cloned_set.canonical_intensity_unit_id == intensity_unit.id


def test_program_integrity_error_mapping_branches():
    class OrigWithDiag:
        def __init__(self, constraint_name: str):
            self.diag = type("Diag", (), {"constraint_name": constraint_name})()

        def __str__(self) -> str:
            return self.diag.constraint_name

    class OrigWithConstraint:
        constraint_name = "fallback_constraint"

        def __str__(self) -> str:
            return "fallback"

    fk_error = program_crud._map_program_integrity_error(
        IntegrityError(
            "statement",
            {},
            OrigWithDiag("routine_program_days_routine_id_fkey"),
        )
    )
    assert fk_error is not None
    assert fk_error.field == "days.routine_id"

    unique_error = program_crud._map_program_integrity_error(
        IntegrityError(
            "statement",
            {},
            OrigWithDiag("uq_routine_program_days_program_sort"),
        )
    )
    assert unique_error is not None
    assert unique_error.field == "days.sort_order"

    unknown_error = program_crud._map_program_integrity_error(
        IntegrityError("statement", {}, OrigWithConstraint())
    )
    assert unknown_error is None
