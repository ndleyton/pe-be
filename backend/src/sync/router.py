from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_async_session
from src.sync.schemas import GuestSyncPayload, SyncResult
from src.sync.service import SyncService
from src.users.router import current_active_user
from src.users.models import User

router = APIRouter(prefix="/sync", tags=["sync"])

@router.post("/", response_model=SyncResult, status_code=status.HTTP_200_OK)
async def sync_guest_data(
    payload: GuestSyncPayload,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """
    Synchronize guest data (workouts, exercises, sets) to the server in a single bulk request.
    """
    return await SyncService.sync_guest_data(session, payload, user.id)
