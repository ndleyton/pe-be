import asyncio
from typing import Dict, List, Optional, Any, TYPE_CHECKING
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

if TYPE_CHECKING:
    from src.exercises.models import Muscle, MuscleGroup


class TaxonomyCache:
    """Global in-memory cache for static exercise taxonomy (Muscles and Muscle Groups)."""

    _muscles: Dict[int, Any] = {}
    _muscle_groups: Dict[int, Any] = {}
    _loaded = False
    _load_lock = asyncio.Lock()

    @classmethod
    async def ensure_loaded(cls, session: AsyncSession):
        """Warm the cache if it hasn't been loaded yet (thread-safe)."""
        if cls._loaded:
            return

        async with cls._load_lock:
            # Double-check inside the lock to handle concurrent entries
            if cls._loaded:
                return

            from src.exercises.models import Muscle, MuscleGroup

            # Fetch everything in two simple queries
            groups_result = await session.execute(select(MuscleGroup))
            groups = groups_result.scalars().all()

            muscles_result = await session.execute(select(Muscle))
            muscles = muscles_result.scalars().all()

            cls._muscle_groups = {g.id: g for g in groups}
            cls._muscles = {m.id: m for m in muscles}
            cls._loaded = True

    @classmethod
    def get_muscle(cls, muscle_id: int) -> Optional["Muscle"]:
        return cls._muscles.get(muscle_id)

    @classmethod
    def get_muscle_group(cls, group_id: int) -> Optional["MuscleGroup"]:
        return cls._muscle_groups.get(group_id)

    @classmethod
    def get_all_muscle_groups(cls) -> List["MuscleGroup"]:
        return sorted(cls._muscle_groups.values(), key=lambda x: x.name)

    @classmethod
    def get_all_muscles(cls) -> List["Muscle"]:
        return sorted(
            cls._muscles.values(),
            key=lambda x: (
                cls.get_muscle_group(x.muscle_group_id).name
                if cls.get_muscle_group(x.muscle_group_id)
                else "",
                x.name,
            ),
        )

    @classmethod
    def invalidate(cls):
        cls._loaded = False
        cls._muscles.clear()
        cls._muscle_groups.clear()
