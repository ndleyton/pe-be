from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.exercises.crud import (
    _exercise_type_visibility_clause,
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
    KNOWN_EQUIPMENT_KEYWORDS: dict[str, set[str]] = {
        "machine": {"machine", "machines"},
        "cable": {"cable", "cables"},
        "barbell": {"barbell", "barbells", "olympic bar"},
        "dumbbell": {"dumbbell", "dumbbells", "db"},
        "kettlebell": {"kettlebell", "kettlebells", "kb"},
        "bodyweight": {"bodyweight", "body weight", "bw"},
        "band": {"band", "bands", "resistance band", "resistance bands"},
        "smith machine": {"smith machine", "smith"},
        "bench": {"bench", "benches"},
        "pull-up bar": {"pull-up bar", "pull up bar", "pullup bar"},
    }

    @staticmethod
    def normalize_lookup_value(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", value.strip().casefold()).strip()

    @classmethod
    def extract_equipment_preferences(
        cls, context_notes: str | None
    ) -> tuple[set[str], set[str], bool]:
        if not context_notes:
            return set(), set(), False
        normalized = f" {cls.normalize_lookup_value(context_notes)} "
        preferred: set[str] = set()
        avoided: set[str] = set()
        same_equipment_requested = any(
            phrase in normalized
            for phrase in (
                " same equipment ",
                " similar equipment ",
                " same setup ",
                " same machine ",
            )
        )
        if same_equipment_requested and re.search(
            r"\b(?:not|no|without|avoid|never|cannot|can\s*t|cant|don\s*t|dont|do\s+not|doesn\s*t|doesnt|does\s+not)\s+(?:(?:use|using|have|having|want|need)(?:\s+to\s+be)?\s+)?(?:the\s+)?(?:same|similar)\s+(?:equipment|setup|machine)\b",
            normalized,
        ):
            same_equipment_requested = False
        avoidance_prefixes = ["no", "without", "avoid", "dont have", "don't have"]
        normalized_prefixes = [
            cls.normalize_lookup_value(prefix) for prefix in avoidance_prefixes
        ]
        optional_articles = ("", "a ", "an ", "the ", "any ")
        for canonical, aliases in cls.KNOWN_EQUIPMENT_KEYWORDS.items():
            normalized_terms = {
                cls.normalize_lookup_value(term) for term in {canonical, *aliases}
            }
            is_avoided = any(
                f" {prefix} {article}{term} " in normalized
                for prefix in normalized_prefixes
                for article in optional_articles
                for term in normalized_terms
            )
            if is_avoided:
                avoided.add(canonical)
            elif any(f" {term} " in normalized for term in normalized_terms):
                preferred.add(canonical)
        if " home " in normalized:
            preferred.update({"bodyweight", "dumbbell", "kettlebell", "band"})
            avoided.add("machine")
        preferred.difference_update(avoided)
        return preferred, avoided, same_equipment_requested

    @classmethod
    def rerank_suggestions(
        cls,
        suggestions: list[dict[str, Any]],
        *,
        source_exercise: Any,
        context_notes: str | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        if not context_notes:
            return suggestions[:limit]
        preferred, avoided, same_requested = cls.extract_equipment_preferences(
            context_notes
        )
        source_equipment = cls.normalize_lookup_value(
            getattr(source_exercise, "equipment", "") or ""
        )

        def score(indexed_item: tuple[int, dict[str, Any]]) -> tuple[int, int]:
            index, item = indexed_item
            equipment = cls.normalize_lookup_value(
                getattr(item["exercise_type"], "equipment", "") or ""
            )
            value = sum(20 for term in preferred if term in equipment)
            value -= sum(40 for term in avoided if term in equipment)
            if same_requested and source_equipment and equipment == source_equipment:
                value += 30
            return value, -index

        return [
            item
            for _, item in sorted(enumerate(suggestions), key=score, reverse=True)[
                :limit
            ]
        ]

    async def recommend_from_source(
        self,
        session: AsyncSession,
        source: ExerciseType,
        *,
        context_notes: str | None,
        limit: int,
        candidate_limit: int | None = None,
        similarity_loader: Callable[
            ..., Awaitable[tuple[list[dict[str, Any]], str]]
        ] = get_similar_exercise_types,
    ) -> ExerciseSubstitutionResult:
        raw_matches, strategy = await similarity_loader(
            session, source, limit=candidate_limit or min(max(limit * 3, limit), 20)
        )
        reranked = self.rerank_suggestions(
            raw_matches,
            source_exercise=source,
            context_notes=context_notes,
            limit=limit,
        )
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
            raise ValueError("Provide exactly one of exercise_type_id or exercise_name")

        source = None
        if exercise_type_id is not None:
            source = await get_exercise_type_by_id(
                session,
                exercise_type_id,
                user_id=user_id,
                released_only=released_only,
            )
        else:
            normalized = self.normalize_lookup_value(exercise_name)
            if not normalized:
                raise LookupError("Exercise name is required")
            # Check all visible names so pagination cannot hide an ambiguity.
            rows = await session.execute(
                select(ExerciseType.id, ExerciseType.name).where(
                    _exercise_type_visibility_clause(
                        user_id=user_id, is_admin=False, released_only=released_only
                    )
                )
            )
            exact = [
                (item_id, name)
                for item_id, name in rows.all()
                if self.normalize_lookup_value(name) == normalized
            ]
            if len(exact) > 1:
                candidates = ", ".join(
                    f"{name} (ID {item_id})" for item_id, name in sorted(exact)
                )
                raise LookupError(
                    f"Ambiguous exercise name. Retry with exercise_type_id: {candidates}"
                )
            if not exact:
                matches = await get_exercise_types(
                    session,
                    name=exercise_name,
                    limit=5,
                    user_id=user_id,
                    released_only=released_only,
                )
                candidates = ", ".join(
                    f"{item.name} (ID {item.id})" for item in matches.data
                )
                hint = (
                    f" Candidates: {candidates}. Retry with exercise_type_id."
                    if candidates
                    else " Use search_exercises to find an exercise ID."
                )
                raise LookupError(f"No exact exercise name match.{hint}")
            source = await get_exercise_type_by_id(
                session, exact[0][0], user_id=user_id, released_only=released_only
            )

        if source is None:
            raise LookupError("Exercise not found")

        return await self.recommend_from_source(
            session,
            source,
            context_notes=context_notes,
            limit=limit,
        )
