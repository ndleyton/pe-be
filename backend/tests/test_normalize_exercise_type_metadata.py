from __future__ import annotations

from io import StringIO
from types import SimpleNamespace

import pytest

from src.scripts import normalize_exercise_type_metadata as script


def make_row(
    *,
    row_id: int = 1,
    name: str = "Cable Row",
    external_id: str | None = None,
    description: str | None = None,
    instructions: str | None = None,
    equipment: str | None = None,
    category: str | None = None,
) -> script.ExerciseTypeRow:
    return script.ExerciseTypeRow(
        id=row_id,
        name=name,
        external_id=external_id,
        description=description,
        instructions=instructions,
        equipment=equipment,
        category=category,
    )


def make_source(
    *,
    source_id: str = "101",
    name: str = "Cable Row",
    force: str | None = "Pull",
    level: str | None = "Beginner",
    mechanic: str | None = "Compound",
    instructions: str | None = "Sit tall\nDrive elbows back",
    equipment: str | None = "Cable",
    category: str | None = "Strength",
) -> script.SourceExerciseRow:
    return script.SourceExerciseRow(
        id=source_id,
        name=name,
        force=force,
        level=level,
        mechanic=mechanic,
        instructions=instructions,
        equipment=equipment,
        category=category,
    )


class FakeConnection:
    def __init__(self) -> None:
        self.autocommit = True
        self.commits = 0
        self.rollbacks = 0
        self.closed = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1

    def close(self) -> None:
        self.closed += 1


def test_parse_labeled_description_sections_extracts_summary_and_fields():
    parsed = script.parse_labeled_description_sections(
        """
        Great for upper-back control.
        Instructions: Sit tall
        Drive elbows back
        Equipment: Cable machine
        Category: Strength
        Level: Beginner
        Mechanic: Compound
        """
    )

    assert parsed.has_labeled_sections is True
    assert parsed.summary == "Great for upper-back control."
    assert parsed.instructions == "Sit tall\nDrive elbows back"
    assert parsed.equipment == "Cable machine"
    assert parsed.category == "Strength"
    assert parsed.level == "Beginner"
    assert parsed.mechanic == "Compound"


def test_build_description_summary_prefers_readable_metadata():
    assert (
        script.build_description_summary(
            level="Intermediate",
            mechanic="Isolation",
            category="Stretching",
            force="Pull",
        )
        == "Intermediate isolation stretching exercise."
    )
    assert (
        script.build_description_summary(
            level="Beginner",
            mechanic=None,
            category="Cardio",
            force="Push",
        )
        == "Beginner cardio exercise."
    )


def test_plan_row_update_uses_source_metadata_for_legacy_description():
    row = make_row(
        external_id="101",
        description="Pull\nBeginner\nCompound",
    )
    source = make_source()

    outcome = script.plan_row_update(
        row,
        source_row=source,
        overwrite_populated_fields=False,
        rewrite_description_from_source=False,
    )

    assert outcome.unresolved_reason is None
    assert outcome.matched_source is True
    assert outcome.update is not None

    changed_fields = {change.field_name: change for change in outcome.update.changes}
    assert changed_fields["instructions"].new_value == "Sit tall\nDrive elbows back"
    assert changed_fields["equipment"].new_value == "Cable"
    assert changed_fields["category"].new_value == "Strength"
    assert (
        changed_fields["description"].new_value
        == "Beginner compound strength exercise."
    )
    assert "rewrite_legacy_description" in outcome.update.reasons


def test_plan_row_update_preserves_human_description_without_rewrite_flag():
    row = make_row(
        external_id="101",
        description="A stable rowing variation for upper-back focus.",
    )
    source = make_source()

    outcome = script.plan_row_update(
        row,
        source_row=source,
        overwrite_populated_fields=False,
        rewrite_description_from_source=False,
    )

    assert outcome.update is not None
    assert {change.field_name for change in outcome.update.changes} == {
        "instructions",
        "equipment",
        "category",
    }


def test_plan_row_update_parses_embedded_metadata_without_source():
    row = make_row(
        description=(
            "Great for posture.\n"
            "Instructions: Sit tall\n"
            "Pull handle to torso\n"
            "Equipment: Cable\n"
            "Category: Strength"
        ),
    )

    outcome = script.plan_row_update(
        row,
        source_row=None,
        overwrite_populated_fields=False,
        rewrite_description_from_source=False,
    )

    assert outcome.unresolved_reason is None
    assert outcome.update is not None
    changed_fields = {change.field_name: change for change in outcome.update.changes}
    assert changed_fields["instructions"].new_value == "Sit tall\nPull handle to torso"
    assert changed_fields["equipment"].new_value == "Cable"
    assert changed_fields["category"].new_value == "Strength"
    assert changed_fields["description"].new_value == "Great for posture."


