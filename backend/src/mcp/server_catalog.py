from __future__ import annotations

import json
from typing import Annotated

from mcp.server import MCPServer
from mcp.types import ToolAnnotations
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.core.database import async_session_maker
from src.exercises.crud import get_exercise_types, get_muscle_groups
from src.exercises.models import ExerciseMuscle, ExerciseType, Muscle
from src.exercises.substitution_service import ExerciseSubstitutionService
from src.mcp.catalog_schemas import (
    MuscleDTO,
    MuscleGroupDTO,
    PublicExerciseTypeDTO,
    PublicMuscleDTO,
    PublicSubstitutionItemDTO,
)

catalog_server = MCPServer(
    "pe-be-catalog",
    description="Public, read-only PE-BE exercise catalog and muscle taxonomy.",
)


def _public_dto(exercise_type: ExerciseType) -> PublicExerciseTypeDTO:
    muscles = sorted(
        exercise_type.exercise_muscles,
        key=lambda association: (not association.is_primary, association.muscle.name),
    )
    return PublicExerciseTypeDTO(
        id=exercise_type.id,
        name=exercise_type.name,
        description=exercise_type.description,
        equipment=exercise_type.equipment,
        category=exercise_type.category,
        instructions=exercise_type.instructions,
        images_url=exercise_type.images_url,
        muscles=[
            PublicMuscleDTO(
                id=association.muscle.id,
                name=association.muscle.name,
                group_id=association.muscle.muscle_group.id,
                group=association.muscle.muscle_group.name,
                is_primary=association.is_primary,
            )
            for association in muscles
        ],
    )


async def _released_by_ids(session, ids: list[int]) -> list[ExerciseType]:
    if not ids:
        return []
    result = await session.execute(
        select(ExerciseType)
        .options(
            selectinload(ExerciseType.exercise_muscles)
            .selectinload(ExerciseMuscle.muscle)
            .selectinload(Muscle.muscle_group)
        )
        .where(
            ExerciseType.id.in_(ids),
            ExerciseType.status == ExerciseType.ExerciseTypeStatus.released,
        )
    )
    by_id = {item.id: item for item in result.unique().scalars().all()}
    return [by_id[item_id] for item_id in ids if item_id in by_id]


async def _released_one(
    session, *, exercise_id: int | None, exercise_name: str | None
) -> ExerciseType | None:
    if (exercise_id is None) == (exercise_name is None):
        raise ValueError("Provide exactly one of exercise_id or exercise_name")
    if exercise_id is not None:
        items = await _released_by_ids(session, [exercise_id])
        return items[0] if items else None
    matches = await get_exercise_types(
        session, name=exercise_name, limit=1, released_only=True
    )
    if not matches.data:
        return None
    items = await _released_by_ids(session, [matches.data[0].id])
    return items[0] if items else None


@catalog_server.tool(
    annotations=ToolAnnotations(
        title="Search exercises", readOnlyHint=True, openWorldHint=False
    )
)
async def search_exercises(
    query: Annotated[str, Field(min_length=1, max_length=150)],
    muscle_group_id: int | None = None,
    limit: Annotated[int, Field(ge=1, le=50)] = 20,
) -> list[PublicExerciseTypeDTO]:
    """Fuzzy-search released exercises in the public PE-BE catalog."""
    async with async_session_maker() as session:
        page = await get_exercise_types(
            session,
            name=query,
            muscle_group_id=muscle_group_id,
            limit=limit,
            released_only=True,
        )
        items = await _released_by_ids(session, [item.id for item in page.data])
        return [_public_dto(item) for item in items]


@catalog_server.tool(
    annotations=ToolAnnotations(
        title="Get exercise details", readOnlyHint=True, openWorldHint=False
    )
)
async def get_exercise_details(
    exercise_id: int | None = None, exercise_name: str | None = None
) -> PublicExerciseTypeDTO:
    """Get one released exercise by ID or name."""
    async with async_session_maker() as session:
        item = await _released_one(
            session, exercise_id=exercise_id, exercise_name=exercise_name
        )
        if item is None:
            raise ValueError("Exercise not found")
        return _public_dto(item)


@catalog_server.tool(
    annotations=ToolAnnotations(
        title="Recommend exercise substitutions",
        readOnlyHint=True,
        openWorldHint=False,
    )
)
async def recommend_exercise_substitutions(
    exercise_name: str | None = None,
    exercise_type_id: int | None = None,
    context_notes: Annotated[str | None, Field(max_length=500)] = None,
    limit: Annotated[int, Field(ge=1, le=10)] = 3,
) -> list[PublicSubstitutionItemDTO]:
    """Suggest released alternatives grounded in shared muscle taxonomy."""
    async with async_session_maker() as session:
        result = await ExerciseSubstitutionService().recommend_substitutions(
            session,
            exercise_name=exercise_name,
            exercise_type_id=exercise_type_id,
            context_notes=context_notes,
            limit=limit,
            released_only=True,
        )
        hydrated = await _released_by_ids(
            session, [item.exercise_type.id for item in result.substitutions]
        )
        reasons = {
            item.exercise_type.id: item.match_reason for item in result.substitutions
        }
        return [
            PublicSubstitutionItemDTO(
                exercise=_public_dto(item), match_reason=reasons[item.id]
            )
            for item in hydrated
        ]


async def _taxonomy() -> list[MuscleGroupDTO]:
    async with async_session_maker() as session:
        groups = await get_muscle_groups(session)
        result = await session.execute(
            select(Muscle).order_by(Muscle.muscle_group_id, Muscle.name)
        )
        muscles_by_group: dict[int, list[MuscleDTO]] = {}
        for muscle in result.scalars().all():
            muscles_by_group.setdefault(muscle.muscle_group_id, []).append(
                MuscleDTO(id=muscle.id, name=muscle.name)
            )
        return [
            MuscleGroupDTO(
                id=group.id,
                name=group.name,
                muscles=muscles_by_group.get(group.id, []),
            )
            for group in groups
        ]


@catalog_server.tool(
    annotations=ToolAnnotations(
        title="List muscle groups", readOnlyHint=True, openWorldHint=False
    )
)
async def list_muscle_groups() -> list[MuscleGroupDTO]:
    """List PE-BE muscle groups and their muscles."""
    return await _taxonomy()


@catalog_server.resource(
    "exercises://{exercise_id}",
    name="exercise",
    description="A released PE-BE exercise catalog record.",
    mime_type="application/json",
)
async def exercise_resource(exercise_id: int) -> str:
    item = await get_exercise_details(exercise_id=exercise_id)
    return item.model_dump_json()


@catalog_server.resource(
    "taxonomy://muscle-groups",
    name="muscle-groups",
    description="The PE-BE muscle group taxonomy.",
    mime_type="application/json",
)
async def muscle_group_resource() -> str:
    return json.dumps([item.model_dump(mode="json") for item in await _taxonomy()])
