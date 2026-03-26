from __future__ import annotations

import asyncio

from src.jobs.chat_attachment_cleanup import run


async def _run_cleanup() -> int:
    result = await run()
    return int(result.metrics.get("deleted_count", 0))


def main() -> None:
    deleted = asyncio.run(_run_cleanup())
    print(f"Deleted {deleted} stale orphaned chat attachments.")


if __name__ == "__main__":
    main()
