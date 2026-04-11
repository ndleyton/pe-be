from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TextIO
from urllib.parse import urlparse

import psycopg2
from psycopg2.extras import RealDictCursor

from src.core.config import settings


NON_RELEASED_STATUSES = ("candidate", "in_review")


@dataclass(frozen=True)
class ExerciseTypeMatch:
    id: int
    name: str
    status: str
    owner_id: int | None
    times_used: int


@dataclass(frozen=True)
class ReferenceCounts:
    exercises: int
    exercise_templates: int
    exercise_muscles: int
    exercise_image_candidates: int


@dataclass(frozen=True)
class DedupPlan:
    released: ExerciseTypeMatch
    non_released: ExerciseTypeMatch
    reference_counts: ReferenceCounts


@dataclass(frozen=True)
class AppliedChanges:
    exercises_updated: int
    exercise_templates_updated: int
    exercise_muscles_merged: int
    exercise_image_candidates_updated: int
    released_rows_updated: int
    deleted_exercise_types: int


@dataclass(frozen=True)
class RunResult:
    plan: DedupPlan
    applied_changes: AppliedChanges | None


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Repoint all references from one non-released exercise type to a "
            "released exercise type, then delete the non-released row. "
            "Defaults to dry-run mode."
        )
    )
    parser.add_argument(
        "--released-name",
        required=True,
        help="Case-insensitive name of the released exercise type to keep.",
    )
    parser.add_argument(
        "--non-released-name",
        required=True,
        help="Case-insensitive name of the candidate/in-review exercise type to remove.",
    )
    parser.add_argument(
        "--non-released-owner-id",
        type=int,
        default=None,
        help=(
            "Optional owner id to disambiguate multiple non-released exercise "
            "types with the same name."
        ),
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="Full PostgreSQL connection URL for the target app database.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist changes. Without this flag the script only prints a dry run.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Explicitly force dry-run mode.",
    )
    return parser.parse_args(argv)


def normalize_database_url(database_url: str) -> str:
    parsed = urlparse(database_url)
    if parsed.scheme == "postgresql+asyncpg":
        return database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if parsed.scheme == "postgres+asyncpg":
        return database_url.replace("postgres+asyncpg://", "postgres://", 1)
    return database_url


def connect_target_database(args: argparse.Namespace):
    database_url = args.database_url or settings.DATABASE_URL
    return psycopg2.connect(normalize_database_url(database_url))


def _row_to_match(row: dict[str, object]) -> ExerciseTypeMatch:
    return ExerciseTypeMatch(
        id=int(row["id"]),
        name=str(row["name"]),
        status=str(row["status"]),
        owner_id=int(row["owner_id"]) if row["owner_id"] is not None else None,
        times_used=int(row["times_used"]),
    )


def _format_match(match: ExerciseTypeMatch) -> str:
    return (
        f"id={match.id}, name={match.name!r}, status={match.status}, "
        f"owner_id={match.owner_id}, times_used={match.times_used}"
    )


def _resolve_single_match(
    matches: list[ExerciseTypeMatch],
    *,
    role: str,
    input_name: str,
    owner_id: int | None = None,
) -> ExerciseTypeMatch:
    if len(matches) == 1:
        return matches[0]

    if not matches:
        owner_suffix = f" and owner_id={owner_id}" if owner_id is not None else ""
        raise ValueError(
            f"No {role} exercise type matched name {input_name!r}{owner_suffix}."
        )

    details = "; ".join(_format_match(match) for match in matches)
    raise ValueError(
        f"Expected exactly one {role} exercise type for name {input_name!r}, "
        f"found {len(matches)}: {details}"
    )


def load_released_matches(connection, name: str) -> list[ExerciseTypeMatch]:
    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            SELECT id, name, status::text AS status, owner_id, times_used
            FROM exercise_types
            WHERE LOWER(name) = LOWER(%s)
              AND status::text = 'released'
            ORDER BY id
            """,
            (name,),
        )
        return [_row_to_match(row) for row in cursor.fetchall()]


def load_non_released_matches(
    connection,
    name: str,
    *,
    owner_id: int | None,
) -> list[ExerciseTypeMatch]:
    query = """
        SELECT id, name, status::text AS status, owner_id, times_used
        FROM exercise_types
        WHERE LOWER(name) = LOWER(%s)
          AND status::text = ANY(%s)
    """
    params: list[object] = [name, list(NON_RELEASED_STATUSES)]
    if owner_id is not None:
        query += " AND owner_id = %s"
        params.append(owner_id)
    query += " ORDER BY id"

    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(query, tuple(params))
        return [_row_to_match(row) for row in cursor.fetchall()]


def load_reference_counts(connection, exercise_type_id: int) -> ReferenceCounts:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM exercises WHERE exercise_type_id = %s),
                (SELECT COUNT(*) FROM exercise_templates WHERE exercise_type_id = %s),
                (SELECT COUNT(*) FROM exercise_muscles WHERE exercise_type_id = %s),
                (
                    SELECT COUNT(*)
                    FROM exercise_image_candidates
                    WHERE exercise_type_id = %s
                )
            """,
            (
                exercise_type_id,
                exercise_type_id,
                exercise_type_id,
                exercise_type_id,
            ),
        )
        exercises, exercise_templates, exercise_muscles, image_candidates = (
            cursor.fetchone()
        )
        return ReferenceCounts(
            exercises=int(exercises),
            exercise_templates=int(exercise_templates),
            exercise_muscles=int(exercise_muscles),
            exercise_image_candidates=int(image_candidates),
        )