def test_plan_row_update_respects_overwrite_populated_fields_guard():
    row = make_row(
        external_id="101",
        description="Pull\nBeginner\nCompound",
        equipment="Dumbbell",
    )
    source = make_source(equipment="Cable")

    outcome_without_overwrite = script.plan_row_update(
        row,
        source_row=source,
        overwrite_populated_fields=False,
        rewrite_description_from_source=False,
    )
    outcome_with_overwrite = script.plan_row_update(
        row,
        source_row=source,
        overwrite_populated_fields=True,
        rewrite_description_from_source=False,
    )

    assert outcome_without_overwrite.update is not None
    assert "equipment" not in {
        change.field_name for change in outcome_without_overwrite.update.changes
    }

    assert outcome_with_overwrite.update is not None
    changed_fields = {
        change.field_name: change for change in outcome_with_overwrite.update.changes
    }
    assert changed_fields["equipment"].new_value == "Cable"


def test_plan_updates_marks_missing_source_rows_unresolved():
    row = make_row(
        external_id="999",
        description="Pull\nBeginner\nCompound",
    )

    report = script.plan_updates(
        [row],
        source_lookup={},
        overwrite_populated_fields=False,
        rewrite_description_from_source=False,
    )

    assert report.scanned_rows == 1
    assert len(report.updates) == 0
    assert len(report.unresolved) == 1
    assert report.unresolved[0].reason == (
        "missing source row for external_id; "
        "no safe source or labeled metadata for: instructions, equipment, category"
    )


def test_run_normalization_rolls_back_in_dry_run(monkeypatch):
    target_connection = FakeConnection()
    source_connection = FakeConnection()
    row = make_row(external_id="101", description="Pull\nBeginner\nCompound")
    source = make_source()
    stream = StringIO()

    monkeypatch.setattr(
        script,
        "connect_target_database",
        lambda args: target_connection,
    )
    monkeypatch.setattr(
        script,
        "connect_source_database",
        lambda args: source_connection,
    )
    monkeypatch.setattr(
        script,
        "load_target_rows",
        lambda connection, **kwargs: [row],
    )
    monkeypatch.setattr(
        script,
        "load_source_lookup",
        lambda connection, external_ids: {"101": source},
    )

    apply_calls: list[tuple[script.PlannedExerciseTypeUpdate, ...]] = []

    def _fake_apply(connection, updates):
        apply_calls.append(updates)
        return len(updates)

    monkeypatch.setattr(script, "apply_planned_updates", _fake_apply)

    result = script.run_normalization(
        SimpleNamespace(
            exercise_type_id=None,
            external_id=None,
            limit=None,
            overwrite_populated_fields=False,
            rewrite_description_from_source=False,
            apply=False,
            dry_run=False,
        ),
        stream=stream,
    )

    assert result.applied_rows == 0
    assert target_connection.rollbacks == 1
    assert target_connection.commits == 0
    assert apply_calls == []
    assert "DRY RUN: normalize exercise type metadata" in stream.getvalue()
    assert "Dry run only. Re-run with --apply to persist changes." in stream.getvalue()


def test_run_normalization_commits_in_apply_mode(monkeypatch):
    target_connection = FakeConnection()
    source_connection = FakeConnection()
    row = make_row(external_id="101", description="Pull\nBeginner\nCompound")
    source = make_source()
    stream = StringIO()

    monkeypatch.setattr(
        script,
        "connect_target_database",
        lambda args: target_connection,
    )
    monkeypatch.setattr(
        script,
        "connect_source_database",
        lambda args: source_connection,
    )
    monkeypatch.setattr(
        script,
        "load_target_rows",
        lambda connection, **kwargs: [row],
    )
    monkeypatch.setattr(
        script,
        "load_source_lookup",
        lambda connection, external_ids: {"101": source},
    )

    apply_calls: list[tuple[script.PlannedExerciseTypeUpdate, ...]] = []

    def _fake_apply(connection, updates):
        apply_calls.append(updates)
        return len(updates)

    monkeypatch.setattr(script, "apply_planned_updates", _fake_apply)

    result = script.run_normalization(
        SimpleNamespace(
            exercise_type_id=None,
            external_id=None,
            limit=None,
            overwrite_populated_fields=False,
            rewrite_description_from_source=False,
            apply=True,
            dry_run=False,
        ),
        stream=stream,
    )

    assert result.applied_rows == 1
    assert target_connection.commits == 1
    assert target_connection.rollbacks == 0
    assert len(apply_calls) == 1
    assert "APPLY: normalize exercise type metadata" in stream.getvalue()
    assert "Applied rows: 1" in stream.getvalue()


@pytest.mark.parametrize(
    ("rewrite_flag", "expected_description"),
    [
        (False, None),
        (True, "Beginner compound strength exercise."),
    ],
)
def test_rewrite_description_from_source_flag_controls_clean_descriptions(
    rewrite_flag: bool,
    expected_description: str | None,
):
    row = make_row(
        external_id="101",
        description="A stable rowing variation for upper-back focus.",
    )
    source = make_source()

    outcome = script.plan_row_update(
        row,
        source_row=source,
        overwrite_populated_fields=False,
        rewrite_description_from_source=rewrite_flag,
    )

    assert outcome.update is not None
    changed_fields = {change.field_name: change for change in outcome.update.changes}
    if expected_description is None:
        assert "description" not in changed_fields
    else:
        assert changed_fields["description"].new_value == expected_description
