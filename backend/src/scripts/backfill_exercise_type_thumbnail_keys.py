from __future__ import annotations

import argparse
from collections.abc import Iterable
from dataclasses import dataclass
from urllib.parse import urlparse

import psycopg2

from src.core.config import settings
from src.exercises.thumbnail_keys import determine_thumbnail_key


@dataclass(frozen=True)
class ExerciseTypeThumbnailRow:
    id: int
    name: str
    category: str | None
    current_thumbnail_key: str | None
    muscle_group_names: list[str]
    primary_muscle_group_names: list[str]


@dataclass(frozen=True)
class PlannedUpdate:
    exercise_type_id: int
    name: str
    from_thumbnail_key: str | None
    to_thumbnail_key: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Backfill exercise_types.thumbnail_key from exercise muscles and "
            "simple cardio heuristics."
        )
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="Full PostgreSQL connection URL. Defaults to DATABASE_URL.",
    )
    parser.add_argument(
        "--database-name",
        default=None,
        help=(
            "Database name to connect to when --database-url is not provided. "
            "Intended for local psql-style access."
        ),
    )
    parser.add_argument("--host", help="Optional PostgreSQL host.")
    parser.add_argument("--port", type=int, help="Optional PostgreSQL port.")
    parser.add_argument("--user", help="Optional PostgreSQL user.")
    parser.add_argument("--password", help="Optional PostgreSQL password.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the planned changes. Without this flag the script only prints a dry run.",
    )
    return parser.parse_args()


def normalize_database_url(database_url: str) -> str:
    parsed = urlparse(database_url)
    if parsed.scheme == "postgresql+asyncpg":
        return database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if parsed.scheme == "postgres+asyncpg":
        return database_url.replace("postgres+asyncpg://", "postgres://", 1)
    return database_url


def connect(args: argparse.Namespace):
    database_url = args.database_url
    if not database_url and not args.database_name:
        database_url = settings.DATABASE_URL

    if database_url:
        return psycopg2.connect(normalize_database_url(database_url))

    if not args.database_name:
        raise ValueError("Either --database-url or --database-name is required.")

    kwargs: dict[str, object] = {"dbname": args.database_name}
    for key in ("host", "port", "user", "password"):
        value = getattr(args, key)
        if value is not None:
            kwargs[key] = value
    return psycopg2.connect(**kwargs)


def fetch_exercise_types(cursor) -> list[ExerciseTypeThumbnailRow]:
    cursor.execute(
        """
        SELECT
            et.id,
            et.name,
            et.category,
            et.thumbnail_key,
            COALESCE(
                array_remove(array_agg(mg.name), NULL),
                ARRAY[]::text[]
            ) AS muscle_group_names,
            COALESCE(
                array_remove(
                    array_agg(
                        CASE
                            WHEN em.is_primary THEN mg.name
                            ELSE NULL
                        END
                    ),
                    NULL
                ),
                ARRAY[]::text[]
            ) AS primary_muscle_group_names
        FROM exercise_types et
        LEFT JOIN exercise_muscles em
            ON em.exercise_type_id = et.id
        LEFT JOIN muscles m
            ON m.id = em.muscle_id
        LEFT JOIN muscle_groups mg
            ON mg.id = m.muscle_group_id
        GROUP BY et.id, et.name, et.category, et.thumbnail_key
        ORDER BY et.id
        """
    )
    return [
        ExerciseTypeThumbnailRow(
            id=exercise_type_id,
            name=name,
            category=category,
            current_thumbnail_key=current_thumbnail_key,
            muscle_group_names=muscle_group_names or [],
            primary_muscle_group_names=primary_muscle_group_names or [],
        )
        for (
            exercise_type_id,
            name,
            category,
            current_thumbnail_key,
            muscle_group_names,
            primary_muscle_group_names,
        ) in cursor.fetchall()
    ]


def plan_updates(
    exercise_types: Iterable[ExerciseTypeThumbnailRow],
) -> list[PlannedUpdate]:
    updates: list[PlannedUpdate] = []

    for exercise_type in exercise_types:
        desired_thumbnail_key = determine_thumbnail_key(
            exercise_name=exercise_type.name,
            category=exercise_type.category,
            muscle_group_names=exercise_type.muscle_group_names,
            primary_muscle_group_names=exercise_type.primary_muscle_group_names,
        )
        if desired_thumbnail_key == exercise_type.current_thumbnail_key:
            continue

        updates.append(
            PlannedUpdate(
                exercise_type_id=exercise_type.id,
                name=exercise_type.name,
                from_thumbnail_key=exercise_type.current_thumbnail_key,
                to_thumbnail_key=desired_thumbnail_key,
            )
        )

    return updates


def print_report(
    exercise_types: list[ExerciseTypeThumbnailRow],
    updates: list[PlannedUpdate],
    *,
    apply: bool,
) -> None:
    mode = "APPLY" if apply else "DRY RUN"
    print(f"{mode}: exercise type thumbnail key backfill")
    print(f"Exercise types scanned: {len(exercise_types)}")
    print(f"Planned updates: {len(updates)}")

    if updates:
        print("Updates:")
        for update in updates[:50]:
            print(
                "  - "
                f"{update.name} (id={update.exercise_type_id}): "
                f"{update.from_thumbnail_key or '<null>'} -> {update.to_thumbnail_key}"
            )
        if len(updates) > 50:
            print(f"  ... {len(updates) - 50} more")

    if not apply:
        print("Dry run only. Re-run with --apply to persist changes.")


def apply_updates(cursor, updates: Iterable[PlannedUpdate]) -> int:
    applied = 0

    for update in updates:
        cursor.execute(
            """
            UPDATE exercise_types
            SET thumbnail_key = %s
            WHERE id = %s
            """,
            (update.to_thumbnail_key, update.exercise_type_id),
        )
        applied += cursor.rowcount

    return applied


def main() -> int:
    args = parse_args()
    connection = connect(args)
    connection.autocommit = False

    try:
        with connection.cursor() as cursor:
            exercise_types = fetch_exercise_types(cursor)
            updates = plan_updates(exercise_types)
            print_report(exercise_types, updates, apply=args.apply)

            if not args.apply:
                connection.rollback()
                return 0

            applied_count = apply_updates(cursor, updates)
            connection.commit()
            print(f"Applied updates: {applied_count}")
            return 0
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
