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
    primary_muscles: list[str] | None = None,
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
        primary_muscles=primary_muscles,
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


class FakeLookupCursor:
    def __init__(self, rows_by_query: dict[str, list[dict[str, object]]]) -> None:
        self._rows_by_query = rows_by_query
        self._current_rows: list[dict[str, object]] = []
        self.executed: list[tuple[str, tuple[object, ...]]] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def execute(self, query: str, params: tuple[object, ...]) -> None:
        self.executed.append((query, params))
        if "WHERE id = ANY" in query:
            self._current_rows = self._rows_by_query["id"]
        elif "WHERE LOWER(name) = ANY" in query:
            self._current_rows = self._rows_by_query["name"]
        else:
            self._current_rows = []

    def fetchall(self) -> list[dict[str, object]]:
        return self._current_rows


class FakeLookupConnection:
    def __init__(self, cursor: FakeLookupCursor) -> None:
        self._cursor = cursor

    def cursor(self, cursor_factory=None) -> FakeLookupCursor:
        return self._cursor


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


def test_normalize_muscle_array_handles_various_formats():
    assert script.normalize_muscle_array(["Chest"]) == "chest"
    assert script.normalize_muscle_array(["Lower Back"]) == "lower back"
    assert script.normalize_muscle_array(["", "Biceps"]) == "biceps"
    assert script.normalize_muscle_array(None) is None
    assert script.normalize_muscle_array([]) is None
    assert script.normalize_muscle_array([""]) is None
    assert script.normalize_muscle_array("Shoulders") == "shoulders"


def test_load_source_lookup_uses_text_external_ids():
    cursor = FakeLookupCursor(
        rows_by_query={
            "id": [
                {
                    "id": "3_4_Sit-Up",
                    "name": "3/4 Sit-Up",
                    "force": "pull",
                    "level": "beginner",
                    "mechanic": "compound",
                    "instructions": ["Line 1"],
                    "equipment": "body only",
                    "category": "strength",
                    "primary_muscles": ["abdominals"],
                }
            ],
            "name": [],
        }
    )
    connection = FakeLookupConnection(cursor)

    id_lookup, name_lookup = script.load_source_lookup(
        connection,
        ["3_4_Sit-Up"],
        [],
    )

    assert "3_4_Sit-Up" in id_lookup
    assert name_lookup == {}
    assert cursor.executed[0][1] == (["3_4_Sit-Up"],)


def test_build_description_summary_prefers_readable_metadata():
    assert (
        script.build_description_summary(
            level="Intermediate",
            mechanic="Isolation",
            category="Stretching",
            force="Pull",
            primary_muscle="Back",
        )
        == "Intermediate isolation back stretching exercise."
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
    assert (
        changed_fields["description"].new_value
        == "Beginner compound strength exercise."
    )
    assert "rewrite_legacy_description" in outcome.update.reasons


def test_plan_row_update_uses_source_metadata_includes_muscle_for_legacy_description():
    row = make_row(
        external_id="101",
        description="Pull\nBeginner\nCompound",
    )
    source = make_source(primary_muscles=["Back"])

    outcome = script.plan_row_update(
        row,
        source_row=source,
        overwrite_populated_fields=False,
        rewrite_description_from_source=False,
    )

    changed_fields = {change.field_name: change for change in outcome.update.changes}
    assert (
        changed_fields["description"].new_value
        == "Beginner compound back strength exercise."
    )


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


def test_plan_updates_finds_match_by_name_when_id_missing():
    row = make_row(
        external_id=None,
        name="Push-ups",
        description="Beginner\nCompound",
    )
    source = make_source(name="Push-ups", category="Strength")

    report = script.plan_updates(
        [row],
        id_lookup={},
        name_lookup={"push-ups": source},
        overwrite_populated_fields=False,
        rewrite_description_from_source=False,
    )

    assert len(report.updates) == 1
    assert report.matched_source_rows == 1
    assert report.matched_by_id_rows == 0
    assert report.matched_by_name_rows == 1
    update = report.updates[0]
    assert update.match_method == "name"
    assert update.matched_source is True
    assert any(
        c.field_name == "category" and c.new_value == "Strength" for c in update.changes
    )


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
        id_lookup={},
        name_lookup={},
        overwrite_populated_fields=False,
        rewrite_description_from_source=False,
    )

    assert report.scanned_rows == 1
    assert report.matched_source_rows == 0
    assert report.matched_by_id_rows == 0
    assert report.matched_by_name_rows == 0
    assert len(report.updates) == 0
    assert len(report.unresolved) == 1
    assert report.unresolved[0].reason == (
        "missing source row for external_id; "
        "no safe source or labeled metadata for: instructions, equipment, category"
    )


