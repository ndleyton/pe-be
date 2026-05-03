from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercises.models import ExerciseType, IntensityUnit
from src.main import app
from src.routine_programs.models import RoutineProgram, RoutineProgramDay
from src.routines.models import ExerciseTemplate, Routine, SetTemplate
from src.users.models import User
from src.users.router import current_active_user
from src.workouts.models import WorkoutType


async def _seed_user(db_session: AsyncSession, email: str, *, admin: bool = False) -> User:
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
        select(SetTemplate).where(SetTemplate.exercise_template_id == cloned_template.id)
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
