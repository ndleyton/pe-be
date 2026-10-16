"""merge duplicate Triceps muscle, fill missing exercise muscles, lowercase category/equipment

Revision ID: 20261012_0001
Revises: 20261009_0001
Create Date: 2026-10-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261012_0001"
down_revision: Union[str, None] = "20261009_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (exercise type name, muscle name, is_primary)
MISSING_EXERCISE_MUSCLES = [
    ("Bulgarian Split Squats", "quadriceps", True),
    ("Bulgarian Split Squats", "glutes", False),
    ("Bulgarian Split Squats", "hamstrings", False),
    ("Bulgarian Split Squats", "adductors", False),
    ("Walking Lunges", "quadriceps", True),
    ("Walking Lunges", "glutes", False),
    ("Walking Lunges", "hamstrings", False),
    ("Machine Assisted Pull-Up", "lats", True),
    ("Machine Assisted Pull-Up", "biceps", False),
    ("Machine Assisted Pull-Up", "middle back", False),
    ("Leg Curls", "hamstrings", True),
    ("Leg extension curl", "quadriceps", True),
    ("Incline Walk", "calves", True),
    ("Incline Walk", "glutes", False),
    ("Incline Walk", "hamstrings", False),
]


def _merge_triceps(conn: sa.engine.Connection) -> None:
    """Fold the capitalized 'Triceps' muscle into 'triceps'.

    If only 'Triceps' exists (fresh databases), rename it instead.
    """
    stray_id = conn.execute(
        sa.text("SELECT id FROM muscles WHERE name = 'Triceps'")
    ).scalar()
    if stray_id is None:
        return

    canonical_id = conn.execute(
        sa.text("SELECT id FROM muscles WHERE name = 'triceps'")
    ).scalar()
    if canonical_id is None:
        conn.execute(
            sa.text("UPDATE muscles SET name = 'triceps' WHERE id = :stray_id"),
            {"stray_id": stray_id},
        )
        return

    # Carry the primary flag over before dropping conflicting stray rows.
    conn.execute(
        sa.text(
            """
            UPDATE exercise_muscles AS target
            SET is_primary = TRUE
            FROM exercise_muscles AS src
            WHERE src.muscle_id = :stray_id
              AND src.is_primary
              AND target.muscle_id = :canonical_id
              AND target.exercise_type_id = src.exercise_type_id
            """
        ),
        {"stray_id": stray_id, "canonical_id": canonical_id},
    )
    conn.execute(
        sa.text(
            """
            UPDATE exercise_muscles
            SET muscle_id = :canonical_id
            WHERE muscle_id = :stray_id
              AND exercise_type_id NOT IN (
                  SELECT exercise_type_id
                  FROM exercise_muscles
                  WHERE muscle_id = :canonical_id
              )
            """
        ),
        {"stray_id": stray_id, "canonical_id": canonical_id},
    )
    conn.execute(
        sa.text("DELETE FROM exercise_muscles WHERE muscle_id = :stray_id"),
        {"stray_id": stray_id},
    )
    conn.execute(
        sa.text("DELETE FROM muscles WHERE id = :stray_id"),
        {"stray_id": stray_id},
    )


def _fill_missing_exercise_muscles(conn: sa.engine.Connection) -> None:
    # ON CONFLICT keeps re-runs safe and promotes an existing row to primary
    # when the exercise has none. The NOT EXISTS guard
    # keeps a single primary muscle per exercise.
    insert_stmt = sa.text(
        """
        INSERT INTO exercise_muscles
            (exercise_type_id, muscle_id, is_primary, created_at, updated_at)
        SELECT et.id, m.id, :is_primary, now(), now()
        FROM exercise_types AS et
        JOIN muscles AS m ON m.name = :muscle_name
        WHERE et.name = :exercise_name
          AND (
              NOT :is_primary
              OR NOT EXISTS (
                  SELECT 1
                  FROM exercise_muscles AS em
                  WHERE em.exercise_type_id = et.id AND em.is_primary
              )
          )
        ON CONFLICT (exercise_type_id, muscle_id) DO UPDATE
            SET is_primary = TRUE, updated_at = now()
            WHERE EXCLUDED.is_primary AND NOT exercise_muscles.is_primary
        """
    )
    for exercise_name, muscle_name, is_primary in MISSING_EXERCISE_MUSCLES:
        conn.execute(
            insert_stmt,
            {
                "exercise_name": exercise_name,
                "muscle_name": muscle_name,
                "is_primary": is_primary,
            },
        )


def upgrade() -> None:
    connection = op.get_bind()
    tables = sa.inspect(connection).get_table_names()
    missing = {"muscles", "exercise_muscles", "exercise_types"} - set(tables)
    if missing:
        raise RuntimeError(f"Missing required tables: {', '.join(sorted(missing))}")

    _merge_triceps(connection)
    _fill_missing_exercise_muscles(connection)

    op.execute(
        "UPDATE exercise_types SET category = LOWER(category) "
        "WHERE category IS NOT NULL AND category <> LOWER(category)"
    )
    op.execute(
        "UPDATE exercise_types SET equipment = LOWER(equipment) "
        "WHERE equipment IS NOT NULL AND equipment <> LOWER(equipment)"
    )


def downgrade() -> None:
    # The Triceps merge and backfilled muscles are not reversible.
    return
