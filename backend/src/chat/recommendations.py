import re
from dataclasses import dataclass
from typing import Any


_TOKEN_RE = re.compile(r"[a-z0-9]+")

_SPLIT_PHRASES = {
    "full body": ("full body", "total body"),
    "upper lower": ("upper lower", "upper/lower"),
    "push pull legs": ("push pull legs", "ppl", "push/pull/legs"),
    "push": ("push",),
    "pull": ("pull",),
    "legs": ("legs", "leg"),
    "arms": ("arms", "arm"),
    "cardio": ("cardio", "conditioning"),
    "mobility": ("mobility", "stretching"),
}
_GOAL_PHRASES = {
    "hypertrophy": ("hypertrophy", "muscle", "bodybuilding", "size"),
    "strength": ("strength", "strong", "powerlifting"),
    "beginner": ("beginner", "new", "novice"),
    "advanced": ("advanced",),
    "intermediate": ("intermediate",),
    "powerbuilding": ("powerbuilding",),
    "glutes": ("glutes", "glute"),
    "arms": ("arms", "biceps", "triceps"),
    "shoulders": ("shoulders", "delts", "deltoids"),
    "back": ("back", "lats"),
    "chest": ("chest", "pecs"),
}
_EQUIPMENT_PHRASES = {
    "dumbbell": ("dumbbell", "dumbbells", "db"),
    "machine": ("machine", "machines"),
    "barbell": ("barbell", "barbells"),
    "bodyweight": ("bodyweight", "body weight", "calisthenics"),
    "home": ("home", "minimal equipment"),
    "gym": ("gym", "commercial gym", "full gym"),
}


@dataclass(frozen=True)
class RecommendationFilters:
    query: str
    goal: str | None = None
    experience_level: str | None = None
    equipment: str | None = None
    days_per_week: int | None = None
    session_length_minutes: int | None = None
    constraints: str | None = None


@dataclass(frozen=True)
class RankedRecommendation:
    summary: dict[str, Any]
    score: float
    reason: str


def _normalize(value: str | None) -> str:
    return " ".join(_TOKEN_RE.findall((value or "").casefold()))


def _tokens(value: str | None) -> set[str]:
    return set(_TOKEN_RE.findall((value or "").casefold()))


def _contains_any(normalized_text: str, phrases: tuple[str, ...]) -> bool:
    haystack = f" {normalized_text} "
    return any(f" {_normalize(phrase)} " in haystack for phrase in phrases)


def _detect_features(text: str, phrase_map: dict[str, tuple[str, ...]]) -> set[str]:
    normalized = _normalize(text)
    return {
        feature
        for feature, phrases in phrase_map.items()
        if _contains_any(normalized, phrases)
    }


def _candidate_text(summary: dict[str, Any], preview_key: str) -> str:
    preview = " ".join(str(item) for item in summary.get(preview_key, []) or [])
    return " ".join(
        str(part)
        for part in (
            summary.get("name"),
            summary.get("description"),
            summary.get("author"),
            summary.get("category"),
            summary.get("source_label"),
            preview,
        )
        if part
    )


