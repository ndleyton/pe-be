import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from src.core.database import engine

logger = logging.getLogger(__name__)
router = APIRouter()
readiness_router = APIRouter()
READINESS_TIMEOUT_SECONDS = 5


@router.api_route("/health", methods=["GET", "HEAD"])
def read_root():
    return {"status": "ok"}


@readiness_router.api_route("/health/ready", methods=["GET", "HEAD"])
async def readiness():
    """Check the running application's database pool without exposing errors."""
    try:
        async with asyncio.timeout(READINESS_TIMEOUT_SECONDS):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
    except Exception:
        logger.warning("Database readiness check failed")
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable"},
            headers={"Cache-Control": "no-store"},
        )
    return JSONResponse(
        content={"status": "ok"}, headers={"Cache-Control": "no-store"}
    )
