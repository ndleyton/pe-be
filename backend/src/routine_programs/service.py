from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.routine_programs import crud
from src.routine_programs.schemas import (
    AdminRoutineProgramCreate,
    RoutineProgramCreate,
    RoutineProgramRead,
    RoutineProgramSummary,
    RoutineProgramUpdate,
)


class RoutineProgramService:
    async def get_visible_programs(
        self,
        session: AsyncSession,
        user_id: int | None,
        offset: int,
        limit: int,
    ) -> List[RoutineProgramRead]:
        programs = await crud.get_visible_programs(session, user_id, offset, limit)
        hydrated = [
            await crud.hydrate_program(program, session) for program in programs
        ]
        return [RoutineProgramRead.model_validate(program) for program in hydrated]

    async def get_visible_programs_summary(
        self,
        session: AsyncSession,
        user_id: int | None,
        offset: int,
        limit: int,
        order_by: str,
        category: str | None = None,
        author: str | None = None,
    ) -> List[RoutineProgramSummary]:
        summaries = await crud.get_visible_programs_summary(
            session, user_id, offset, limit, order_by, category, author
        )
        return [RoutineProgramSummary.model_validate(summary) for summary in summaries]

    async def get_program(
        self,
        session: AsyncSession,
        program_id: int,
        user_id: int | None,
    ) -> Optional[RoutineProgramRead]:
        program = await crud.get_program_by_id(session, program_id, user_id)
        if program is None:
            return None
        return RoutineProgramRead.model_validate(
            await crud.hydrate_program(program, session)
        )

    async def create_program(
        self,
        session: AsyncSession,
        program_data: RoutineProgramCreate,
        user_id: int,
    ) -> RoutineProgramRead:
        program = await crud.create_program(session, program_data, user_id)
        return RoutineProgramRead.model_validate(
            await crud.hydrate_program(program, session)
        )

    async def create_program_admin(
        self,
        session: AsyncSession,
        program_data: AdminRoutineProgramCreate,
        user_id: int,
    ) -> RoutineProgramRead:
        program = await crud.create_program(
            session, program_data, user_id, is_admin=True
        )
        return RoutineProgramRead.model_validate(
            await crud.hydrate_program(program, session)
        )

    async def update_program(
        self,
        session: AsyncSession,
        program_id: int,
        program_data: RoutineProgramUpdate,
        user_id: int,
        *,
        is_superuser: bool = False,
    ) -> Optional[RoutineProgramRead]:
        program = await crud.update_program(
            session,
            program_id,
            program_data,
            user_id,
            is_superuser=is_superuser,
        )
        if program is None:
            return None
        return RoutineProgramRead.model_validate(
            await crud.hydrate_program(program, session)
        )

    async def delete_program(
        self,
        session: AsyncSession,
        program_id: int,
        user_id: int,
        *,
        is_superuser: bool = False,
    ) -> bool:
        return await crud.delete_program(
            session, program_id, user_id, is_superuser=is_superuser
        )

    async def clone_program(
        self,
        session: AsyncSession,
        program_id: int,
        user_id: int,
    ) -> Optional[RoutineProgramRead]:
        program = await crud.clone_program(session, program_id, user_id)
        if program is None:
            return None
        return RoutineProgramRead.model_validate(
            await crud.hydrate_program(program, session)
        )


routine_program_service = RoutineProgramService()