def _score_candidate(
    summary: dict[str, Any],
    filters: RecommendationFilters,
    *,
    preview_key: str,
    is_program: bool,
) -> RankedRecommendation:
    query_text = " ".join(
        str(part)
        for part in (
            filters.query,
            filters.goal,
            filters.experience_level,
            filters.equipment,
            filters.constraints,
            f"{filters.days_per_week} day" if filters.days_per_week else None,
            (
                f"{filters.session_length_minutes} minute"
                if filters.session_length_minutes
                else None
            ),
        )
        if part
    )
    query_tokens = _tokens(query_text)
    name_tokens = _tokens(summary.get("name"))
    description_tokens = _tokens(summary.get("description"))
    category_tokens = _tokens(summary.get("category"))
    author_tokens = _tokens(summary.get("author"))
    source_tokens = _tokens(summary.get("source_label"))
    preview_tokens = _tokens(" ".join(summary.get(preview_key, []) or []))

    raw_score = 0.0
    reasons: list[str] = []

    name_overlap = query_tokens & name_tokens
    if name_overlap:
        raw_score += min(8.0, 4.0 * len(name_overlap))
        reasons.append("name match")

    category_overlap = query_tokens & category_tokens
    if category_overlap:
        raw_score += 3.0
        reasons.append("category match")

    requested_source = _tokens(filters.query) & (author_tokens | source_tokens)
    if requested_source:
        raw_score += 2.0
        reasons.append("source match")

    description_overlap = query_tokens & description_tokens
    if description_overlap:
        raw_score += min(4.0, 2.0 * len(description_overlap))
        reasons.append("description match")

    preview_overlap = query_tokens & preview_tokens
    if preview_overlap:
        raw_score += min(3.0, 1.0 * len(preview_overlap))
        reasons.append("program preview match" if is_program else "exercise preview match")

    if str(summary.get("visibility", "")).endswith("public"):
        raw_score += 0.5
    if summary.get("is_readonly"):
        raw_score += 0.5

    times_used = int(summary.get("times_used") or 0)
    raw_score += min(1.0, times_used / 20)

    candidate_normalized = _normalize(_candidate_text(summary, preview_key))
    query_features = (
        _detect_features(query_text, _SPLIT_PHRASES)
        | _detect_features(query_text, _GOAL_PHRASES)
        | _detect_features(query_text, _EQUIPMENT_PHRASES)
    )
    candidate_features = (
        _detect_features(candidate_normalized, _SPLIT_PHRASES)
        | _detect_features(candidate_normalized, _GOAL_PHRASES)
        | _detect_features(candidate_normalized, _EQUIPMENT_PHRASES)
    )
    feature_matches = query_features & candidate_features
    if feature_matches:
        raw_score += min(6.0, 2.0 * len(feature_matches))
        reasons.append(
            "matches " + ", ".join(sorted(feature_matches)[:3]) + " intent"
        )

    equipment_features = _detect_features(filters.equipment or "", _EQUIPMENT_PHRASES)
    if equipment_features and not (equipment_features & candidate_features):
        raw_score -= 3.0

    goal_features = _detect_features(
        " ".join(
            part
            for part in (filters.goal or "", filters.experience_level or "")
            if part
        ),
        _GOAL_PHRASES,
    )
    if goal_features and not (goal_features & candidate_features):
        raw_score -= 3.0

    if is_program and filters.days_per_week is not None:
        day_count = int(summary.get("day_count") or 0)
        if day_count == filters.days_per_week:
            raw_score += 4.0
            reasons.append(f"{day_count}-day match")
        elif day_count:
            raw_score -= min(3.0, abs(day_count - filters.days_per_week))

    if filters.session_length_minutes is not None:
        session = filters.session_length_minutes
        express_requested = session <= 35
        express_candidate = _contains_any(
            candidate_normalized,
            ("express", "quick", "30 minute", "30 min", "short"),
        )
        if express_requested and express_candidate:
            raw_score += 2.0
            reasons.append("session length match")
        elif express_requested:
            raw_score -= 1.0

    score = max(0.0, min(1.0, raw_score / 16.0))
    if not reasons:
        reasons.append("closest public library match")

    return RankedRecommendation(
        summary=summary,
        score=score,
        reason="; ".join(reasons[:3]).capitalize() + ".",
    )


def rank_recommendations(
    summaries: list[dict[str, Any]],
    filters: RecommendationFilters,
    *,
    preview_key: str,
    limit: int,
    is_program: bool = False,
) -> list[RankedRecommendation]:
    ranked = [
        _score_candidate(
            summary,
            filters,
            preview_key=preview_key,
            is_program=is_program,
        )
        for summary in summaries
    ]
    ranked.sort(
        key=lambda item: (
            item.score,
            int(item.summary.get("times_used") or 0),
            -int(item.summary.get("id") or 0),
        ),
        reverse=True,
    )
    return [item for item in ranked if item.score >= 0.45][:limit]
