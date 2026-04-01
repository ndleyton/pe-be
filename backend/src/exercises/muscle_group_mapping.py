"""Shared muscle-name to muscle-group mapping helpers."""

from __future__ import annotations

MUSCLE_NAME_TO_GROUP: dict[str, str] = {
    # Arms
    "biceps": "Arms",
    "triceps": "Arms",
    "biceps brachii": "Arms",
    "triceps brachii": "Arms",
    # Forearms
    "forearms": "Forearms",
    "wrist flexors": "Forearms",
    "wrist extensors": "Forearms",
    # Chest
    "chest": "Chest",
    "pectorals": "Chest",
    "pectoralis major": "Chest",
    "pectoralis minor": "Chest",
    # Back
    "lats": "Back",
    "latissimus dorsi": "Back",
    "traps": "Back",
    "trapezius": "Back",
    "rhomboids": "Back",
    "lower back": "Back",
    "middle back": "Back",
    "erector spinae": "Back",
    "rear deltoids": "Back",
    # Shoulders
    "shoulders": "Shoulders",
    "deltoids": "Shoulders",
    "anterior deltoids": "Shoulders",
    "lateral deltoids": "Shoulders",
    "posterior deltoids": "Shoulders",
    # Core
    "abdominals": "Core",
    "abs": "Core",
    "core": "Core",
    "obliques": "Core",
    "rectus abdominis": "Core",
    "transverse abdominis": "Core",
    # Legs
    "quadriceps": "Legs",
    "hamstrings": "Legs",
    "calves": "Legs",
    "adductors": "Legs",
    "abductors": "Legs",
    "tibialis anterior": "Legs",
    "gastrocnemius": "Legs",
    "soleus": "Legs",
    "vastus lateralis": "Legs",
    "vastus medialis": "Legs",
    "vastus intermedius": "Legs",
    "rectus femoris": "Legs",
    "biceps femoris": "Legs",
    "semitendinosus": "Legs",
    "semimembranosus": "Legs",
    # Glutes
    "glutes": "Glutes",
    "gluteus maximus": "Glutes",
    "gluteus medius": "Glutes",
    "gluteus minimus": "Glutes",
    # Neck
    "neck": "Neck",
    "sternocleidomastoid": "Neck",
}

DEFAULT_MUSCLE_GROUP = "Imported"
KNOWN_MUSCLE_GROUPS = frozenset({*MUSCLE_NAME_TO_GROUP.values(), DEFAULT_MUSCLE_GROUP})


def get_muscle_group_for_muscle(muscle_name: str) -> str:
    """Return the best-fit muscle group for a muscle name."""
    muscle_lower = muscle_name.lower().strip()
    if not muscle_lower:
        return DEFAULT_MUSCLE_GROUP

    if muscle_lower in MUSCLE_NAME_TO_GROUP:
        return MUSCLE_NAME_TO_GROUP[muscle_lower]

    for key, group in MUSCLE_NAME_TO_GROUP.items():
        if key in muscle_lower or muscle_lower in key:
            return group

    return DEFAULT_MUSCLE_GROUP
