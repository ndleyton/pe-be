from __future__ import annotations

import argparse
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone

import psycopg2

from src.core.config import settings
from src.exercises.muscle_group_mapping import (
    DEFAULT_MUSCLE_GROUP,
    get_muscle_group_for_muscle,
)


@dataclass(frozen=True)
class MuscleRow:
    id: int
    name: str
    current_group_name: str


@dataclass(frozen=True)
class PlannedUpdate:
    muscle_id: int
    muscle_name: str
    from_group_name: str
    to_group_name: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "One-time repair script for muscles incorrectly assigned to the "
            "'Imported' muscle group."
        )
    )
    parser.add_argument(
        "--database-url",
        help="Full PostgreSQL connection URL. If omitted, connects by database name.",
    )
    parser.add_argument(
        "--database-name",
        default=settings.IMPORT_DATABASE_NAME,
        help=(
            "Database name to connect to when --database-url is not provided. "
            f"Defaults to {settings.IMPORT_DATABASE_NAME!r}."
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


def connect(args: argparse.Namespace):
    if args.database_url:
        return psycopg2.connect(args.database_url)

    kwargs: dict[str, object] = {"dbname": args.database_name}
    for key in ("host", "port", "user", "password"):
        value = getattr(args, key)
        if value is not None:
            kwargs[key] = value
    return psycopg2.connect(**kwargs)


def fetch_group_name_to_id(cursor) -> dict[str, int]:
    cursor.execute("SELECT id, name FROM muscle_groups ORDER BY id")
    return {name: group_id for group_id, name in cursor.fetchall()}


def fetch_muscles(cursor) -> list[MuscleRow]:
    cursor.execute(
        """
        SELECT
            m.id,
            m.name,
            mg.name AS current_group_name
        FROM muscles m
        JOIN muscle_groups mg
            ON mg.id = m.muscle_group_id
        ORDER BY m.id
        """
    )
    return [
        MuscleRow(id=muscle_id, name=name, current_group_name=current_group_name)
        for muscle_id, name, current_group_name in cursor.fetchall()
    ]


def plan_updates(muscles: Iterable[MuscleRow]) -> tuple[list[PlannedUpdate], list[MuscleRow]]:
    updates: list[PlannedUpdate] = []
    unresolved: list[MuscleRow] = []

    for muscle in muscles:
        desired_group_name = get_muscle_group_for_muscle(muscle.name)
        if desired_group_name == DEFAULT_MUSCLE_GROUP:
            unresolved.append(muscle)
            continue

        if muscle.current_group_name == desired_group_name:
            continue

        updates.append(
            PlannedUpdate(
                muscle_id=muscle.id,
                muscle_name=muscle.name,
                from_group_name=muscle.current_group_name,
                to_group_name=desired_group_name,
            )
        )

    return updates, unresolved


def ensure_group_ids(cursor, desired_group_names: set[str], existing_group_ids: dict[str, int]) -> dict[str, int]:
    group_ids = dict(existing_group_ids)
    now = datetime.now(timezone.utc)

    for group_name in sorted(desired_group_names):
        if group_name in group_ids:
            continue

        cursor.execute(
            """
            INSERT INTO muscle_groups (name, created_at, updated_at)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (group_name, now, now),
        )
        group_ids[group_name] = cursor.fetchone()[0]
        print(f"Created muscle group: {group_name} -> id={group_ids[group_name]}")

    return group_ids


def print_report(
    updates: list[PlannedUpdate],
    unresolved: list[MuscleRow],
    missing_group_names: set[str],
    apply: bool,
) -> None:
    mode = "APPLY" if apply else "DRY RUN"
    print(f"{mode}: muscle group relationship repair")
    print(f"Planned updates: {len(updates)}")
    print(f"Unresolved muscles left on {DEFAULT_MUSCLE_GROUP}: {len(unresolved)}")

    if missing_group_names:
        print("Missing muscle groups to create:")
        for group_name in sorted(missing_group_names):
            print(f"  - {group_name}")

    if updates:
        print("Updates:")
        for update in updates:
            print(
                "  - "
                f"{update.muscle_name} (id={update.muscle_id}): "
                f"{update.from_group_name} -> {update.to_group_name}"
            )

    if unresolved:
        print("Unresolved:")
        for muscle in unresolved:
            print(
                "  - "
                f"{muscle.name} (id={muscle.id}) remains {muscle.current_group_name}"
            )

    if not apply:
        print("Dry run only. Re-run with --apply to persist changes.")


def apply_updates(cursor, updates: Iterable[PlannedUpdate], group_name_to_id: dict[str, int]) -> int:
    now = datetime.now(timezone.utc)
    applied = 0

    for update in updates:
        cursor.execute(
            """
            UPDATE muscles
            SET muscle_group_id = %s, updated_at = %s
            WHERE id = %s
            """,
            (group_name_to_id[update.to_group_name], now, update.muscle_id),
        )
        applied += cursor.rowcount

    return applied


def main() -> int:
    args = parse_args()
    connection = connect(args)
    connection.autocommit = False

    try:
        with connection.cursor() as cursor:
            existing_group_ids = fetch_group_name_to_id(cursor)
            muscles = fetch_muscles(cursor)
            updates, unresolved = plan_updates(muscles)
            missing_group_names = {
                update.to_group_name
                for update in updates
                if update.to_group_name not in existing_group_ids
            }

            print_report(updates, unresolved, missing_group_names, apply=args.apply)

            if not args.apply:
                connection.rollback()
                return 0

            group_name_to_id = ensure_group_ids(
                cursor,
                {update.to_group_name for update in updates},
                existing_group_ids,
            )
            applied_count = apply_updates(cursor, updates, group_name_to_id)
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