def test_print_report_includes_match_method_counts():
    report = script.PlanningReport(
        scanned_rows=2,
        matched_source_rows=2,
        matched_by_id_rows=1,
        matched_by_name_rows=1,
        skipped_rows=0,
        updates=(
            script.PlannedExerciseTypeUpdate(
                exercise_type_id=1,
                exercise_name="Bench Press",
                external_id="Bench_Press",
                matched_source=True,
                match_method="id",
                reasons=("backfill_category",),
                changes=(),
            ),
        ),
        unresolved=(),
    )

    stream = StringIO()
    script.print_report(report, apply=False, stream=stream, sample_limit=1)

    output = stream.getvalue()
    assert "Matched source rows: 2" in output
    assert "Matched by id: 1" in output
    assert "Matched by name: 1" in output


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
        lambda connection, external_ids, names: ({"101": source}, {}),
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
        lambda connection, external_ids, names: ({"101": source}, {}),
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


def test_run_normalization_closes_target_connection_when_source_connect_fails(
    monkeypatch,
):
    target_connection = FakeConnection()

    monkeypatch.setattr(
        script,
        "connect_target_database",
        lambda args: target_connection,
    )

    def _fail_source_connect(args):
        raise RuntimeError("source unavailable")

    monkeypatch.setattr(script, "connect_source_database", _fail_source_connect)

    with pytest.raises(RuntimeError, match="source unavailable"):
        script.run_normalization(
            SimpleNamespace(
                exercise_type_id=None,
                external_id=None,
                limit=None,
                overwrite_populated_fields=False,
                rewrite_description_from_source=False,
                apply=False,
                dry_run=False,
            ),
            stream=StringIO(),
        )

    assert target_connection.rollbacks == 1
    assert target_connection.closed == 1


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
        # source default in make_source + new logic = includes muscle if provided
        # but our make_source default has primary_muscles=None
        assert changed_fields["description"].new_value == expected_description


def test_rewrite_description_from_source_flag_includes_muscle():
    row = make_row(
        external_id="101",
        description="A stable rowing variation for upper-back focus.",
    )
    source = make_source(primary_muscles=["Lats"])

    outcome = script.plan_row_update(
        row,
        source_row=source,
        overwrite_populated_fields=False,
        rewrite_description_from_source=True,
    )

    assert outcome.update is not None
    changed_fields = {change.field_name: change for change in outcome.update.changes}
    assert (
        changed_fields["description"].new_value
        == "Beginner compound lats strength exercise."
    )


def test_rewrite_description_from_source_skips_empty_summary(monkeypatch):
    row = make_row(
        external_id="101",
        description="A stable rowing variation for upper-back focus.",
    )
    source = make_source(
        force=None,
        level=None,
        mechanic=None,
        category=None,
    )

    monkeypatch.setattr(
        script,
        "build_description_summary_from_source",
        lambda source_row: None,
    )

    outcome = script.plan_row_update(
        row,
        source_row=source,
        overwrite_populated_fields=False,
        rewrite_description_from_source=True,
    )

    assert outcome.update is not None
    changed_fields = {change.field_name: change for change in outcome.update.changes}
    assert "description" not in changed_fields
