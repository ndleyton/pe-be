from src.exercises.muscle_group_mapping import (
    DEFAULT_MUSCLE_GROUP,
    KNOWN_MUSCLE_GROUPS,
    get_muscle_group_for_muscle,
)


def test_get_muscle_group_for_muscle_exact_match():
    assert get_muscle_group_for_muscle("glutes") == "Glutes"
    assert get_muscle_group_for_muscle("triceps") == "Arms"


def test_get_muscle_group_for_muscle_partial_match_is_case_insensitive():
    assert get_muscle_group_for_muscle("Upper Chest") == "Chest"
    assert get_muscle_group_for_muscle("Rear Deltoids") == "Back"


def test_get_muscle_group_for_muscle_unknown_falls_back_to_imported():
    assert get_muscle_group_for_muscle("serratus anterior") == DEFAULT_MUSCLE_GROUP


def test_known_muscle_groups_includes_extended_anatomical_groups():
    assert {"Forearms", "Glutes", "Neck", DEFAULT_MUSCLE_GROUP}.issubset(
        KNOWN_MUSCLE_GROUPS
    )
