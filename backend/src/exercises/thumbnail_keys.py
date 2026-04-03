from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.exercises.models import ExerciseType


THUMBNAIL_KEY_OTHER = "other"
THUMBNAIL_KEY_FULL_BODY = "full_body"
THUMBNAIL_KEY_CARDIO = "cardio"

_CARDIO_KEYWORDS = (
    "cardio",
    "run",
    "running",
    "walk",
    "walking",
    "jog",
    "jogging",
    "cycle",
    "cycling",
    "bike",
    "biking",
    "swim",
    "swimming",
    "rowing",
    "elliptical",
    "treadmill",
    "aerobic",
    "hiit",
)

_MUSCLE_GROUP_TO_THUMBNAIL_KEY = {
    "arms": "arms",
    "back": "back",
    "chest": "chest",
    "core": "core",
    "forearms": "forearms",
    "glutes": "glutes",
    "legs": "legs",
    "neck": "neck",
    "shoulders": "shoulders",
}


def normalize_thumbnail_key_from_muscle_group(muscle_group_name: str | None) -> str | None:
    if muscle_group_name is None:
        return None

    return _MUSCLE_GROUP_TO_THUMBNAIL_KEY.get(muscle_group_name.strip().lower())


def determine_thumbnail_key(
    *,
    exercise_name: str | None = None,
    category: str | None = None,
    muscle_group_names: Sequence[str] = (),
    primary_muscle_group_names: Sequence[str] = (),
) -> str:
    lowered_name = (exercise_name or "").strip().lower()
    lowered_category = (category or "").strip().lower()

    if any(keyword in lowered_name for keyword in _CARDIO_KEYWORDS) or any(
        keyword in lowered_category for keyword in _CARDIO_KEYWORDS
    ):
        return THUMBNAIL_KEY_CARDIO

    candidate_groups = (
        primary_muscle_group_names if primary_muscle_group_names else muscle_group_names
    )
    normalized_groups = [
        normalized
        for group_name in candidate_groups
        if (normalized := normalize_thumbnail_key_from_muscle_group(group_name))
    ]
    if not normalized_groups:
        return THUMBNAIL_KEY_OTHER

    counts = Counter(normalized_groups)
    top_count = max(counts.values())
    leaders = sorted(key for key, count in counts.items() if count == top_count)

    if len(leaders) == 1:
        return leaders[0]

    return THUMBNAIL_KEY_FULL_BODY


def determine_thumbnail_key_for_exercise_type(exercise_type: ExerciseType) -> str:
    muscle_group_names: list[str] = []
    primary_muscle_group_names: list[str] = []

    for exercise_muscle in getattr(exercise_type, "exercise_muscles", []) or []:
        muscle = getattr(exercise_muscle, "muscle", None)
        muscle_group = getattr(muscle, "muscle_group", None)
        muscle_group_name = getattr(muscle_group, "name", None)
        if not muscle_group_name:
            continue

        muscle_group_names.append(muscle_group_name)
        if getattr(exercise_muscle, "is_primary", False):
            primary_muscle_group_names.append(muscle_group_name)

    return determine_thumbnail_key(
        exercise_name=getattr(exercise_type, "name", None),
        category=getattr(exercise_type, "category", None),
        muscle_group_names=muscle_group_names,
        primary_muscle_group_names=primary_muscle_group_names,
    )
