from __future__ import annotations

from io import StringIO
from types import SimpleNamespace

import pytest

from src.scripts import dedup_exercise_types as script


def make_match(
    *,
    row_id: int,
    name: str,
    status: str,
    owner_id: int | None = None,
    times_used: int = 0,
) -> script.ExerciseTypeMatch:
    return script.ExerciseTypeMatch(
        id=row_id,
        name=name,
        status=status,
        owner_id=owner_id,
        times_used=times_used,
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


class FakeApplyCursor:
    def __init__(self, rowcounts: list[int]) -> None:
        self._rowcounts = list(rowcounts)
        self.executed: list[tuple[str, tuple[object, ...]]] = []
        self.rowcount = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def execute(self, query: str, params: tuple[object, ...]) -> None:
        self.executed.append((query, params))
        self.rowcount = self._rowcounts.pop(0)


class FakeRunCursor:
    def __init__(
        self,
        *,
        released_rows: list[dict[str, object]],
        non_released_rows: list[dict[str, object]],
        reference_counts: tuple[int, int, int, int],
        apply_rowcounts: list[int] | None = None,
    ) -> None:
        self._released_rows = released_rows
        self._non_released_rows = non_released_rows
        self._reference_counts = reference_counts
        self._apply_rowcounts = list(apply_rowcounts or [])
        self._current_fetchall: list[dict[str, object]] = []
        self._current_fetchone: tuple[int, int, int, int] | None = None
        self.executed: list[tuple[str, tuple[object, ...]]] = []
        self.rowcount = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def execute(self, query: str, params: tuple[object, ...]) -> None:
        self.executed.append((query, params))
        if "status::text = 'released'" in query:
            self._current_fetchall = self._released_rows
            self._current_fetchone = None
            self.rowcount = 0
            return

        if "status::text = ANY" in query:
            self._current_fetchall = self._non_released_rows
            self._current_fetchone = None
            self.rowcount = 0
            return

        if "SELECT COUNT(*) FROM exercises" in query:
            self._current_fetchall = []
            self._current_fetchone = self._reference_counts
            self.rowcount = 0
            return

        self._current_fetchall = []
        self._current_fetchone = None
        self.rowcount = self._apply_rowcounts.pop(0)

    def fetchall(self) -> list[dict[str, object]]:
        return self._current_fetchall

    def fetchone(self) -> tuple[int, int, int, int]:
        assert self._current_fetchone is not None
        return self._current_fetchone


class FakeRunConnection(FakeConnection):
    def __init__(self, cursor: FakeRunCursor) -> None:
        super().__init__()
        self._cursor = cursor

    def cursor(self, cursor_factory=None) -> FakeRunCursor:
        return self._cursor


def test_resolve_single_match_rejects_ambiguous_non_released_name():
    matches = [
        make_match(
            row_id=11,
            name="Bench Press",
            status="candidate",
            owner_id=3,
            times_used=1,
        ),
        make_match(
            row_id=12,
            name="Bench Press",
            status="in_review",
            owner_id=7,
            times_used=2,
        ),
    ]

    with pytest.raises(ValueError, match="Expected exactly one non-released"):
        script._resolve_single_match(
            matches,
            role="non-released",
            input_name="Bench Press",
        )


def test_apply_dedup_plan_updates_references_transfers_usage_and_deletes_duplicate():
    plan = script.DedupPlan(
        released=make_match(
            row_id=5,
            name="Bench Press",
            status="released",
            times_used=9,
        ),
        non_released=make_match(
            row_id=8,
            name="Bench Press Draft",
            status="candidate",
            owner_id=22,
            times_used=4,
        ),
        reference_counts=script.ReferenceCounts(
            exercises=3,
            exercise_templates=2,
            exercise_muscles=1,
            exercise_image_candidates=5,
        ),
    )
    cursor = FakeApplyCursor([3, 2, 1, 5, 1, 1])

    applied = script.apply_dedup_plan(cursor, plan)

    assert applied == script.AppliedChanges(
        exercises_updated=3,
        exercise_templates_updated=2,
        exercise_muscles_merged=1,
        exercise_image_candidates_updated=5,
        released_rows_updated=1,
        deleted_exercise_types=1,
    )
    assert len(cursor.executed) == 6
    assert "UPDATE exercises" in cursor.executed[0][0]
    assert cursor.executed[0][1][0] == 5
    assert cursor.executed[0][1][2] == 8
    assert "INSERT INTO exercise_muscles" in cursor.executed[2][0]
    assert cursor.executed[4][1][0] == 4
    assert cursor.executed[4][1][2] == 5
    assert cursor.executed[5][1] == (8,)


def test_run_dedup_dry_run_prints_report_and_rolls_back(monkeypatch):
    cursor = FakeRunCursor(
        released_rows=[
            {
                "id": 101,
                "name": "Deadlift",
                "status": "released",
                "owner_id": None,
                "times_used": 8,
            }
        ],
        non_released_rows=[
            {
                "id": 202,
                "name": "Barbell Deadlift",
                "status": "candidate",
                "owner_id": 14,
                "times_used": 3,
            }
        ],
        reference_counts=(6, 2, 1, 4),
    )
    connection = FakeRunConnection(cursor)
    monkeypatch.setattr(script, "connect_target_database", lambda args: connection)
    stream = StringIO()
    args = SimpleNamespace(
        released_name="Deadlift",
        non_released_name="Barbell Deadlift",
        non_released_owner_id=None,
        apply=False,
        dry_run=False,
        database_url=None,
    )

    result = script.run_dedup(args, stream=stream)

    assert result.applied_changes is None
    assert result.plan.released.id == 101
    assert result.plan.non_released.id == 202
    assert connection.commits == 0
    assert connection.rollbacks == 1
    assert connection.closed == 1
    output = stream.getvalue()
    assert "DRY RUN: dedup exercise types" in output
    assert "Deadlift (id=101, status=released)" in output
    assert "exercise_templates: 2" in output
    assert "Dry run only. Re-run with --apply to persist changes." in output


def test_run_dedup_apply_commits_and_prints_applied_counts(monkeypatch):
    cursor = FakeRunCursor(
        released_rows=[
            {
                "id": 301,
                "name": "Squat",
                "status": "released",
                "owner_id": None,
                "times_used": 12,
            }
        ],
        non_released_rows=[
            {
                "id": 404,
                "name": "Back Squat",
                "status": "in_review",
                "owner_id": 9,
                "times_used": 7,
            }
        ],
        reference_counts=(10, 4, 2, 3),
        apply_rowcounts=[10, 4, 2, 3, 1, 1],
    )
    connection = FakeRunConnection(cursor)
    monkeypatch.setattr(script, "connect_target_database", lambda args: connection)
    stream = StringIO()
    args = SimpleNamespace(
        released_name="Squat",
        non_released_name="Back Squat",
        non_released_owner_id=9,
        apply=True,
        dry_run=False,
        database_url=None,
    )

    result = script.run_dedup(args, stream=stream)

    assert result.applied_changes == script.AppliedChanges(
        exercises_updated=10,
        exercise_templates_updated=4,
        exercise_muscles_merged=2,
        exercise_image_candidates_updated=3,
        released_rows_updated=1,
        deleted_exercise_types=1,
    )
    assert connection.commits == 1
    assert connection.rollbacks == 0
    assert connection.closed == 1
    output = stream.getvalue()
    assert "APPLY: dedup exercise types" in output
    assert "Applied changes: exercises=10, exercise_templates=4" in output


def test_apply_dedup_plan_raises_if_released_row_not_updated():
    plan = script.DedupPlan(
        released=make_match(row_id=5, name="R", status="released"),
        non_released=make_match(row_id=8, name="N", status="candidate"),
        reference_counts=script.ReferenceCounts(0, 0, 0, 0),
    )
    # Cursor returns 0 for the UPDATE of released row (the 5th call)
    cursor = FakeApplyCursor([0, 0, 0, 0, 0, 1])

    with pytest.raises(RuntimeError, match="Expected exactly 1 released row"):
        script.apply_dedup_plan(cursor, plan)


def test_apply_dedup_plan_raises_if_non_released_row_not_deleted():
    plan = script.DedupPlan(
        released=make_match(row_id=5, name="R", status="released"),
        non_released=make_match(row_id=8, name="N", status="candidate"),
        reference_counts=script.ReferenceCounts(0, 0, 0, 0),
    )
    # Cursor returns 0 for the DELETE of non-released row (the 6th call)
    cursor = FakeApplyCursor([0, 0, 0, 0, 1, 0])

    with pytest.raises(RuntimeError, match="Expected exactly 1 non-released row"):
        script.apply_dedup_plan(cursor, plan)
