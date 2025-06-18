from typing import List
from app.models import IntensityUnit
from app.schemas import IntensityUnitRead
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends, APIRouter
from app.db import get_async_session

intensity_units_router = APIRouter(tags=["intensity_units"])

@intensity_units_router.get("/", response_model=List[IntensityUnitRead])
async def get_intensity_units(
    session: AsyncSession = Depends(get_async_session)
):
    """Get all intensity units."""
    result = await session.execute(select(IntensityUnit).order_by(IntensityUnit.name))
    intensity_units = result.scalars().all()
    return intensity_units