from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercises.models import IntensityUnit


async def resolve_intensity_unit(
    session: AsyncSession,
    *,
    requested: str | None,
    default_id: int | None,
) -> IntensityUnit:
    query = select(IntensityUnit)
    if requested:
        normalized = requested.strip().lower()
        query = query.where(
            or_(
                func.lower(IntensityUnit.abbreviation) == normalized,
                func.lower(IntensityUnit.name) == normalized,
            )
        )
    elif default_id is not None:
        query = query.where(IntensityUnit.id == default_id)
    else:
        raise ValueError("Intensity unit is required")
    query = query.order_by(IntensityUnit.id).limit(1)
    unit = (await session.execute(query)).scalar_one_or_none()
    if unit is None:
        raise ValueError(f"Intensity unit not found: {requested or default_id}")
    return unit