def build_dedup_plan(
    connection,
    *,
    released_name: str,
    non_released_name: str,
    non_released_owner_id: int | None,
) -> DedupPlan:
    released = _resolve_single_match(
        load_released_matches(connection, released_name),
        role="released",
        input_name=released_name,
    )
    non_released = _resolve_single_match(
        load_non_released_matches(
            connection,
            non_released_name,
            owner_id=non_released_owner_id,
        ),
        role="non-released",
        input_name=non_released_name,
        owner_id=non_released_owner_id,
    )
    if released.id == non_released.id:
        raise ValueError("Released and non-released exercise types resolved to the same row.")

    return DedupPlan(
        released=released,
        non_released=non_released,
        reference_counts=load_reference_counts(connection, non_released.id),
    )


def print_report(plan: DedupPlan, *, apply: bool, stream: TextIO) -> None:
    mode = "APPLY" if apply else "DRY RUN"
    print(f"{mode}: dedup exercise types", file=stream)
    print(
        "Released target: "
        f"{plan.released.name} (id={plan.released.id}, status={plan.released.status})",
        file=stream,
    )
    print(
        "Non-released source: "
        f"{plan.non_released.name} (id={plan.non_released.id}, "
        f"status={plan.non_released.status}, owner_id={plan.non_released.owner_id})",
        file=stream,
    )
    print("References to repoint:", file=stream)
    print(f"  exercises: {plan.reference_counts.exercises}", file=stream)
    print(
        f"  exercise_templates: {plan.reference_counts.exercise_templates}",
        file=stream,
    )
    print(
        f"  exercise_muscles to merge: {plan.reference_counts.exercise_muscles}",
        file=stream,
    )
    print(
        "  exercise_image_candidates: "
        f"{plan.reference_counts.exercise_image_candidates}",
        file=stream,
    )
    print(
        f"  times_used to transfer: {plan.non_released.times_used}",
        file=stream,
    )
    print("The non-released row will be deleted after the reassignment.", file=stream)

    if not apply:
        print("Dry run only. Re-run with --apply to persist changes.", file=stream)


def apply_dedup_plan(cursor, plan: DedupPlan) -> AppliedChanges:
    now = datetime.now(timezone.utc)

    cursor.execute(
        """
        UPDATE exercises
        SET exercise_type_id = %s, updated_at = %s
        WHERE exercise_type_id = %s
        """,
        (plan.released.id, now, plan.non_released.id),
    )
    exercises_updated = cursor.rowcount

    cursor.execute(
        """
        UPDATE exercise_templates
        SET exercise_type_id = %s, updated_at = %s
        WHERE exercise_type_id = %s
        """,
        (plan.released.id, now, plan.non_released.id),
    )
    exercise_templates_updated = cursor.rowcount

    cursor.execute(
        """
        INSERT INTO exercise_muscles (
            exercise_type_id,
            muscle_id,
            is_primary,
            created_at,
            updated_at
        )
        SELECT
            %s,
            muscle_id,
            is_primary,
            created_at,
            %s
        FROM exercise_muscles
        WHERE exercise_type_id = %s
        ON CONFLICT (exercise_type_id, muscle_id) DO UPDATE
        SET
            is_primary = exercise_muscles.is_primary OR EXCLUDED.is_primary,
            updated_at = EXCLUDED.updated_at
        """,
        (plan.released.id, now, plan.non_released.id),
    )
    exercise_muscles_merged = cursor.rowcount

    cursor.execute(
        """
        UPDATE exercise_image_candidates
        SET exercise_type_id = %s, updated_at = %s
        WHERE exercise_type_id = %s
        """,
        (plan.released.id, now, plan.non_released.id),
    )
    exercise_image_candidates_updated = cursor.rowcount

    cursor.execute(
        """
        UPDATE exercise_types
        SET times_used = times_used + %s, updated_at = %s
        WHERE id = %s
        """,
        (plan.non_released.times_used, now, plan.released.id),
    )
    released_rows_updated = cursor.rowcount

    cursor.execute(
        "DELETE FROM exercise_types WHERE id = %s",
        (plan.non_released.id,),
    )
    deleted_exercise_types = cursor.rowcount

    return AppliedChanges(
        exercises_updated=exercises_updated,
        exercise_templates_updated=exercise_templates_updated,
        exercise_muscles_merged=exercise_muscles_merged,
        exercise_image_candidates_updated=exercise_image_candidates_updated,
        released_rows_updated=released_rows_updated,
        deleted_exercise_types=deleted_exercise_types,
    )


def run_dedup(args: argparse.Namespace, *, stream: TextIO) -> RunResult:
    connection = None

    try:
        connection = connect_target_database(args)
        connection.autocommit = False

        plan = build_dedup_plan(
            connection,
            released_name=args.released_name,
            non_released_name=args.non_released_name,
            non_released_owner_id=args.non_released_owner_id,
        )
        should_apply = args.apply and not args.dry_run
        print_report(plan, apply=should_apply, stream=stream)

        if not should_apply:
            connection.rollback()
            return RunResult(plan=plan, applied_changes=None)

        with connection.cursor() as cursor:
            applied_changes = apply_dedup_plan(cursor, plan)
        connection.commit()
        print(
            "Applied changes: "
            f"exercises={applied_changes.exercises_updated}, "
            f"exercise_templates={applied_changes.exercise_templates_updated}, "
            f"exercise_muscles={applied_changes.exercise_muscles_merged}, "
            "exercise_image_candidates="
            f"{applied_changes.exercise_image_candidates_updated}, "
            f"released_rows={applied_changes.released_rows_updated}, "
            f"deleted_exercise_types={applied_changes.deleted_exercise_types}",
            file=stream,
        )
        return RunResult(plan=plan, applied_changes=applied_changes)
    except Exception:
        if connection is not None:
            connection.rollback()
        raise
    finally:
        if connection is not None:
            connection.close()


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    run_dedup(args, stream=sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
