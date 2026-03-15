from __future__ import annotations

import asyncio

from src.chat.service import ChatService
from src.core.database import async_session_maker


async def _run_cleanup() -> int:
    async with async_session_maker() as session:
        return await ChatService.cleanup_orphaned_attachments(session)


def main() -> None:
    deleted = asyncio.run(_run_cleanup())
    print(f"Deleted {deleted} stale orphaned chat attachments.")


if __name__ == "__main__":
    main()
