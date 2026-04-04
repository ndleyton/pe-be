from src.exercises.thumbnail_keys import (
    THUMBNAIL_KEY_CARDIO,
    THUMBNAIL_KEY_FULL_BODY,
    THUMBNAIL_KEY_OTHER,
    determine_thumbnail_key,
)


def test_determine_thumbnail_key_prefers_primary_muscle_groups():
    assert (
        determine_thumbnail_key(
            exercise_name="Row Variation",
            muscle_group_names=["Back", "Arms"],
            primary_muscle_group_names=["Back"],
        )
        == "back"
    )


def test_determine_thumbnail_key_returns_full_body_for_tied_groups():
    assert (
        determine_thumbnail_key(
            exercise_name="Complex Lift",
            muscle_group_names=["Back", "Legs"],
        )
        == THUMBNAIL_KEY_FULL_BODY
    )


def test_determine_thumbnail_key_detects_cardio_from_name():
    assert (
        determine_thumbnail_key(exercise_name="Treadmill Running")
        == THUMBNAIL_KEY_CARDIO
    )


def test_determine_thumbnail_key_defaults_to_other_without_data():
    assert (
        determine_thumbnail_key(exercise_name="Mystery Movement") == THUMBNAIL_KEY_OTHER
    )
