from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TextIO
from urllib.parse import urlparse
import re

import psycopg2
from psycopg2.extras import RealDictCursor

from src.core.config import settings


LEGACY_LEVELS = {"beginner", "intermediate", "expert"}
LEGACY_FORCES = {"push", "pull", "static"}
LEGACY_MECHANICS = {"compound", "isolation"}
LABEL_TO_FIELD = {
    "instructions": "instructions",
    "equipment": "equipment",
    "category": "category",
    "force": "force",
    "level": "level",
    "mechanic": "mechanic",
}
LABEL_PATTERN = re.compile(
    r"^\s*(instructions|equipment|category|force|level|mechanic)\s*:\s*(.*)$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ExerciseTypeRow:
    id: int
    name: str
    external_id: str | None
    description: str | None
    instructions: str | None
    equipment: str | None
    category: str | None


@dataclass(frozen=True)
class SourceExerciseRow:
    id: str
    name: str
    force: str | None
    level: str | None
    mechanic: str | None
    instructions: str | None
    equipment: str | None
    category: str | None
    primary_muscles: list[str] | None


@dataclass(frozen=True)
class ParsedDescriptionMetadata:
    summary: str | None
    instructions: str | None
    equipment: str | None
    category: str | None
    force: str | None
    level: str | None
    mechanic: str | None
    has_labeled_sections: bool


@dataclass(frozen=True)
class FieldChange:
    field_name: str
    current_value: str | None
    new_value: str | None


@dataclass(frozen=True)
class PlannedExerciseTypeUpdate:
    exercise_type_id: int
    exercise_name: str
    external_id: str | None
    matched_source: bool
    reasons: tuple[str, ...]
    changes: tuple[FieldChange, ...]


@dataclass(frozen=True)
class UnresolvedExerciseType:
    exercise_type_id: int
    exercise_name: str
    external_id: str | None
    reason: str


@dataclass(frozen=True)
class RowPlanningOutcome:
    update: PlannedExerciseTypeUpdate | None
    unresolved_reason: str | None
    matched_source: bool


@dataclass(frozen=True)
class PlanningReport:
    scanned_rows: int
    matched_source_rows: int
    skipped_rows: int
    updates: tuple[PlannedExerciseTypeUpdate, ...]
    unresolved: tuple[UnresolvedExerciseType, ...]


@dataclass(frozen=True)
class RunResult:
    report: PlanningReport
    applied_rows: int


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Normalize legacy exercise type metadata into structured fields. "
            "Defaults to dry-run mode."
        )
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="Full PostgreSQL connection URL for the target app database.",
    )
    parser.add_argument(
        "--source-database-name",
        default=settings.IMPORT_DATABASE_NAME,
        help="Source database name for ext.exercises lookups.",
    )
    parser.add_argument(
        "--source-host",
        default=settings.IMPORT_DATABASE_HOST,
        help="Source database host.",
    )
    parser.add_argument(
        "--source-port",
        type=int,
        default=settings.IMPORT_DATABASE_PORT,
        help="Source database port.",
    )
    parser.add_argument(
        "--source-user",
        default=settings.IMPORT_DATABASE_USER,
        help="Source database user.",
    )
    parser.add_argument(
        "--source-password",
        default=settings.IMPORT_DATABASE_PASSWORD,
        help="Source database password.",
    )
    parser.add_argument(
        "--exercise-type-id",
        type=int,
        default=None,
        help="Limit processing to a single exercise_types row id.",
    )
    parser.add_argument(
        "--external-id",
        default=None,
        help="Limit processing to a single source-backed external_id.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit the number of candidate target rows evaluated.",
    )
    parser.add_argument(
        "--overwrite-populated-fields",
        action="store_true",
        help="Allow replacing non-empty instructions, equipment, or category values.",
    )
    parser.add_argument(
        "--rewrite-description-from-source",
        action="store_true",
        help="Rewrite source-backed descriptions even when they do not look legacy-generated.",
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


def connect_source_database(args: argparse.Namespace):
    return psycopg2.connect(
        dbname=args.source_database_name,
        host=args.source_host,
        port=args.source_port,
        user=args.source_user,
        password=args.source_password,
    )


def normalize_single_line_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return " ".join(text.split())


def normalize_description_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text


def normalize_muscle_array(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, (list, tuple)):
        for item in value:
            normalized = normalize_single_line_text(item)
            if normalized:
                return normalized.lower()
        return None
    normalized = normalize_single_line_text(value)
    return normalized.lower() if normalized else None


def normalize_multiline_text(value: object) -> str | None:
    if value is None:
        return None

    if isinstance(value, (list, tuple)):
        raw_lines = [str(item) for item in value]
    else:
        raw_lines = str(value).splitlines()

    stripped_lines = [line.strip() for line in raw_lines]
    while stripped_lines and stripped_lines[0] == "":
        stripped_lines.pop(0)
    while stripped_lines and stripped_lines[-1] == "":
        stripped_lines.pop()

    if not stripped_lines:
        return None
    return "\n".join(stripped_lines)


def normalize_external_id(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def legacy_description_from_metadata(
    force: str | None, level: str | None, mechanic: str | None
) -> str | None:
    parts = [
        normalize_single_line_text(force),
        normalize_single_line_text(level),
        normalize_single_line_text(mechanic),
    ]
    filtered_parts = [part for part in parts if part]
    if not filtered_parts:
        return None
    return "\n".join(filtered_parts)


def looks_like_legacy_importer_description(
    description: str | None,
    *,
    source_row: SourceExerciseRow | None = None,
) -> bool:
    normalized_description = normalize_description_text(description)
    if normalized_description is None:
        return False

    if source_row is not None:
        expected = legacy_description_from_metadata(
            source_row.force,
            source_row.level,
            source_row.mechanic,
        )
        return expected is not None and normalized_description == expected

    lines = [
        line.strip().lower()
        for line in normalized_description.splitlines()
        if line.strip()
    ]
    if not 1 <= len(lines) <= 3:
        return False
    if any(":" in line for line in lines):
        return False

    known_values = LEGACY_LEVELS | LEGACY_FORCES | LEGACY_MECHANICS
    return all(line in known_values for line in lines) and any(
        line in LEGACY_LEVELS or line in LEGACY_MECHANICS for line in lines
    )


def build_description_summary(
    *,
    level: str | None,
    mechanic: str | None,
    category: str | None,
    force: str | None,
    primary_muscle: str | None = None,
) -> str | None:
    level_text = normalize_single_line_text(level)
    mechanic_text = normalize_single_line_text(mechanic)
    category_text = normalize_single_line_text(category)
    force_text = normalize_single_line_text(force)
    muscle_text = normalize_single_line_text(primary_muscle)

    parts: list[str] = []
    if level_text:
        parts.append(level_text.capitalize())
    if mechanic_text:
        parts.append(mechanic_text.lower())
    if muscle_text:
        parts.append(muscle_text.lower())
    if category_text:
        parts.append(category_text.lower())
    elif force_text and not parts:
        parts.append(force_text.lower())

    if not parts:
        return None
    return f"{' '.join(parts)} exercise."


def build_description_summary_from_source(
    source_row: SourceExerciseRow,
) -> str | None:
    return build_description_summary(
        level=source_row.level,
        mechanic=source_row.mechanic,
        category=source_row.category,
        force=source_row.force,
        primary_muscle=normalize_muscle_array(source_row.primary_muscles),
    )


def parse_labeled_description_sections(
    description: str | None,
) -> ParsedDescriptionMetadata:
    normalized_description = normalize_description_text(description)
    if normalized_description is None:
        return ParsedDescriptionMetadata(
            summary=None,
            instructions=None,
            equipment=None,
            category=None,
            force=None,
            level=None,
            mechanic=None,
            has_labeled_sections=False,
        )

    summary_lines: list[str] = []
    instructions_lines: list[str] = []
    values: dict[str, list[str]] = {
        "equipment": [],
        "category": [],
        "force": [],
        "level": [],
        "mechanic": [],
    }
    current_label: str | None = None
    has_labeled_sections = False

    for raw_line in normalized_description.splitlines():
        match = LABEL_PATTERN.match(raw_line)
        if match:
            has_labeled_sections = True
            current_label = LABEL_TO_FIELD[match.group(1).lower()]
            remainder = match.group(2).strip()
            if current_label == "instructions":
                if remainder:
                    instructions_lines.append(remainder)
                continue
            values[current_label] = [remainder] if remainder else []
            continue

        stripped_line = raw_line.strip()
        if current_label == "instructions":
            instructions_lines.append(stripped_line)
            continue

        current_label = None
        summary_lines.append(stripped_line)

    summary = normalize_single_line_text(
        " ".join(line for line in summary_lines if line)
    )
    return ParsedDescriptionMetadata(
        summary=summary,
        instructions=normalize_multiline_text(instructions_lines),
        equipment=normalize_single_line_text(" ".join(values["equipment"])),
        category=normalize_single_line_text(" ".join(values["category"])),
        force=normalize_single_line_text(" ".join(values["force"])),
        level=normalize_single_line_text(" ".join(values["level"])),
        mechanic=normalize_single_line_text(" ".join(values["mechanic"])),
        has_labeled_sections=has_labeled_sections,
    )


def has_missing_structured_fields(row: ExerciseTypeRow) -> bool:
    return any(
        value is None
        for value in (
            normalize_multiline_text(row.instructions),
            normalize_single_line_text(row.equipment),
            normalize_single_line_text(row.category),
        )
    )


def is_candidate_row(row: ExerciseTypeRow) -> bool:
    description = normalize_description_text(row.description)
    return (
        row.external_id is not None
        or has_missing_structured_fields(row)
        or parse_labeled_description_sections(description).has_labeled_sections
        or looks_like_legacy_importer_description(description)
    )


def build_target_row(record: dict[str, object]) -> ExerciseTypeRow:
    return ExerciseTypeRow(
        id=int(record["id"]),
        name=str(record["name"]),
        external_id=normalize_external_id(record.get("external_id")),
        description=record.get("description"),
        instructions=record.get("instructions"),
        equipment=record.get("equipment"),
        category=record.get("category"),
    )


def build_source_row(record: dict[str, object]) -> SourceExerciseRow:
    return SourceExerciseRow(
        id=str(record["id"]),
        name=str(record["name"]),
        force=normalize_single_line_text(record.get("force")),
        level=normalize_single_line_text(record.get("level")),
        mechanic=normalize_single_line_text(record.get("mechanic")),
        instructions=normalize_multiline_text(record.get("instructions")),
        equipment=normalize_single_line_text(record.get("equipment")),
        category=normalize_single_line_text(record.get("category")),
        primary_muscles=record.get("primary_muscles"),
    )


def load_target_rows(
    connection,
    *,
    exercise_type_id: int | None,
    external_id: str | None,
) -> list[ExerciseTypeRow]:
    query = """
        SELECT id, name, external_id, description, instructions, equipment, category
        FROM exercise_types
    """
    clauses: list[str] = []
    params: list[object] = []

    if exercise_type_id is not None:
        clauses.append("id = %s")
        params.append(exercise_type_id)
    if external_id is not None:
        clauses.append("external_id = %s")
        params.append(external_id)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY id"

    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(query, params)
        return [build_target_row(record) for record in cursor.fetchall()]


def load_source_lookup(
    connection,
    external_ids: list[str],
) -> dict[str, SourceExerciseRow]:
    numeric_external_ids = [
        int(external_id)
        for external_id in external_ids
        if re.fullmatch(r"\d+", external_id)
    ]
    if not numeric_external_ids:
        return {}

    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            SELECT id, name, force, level, mechanic, instructions, equipment, category, primary_muscles
            FROM ext.exercises
            WHERE id = ANY(%s)
            """,
            (numeric_external_ids,),
        )
        return {
            str(record["id"]): build_source_row(record) for record in cursor.fetchall()
        }


def choose_structured_value(
    current_value: str | None,
    candidate_value: str | None,
    *,
    overwrite: bool,
    normalizer,
) -> str | None:
    normalized_current = normalizer(current_value)
    normalized_candidate = normalizer(candidate_value)
    if normalized_candidate is not None and (overwrite or normalized_current is None):
        return normalized_candidate
    return normalized_current


def build_field_changes(
    row: ExerciseTypeRow,
    *,
    description: str | None,
    instructions: str | None,
    equipment: str | None,
    category: str | None,
) -> tuple[FieldChange, ...]:
    desired_values = {
        "description": normalize_description_text(description),
        "instructions": normalize_multiline_text(instructions),
        "equipment": normalize_single_line_text(equipment),
        "category": normalize_single_line_text(category),
    }
    current_values = {
        "description": row.description,
        "instructions": row.instructions,
        "equipment": row.equipment,
        "category": row.category,
    }

    changes: list[FieldChange] = []
    for field_name, desired_value in desired_values.items():
        if current_values[field_name] != desired_value:
            changes.append(
                FieldChange(
                    field_name=field_name,
                    current_value=current_values[field_name],
                    new_value=desired_value,
                )
            )
    return tuple(changes)


def plan_row_update(
    row: ExerciseTypeRow,
    *,
    source_row: SourceExerciseRow | None,
    overwrite_populated_fields: bool,
    rewrite_description_from_source: bool,
) -> RowPlanningOutcome:
    parsed_description = parse_labeled_description_sections(row.description)
    current_description = normalize_description_text(row.description)
    current_instructions = normalize_multiline_text(row.instructions)
    current_equipment = normalize_single_line_text(row.equipment)
    current_category = normalize_single_line_text(row.category)

    matched_source = source_row is not None
    reasons: list[str] = []

    source_instructions = source_row.instructions if source_row else None
    source_equipment = source_row.equipment if source_row else None
    source_category = source_row.category if source_row else None

    desired_instructions = choose_structured_value(
        current_instructions,
        source_instructions or parsed_description.instructions,
        overwrite=overwrite_populated_fields,
        normalizer=normalize_multiline_text,
    )
    if desired_instructions != current_instructions:
        reasons.append("backfill_instructions")

    desired_equipment = choose_structured_value(
        current_equipment,
        source_equipment or parsed_description.equipment,
        overwrite=overwrite_populated_fields,
        normalizer=normalize_single_line_text,
    )
    if desired_equipment != current_equipment:
        reasons.append("backfill_equipment")

    desired_category = choose_structured_value(
        current_category,
        source_category or parsed_description.category,
        overwrite=overwrite_populated_fields,
        normalizer=normalize_single_line_text,
    )
    if desired_category != current_category:
        reasons.append("backfill_category")

    description_has_embedded_metadata = parsed_description.has_labeled_sections
    description_is_legacy = looks_like_legacy_importer_description(
        current_description,
        source_row=source_row,
    )
    description_is_blank = current_description is None

    desired_description = current_description
    rewrite_reason: str | None = None

    if rewrite_description_from_source and source_row is not None:
        candidate_description = build_description_summary_from_source(source_row)
        if candidate_description is not None:
            desired_description = candidate_description
            rewrite_reason = "rewrite_description_from_source"

    if rewrite_reason is None and (
        description_is_blank
        or description_is_legacy
        or description_has_embedded_metadata
    ):
        candidate_description = (
            parsed_description.summary if description_has_embedded_metadata else None
        )
        if candidate_description is None and source_row is not None:
            candidate_description = build_description_summary_from_source(source_row)
        if candidate_description is None and description_has_embedded_metadata:
            candidate_description = build_description_summary(
                level=parsed_description.level,
                mechanic=parsed_description.mechanic,
                category=parsed_description.category,
                force=parsed_description.force,
            )
        if (
            candidate_description is not None
            and candidate_description != current_description
        ):
            desired_description = candidate_description
            if description_is_blank:
                rewrite_reason = "fill_blank_description"
            elif description_is_legacy:
                rewrite_reason = "rewrite_legacy_description"
            else:
                rewrite_reason = "remove_embedded_metadata"

    if rewrite_reason is not None:
        reasons.append(rewrite_reason)

    changes = build_field_changes(
        row,
        description=desired_description,
        instructions=desired_instructions,
        equipment=desired_equipment,
        category=desired_category,
    )

    still_missing_fields = [
        field_name
        for field_name, value in (
            ("instructions", normalize_multiline_text(desired_instructions)),
            ("equipment", normalize_single_line_text(desired_equipment)),
            ("category", normalize_single_line_text(desired_category)),
        )
        if value is None
    ]
    needs_description_cleanup = (
        description_is_blank
        or description_is_legacy
        or description_has_embedded_metadata
    ) and normalize_description_text(desired_description) is None

    unresolved_reasons: list[str] = []
    if row.external_id and source_row is None:
        unresolved_reasons.append("missing source row for external_id")
    if still_missing_fields and (
        matched_source or parsed_description.has_labeled_sections
    ):
        unresolved_reasons.append(
            "missing structured values after normalization: "
            + ", ".join(still_missing_fields)
        )
    elif still_missing_fields and not changes and has_missing_structured_fields(row):
        unresolved_reasons.append(
            "no safe source or labeled metadata for: " + ", ".join(still_missing_fields)
        )
    if needs_description_cleanup:
        unresolved_reasons.append("could not derive a safe replacement description")

    unresolved_reason = "; ".join(unresolved_reasons) if unresolved_reasons else None

    if not changes:
        return RowPlanningOutcome(
            update=None,
            unresolved_reason=unresolved_reason,
            matched_source=matched_source,
        )

    return RowPlanningOutcome(
        update=PlannedExerciseTypeUpdate(
            exercise_type_id=row.id,
            exercise_name=row.name,
            external_id=row.external_id,
            matched_source=matched_source,
            reasons=tuple(dict.fromkeys(reasons)),
            changes=changes,
        ),
        unresolved_reason=unresolved_reason,
        matched_source=matched_source,
    )


def plan_updates(
    rows: list[ExerciseTypeRow],
    *,
    source_lookup: dict[str, SourceExerciseRow],
    overwrite_populated_fields: bool,
    rewrite_description_from_source: bool,
) -> PlanningReport:
    updates: list[PlannedExerciseTypeUpdate] = []
    unresolved: list[UnresolvedExerciseType] = []
    matched_source_rows = 0
    skipped_rows = 0

    for row in rows:
        source_row = (
            source_lookup.get(row.external_id) if row.external_id is not None else None
        )
        outcome = plan_row_update(
            row,
            source_row=source_row,
            overwrite_populated_fields=overwrite_populated_fields,
            rewrite_description_from_source=rewrite_description_from_source,
        )
        if outcome.matched_source:
            matched_source_rows += 1

        if outcome.update is not None:
            updates.append(outcome.update)
        else:
            skipped_rows += 1

        if outcome.unresolved_reason is not None:
            unresolved.append(
                UnresolvedExerciseType(
                    exercise_type_id=row.id,
                    exercise_name=row.name,
                    external_id=row.external_id,
                    reason=outcome.unresolved_reason,
                )
            )

    return PlanningReport(
        scanned_rows=len(rows),
        matched_source_rows=matched_source_rows,
        skipped_rows=skipped_rows,
        updates=tuple(updates),
        unresolved=tuple(unresolved),
    )


def format_value(value: str | None, *, max_length: int = 120) -> str:
    if value is None:
        return "NULL"
    rendered = value.replace("\n", "\\n")
    if len(rendered) > max_length:
        rendered = rendered[: max_length - 3] + "..."
    return repr(rendered)


def print_report(
    report: PlanningReport,
    *,
    apply: bool,
    stream: TextIO,
    sample_limit: int = 20,
) -> None:
    mode = "APPLY" if apply else "DRY RUN"
    print(f"{mode}: normalize exercise type metadata", file=stream)
    print(f"Scanned candidate rows: {report.scanned_rows}", file=stream)
    print(f"Matched source rows: {report.matched_source_rows}", file=stream)
    print(f"Rows to update: {len(report.updates)}", file=stream)
    print(f"Skipped rows: {report.skipped_rows}", file=stream)
    print(f"Unresolved rows: {len(report.unresolved)}", file=stream)

    if report.updates:
        print("Sample planned diffs:", file=stream)
        for update in report.updates[:sample_limit]:
            source_note = "source-backed" if update.matched_source else "fallback-parse"
            print(
                "  - "
                f"{update.exercise_name} (id={update.exercise_type_id}, "
                f"external_id={update.external_id or 'NULL'}, {source_note}) "
                f"[{', '.join(update.reasons)}]",
                file=stream,
            )
            for change in update.changes:
                print(
                    "      "
                    f"{change.field_name}: {format_value(change.current_value)} -> "
                    f"{format_value(change.new_value)}",
                    file=stream,
                )
        remaining = len(report.updates) - sample_limit
        if remaining > 0:
            print(f"  ... {remaining} more planned updates", file=stream)

    if report.unresolved:
        print("Unresolved rows:", file=stream)
        for row in report.unresolved[:sample_limit]:
            print(
                "  - "
                f"{row.exercise_name} (id={row.exercise_type_id}, "
                f"external_id={row.external_id or 'NULL'}): {row.reason}",
                file=stream,
            )
        remaining = len(report.unresolved) - sample_limit
        if remaining > 0:
            print(f"  ... {remaining} more unresolved rows", file=stream)

    if not apply:
        print("Dry run only. Re-run with --apply to persist changes.", file=stream)


def apply_planned_updates(
    connection, updates: tuple[PlannedExerciseTypeUpdate, ...]
) -> int:
    if not updates:
        return 0

    applied_rows = 0
    with connection.cursor() as cursor:
        for update in updates:
            field_names = [change.field_name for change in update.changes]
            set_clauses = [f"{field_name} = %s" for field_name in field_names]
            set_clauses.append("updated_at = %s")
            params = [change.new_value for change in update.changes]
            params.append(datetime.now(timezone.utc))
            params.append(update.exercise_type_id)

            cursor.execute(
                f"""
                UPDATE exercise_types
                SET {", ".join(set_clauses)}
                WHERE id = %s
                """,
                params,
            )
            applied_rows += cursor.rowcount

    return applied_rows


def select_candidate_rows(
    rows: list[ExerciseTypeRow],
    *,
    exercise_type_id: int | None,
    external_id: str | None,
    limit: int | None,
) -> list[ExerciseTypeRow]:
    if exercise_type_id is not None or external_id is not None:
        selected_rows = rows
    else:
        selected_rows = [row for row in rows if is_candidate_row(row)]

    if limit is not None:
        return selected_rows[:limit]
    return selected_rows


def run_normalization(args: argparse.Namespace, *, stream: TextIO) -> RunResult:
    target_connection = None
    source_connection = None

    try:
        target_connection = connect_target_database(args)
        target_connection.autocommit = False
        source_connection = connect_source_database(args)
        loaded_rows = load_target_rows(
            target_connection,
            exercise_type_id=args.exercise_type_id,
            external_id=args.external_id,
        )
        candidate_rows = select_candidate_rows(
            loaded_rows,
            exercise_type_id=args.exercise_type_id,
            external_id=args.external_id,
            limit=args.limit,
        )
        source_lookup = load_source_lookup(
            source_connection,
            [row.external_id for row in candidate_rows if row.external_id is not None],
        )
        report = plan_updates(
            candidate_rows,
            source_lookup=source_lookup,
            overwrite_populated_fields=args.overwrite_populated_fields,
            rewrite_description_from_source=args.rewrite_description_from_source,
        )
        print_report(report, apply=args.apply and not args.dry_run, stream=stream)

        if args.apply and not args.dry_run:
            applied_rows = apply_planned_updates(target_connection, report.updates)
            target_connection.commit()
            print(f"Applied rows: {applied_rows}", file=stream)
            return RunResult(report=report, applied_rows=applied_rows)

        target_connection.rollback()
        return RunResult(report=report, applied_rows=0)
    except Exception:
        if target_connection is not None:
            target_connection.rollback()
        raise
    finally:
        if source_connection is not None:
            source_connection.close()
        if target_connection is not None:
            target_connection.close()


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    run_normalization(args, stream=sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
