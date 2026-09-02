from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import Response
from fastapi_users import FastAPIUsers

from src.users.models import User, OAuthAccount
from src.users.schemas import UserRead, UserCreate, UserUpdate
from src.core.config import settings
from src.core.security import auth_backend, get_user_manager, google_oauth_client
from src.core.dependencies import set_user_models
from src.core.database import get_async_session
from src.users.pat_schemas import (
    PersonalAccessTokenCreate,
    PersonalAccessTokenCreated,
    PersonalAccessTokenSummary,
)
from src.users.pat_service import (
    PATNotFoundError,
    create_personal_access_token,
    list_personal_access_tokens,
    revoke_personal_access_token,
)

# Set user models for dependencies
set_user_models(User, OAuthAccount)

# Initialize FastAPI Users
fastapi_users = FastAPIUsers[User, int](get_user_manager, [auth_backend])

# Create router
router = APIRouter()

# Include auth routes
router.include_router(
    fastapi_users.get_auth_router(auth_backend), prefix="/auth/jwt", tags=["auth"]
)

router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)

router.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)

router.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)

router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

router.include_router(
    fastapi_users.get_oauth_router(
        google_oauth_client,
        auth_backend,
        settings.SECRET_KEY,
        is_verified_by_default=True,
        redirect_url=settings.GOOGLE_REDIRECT_URI,
    ),
    prefix="/auth/google",
    tags=["auth"],
)

# Export current user dependency
current_active_user = fastapi_users.current_user(active=True)
current_optional_user = fastapi_users.current_user(optional=True, active=True)


# Session probe endpoint: return current user if authenticated; 401 otherwise
@router.get("/auth/session", response_model=UserRead, tags=["auth"])
async def get_auth_session(user: User = Depends(current_active_user)):
    return user


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT, tags=["auth"])
async def logout() -> Response:
    return await auth_backend.transport.get_logout_response()


@router.post(
    "/users/me/personal-access-tokens/",
    response_model=PersonalAccessTokenCreated,
    status_code=status.HTTP_201_CREATED,
    tags=["personal-access-tokens"],
)
async def create_pat(
    payload: PersonalAccessTokenCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await create_personal_access_token(session, user.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get(
    "/users/me/personal-access-tokens/",
    response_model=list[PersonalAccessTokenSummary],
    tags=["personal-access-tokens"],
)
async def list_pats(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    return await list_personal_access_tokens(session, user.id)


@router.delete(
    "/users/me/personal-access-tokens/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["personal-access-tokens"],
)
async def revoke_pat(
    token_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await revoke_personal_access_token(session, user.id, token_id)
    except PATNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Token not found") from exc
