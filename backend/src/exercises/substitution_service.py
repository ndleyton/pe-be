from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from src.exercises.crud import (
    get_exercise_type_by_id,
    get_exercise_types,
    get_similar_exercise_types,
)
from src.exercises.models import ExerciseType


@dataclass(frozen=True)
class ExerciseSubstitution:
    exercise_type: ExerciseType
    match_reason: str


@dataclass(frozen=True)
class ExerciseSubstitutionResult:
    source_exercise: ExerciseType
    substitutions: list[ExerciseSubstitution]
    strategy: str


class ExerciseSubstitutionService:
    _EQUIPMENT_TERMS = (
        "barbell",
        "dumbbell",
        "cable",
        "machine",
        "kettlebell",
        "band",
        "bodyweight",
        "smith",
    )

    @classmethod
    def _equipment_preferences(cls, notes: str | None) -> set[str]:
        normalized = re.sub(r"[^a-z0-9]+", " ", (notes or "").lower())
        return {term for term in cls._EQUIPMENT_TERMS if term in normalized}

    @classmethod
    def _rerank(
        cls, matches: list[dict], context_notes: str | None
    ) -> list[dict]:
        preferred = cls._equipment_preferences(context_notes)
        if not preferred:
            return matches

        def score(item: dict) -> int:
            exercise_type = item["exercise_type"]
            haystack = " ".join(
                filter(None, [exercise_type.name, exercise_type.equipment])
            ).lower()
            return int(any(term in haystack for term in preferred))

        return sorted(matches, key=score, reverse=True)

    async def recommend_substitutions(
        self,
        session: AsyncSession,
        *,
        exercise_name: str | None = None,
        exercise_type_id: int | None = None,
        context_notes: str | None = None,
        limit: int = 3,
        user_id: int | None = None,
        released_only: bool = False,
    ) -> ExerciseSubstitutionResult:
        if (exercise_type_id is None) == (exercise_name is None):
            raise ValueError(
                "Provide exactly one of exercise_type_id or exercise_name"
            )

        source = None
        if exercise_type_id is not None:
            source = await get_exercise_type_by_id(
                session,
                exercise_type_id,
                user_id=user_id,
                released_only=released_only,
            )
        else:
            matches = await get_exercise_types(
                session,
                name=exercise_name,
                limit=1,
                user_id=user_id,
                released_only=released_only,
            )
            source = (
                await get_exercise_type_by_id(
                    session,
                    matches.data[0].id,
                    user_id=user_id,
                    released_only=released_only,
                )
                if matches.data
                else None
            )

        if source is None:
            raise LookupError("Exercise not found")

        raw_matches, strategy = await get_similar_exercise_types(
            session, source, limit=min(max(limit * 3, limit), 20)
        )
        reranked = self._rerank(raw_matches, context_notes)[:limit]
        return ExerciseSubstitutionResult(
            source_exercise=source,
            substitutions=[
                ExerciseSubstitution(
                    exercise_type=item["exercise_type"],
                    match_reason=item["match_reason"],
                )
                for item in reranked
            ],
            strategy=strategy,
        )
