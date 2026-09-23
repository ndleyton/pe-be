"""add unique constraint to workout_types.name

Revision ID: 4f1d2c3b4a5e
Revises: 3c4d5e6f7a8b
Create Date: 2026-03-31 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4f1d2c3b4a5e"
down_revision: Union[str, None] = "3c4d5e6f7a8b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_names() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _has_workout_type_name_constraint() -> bool:
    inspector = sa.inspect(op.get_bind())
    constraints = inspector.get_unique_constraints("workout_types")
    return any(
        constraint.get("name") == "uq_workout_types_name"
        or constraint.get("column_names") == ["name"]
        for constraint in constraints
    )


def _merge_duplicate_workout_types(table_names: set[str]) -> None:
    connection = op.get_bind()
    duplicate_groups = connection.execute(
        sa.text(
            """
            SELECT name, MIN(id) AS keep_id, ARRAY_AGG(id ORDER BY id) AS ids
            FROM workout_types
            GROUP BY name
            HAVING COUNT(*) > 1
            """
        )
    ).mappings()

    for group in duplicate_groups:
        keep_id = group["keep_id"]
        duplicate_ids = [
            workout_type_id
            for workout_type_id in group["ids"]
            if workout_type_id != keep_id
        ]

        for duplicate_id in duplicate_ids:
            if "workouts" in table_names:
                connection.execute(
                    sa.text(
                        """
                        UPDATE workouts
                        SET workout_type_id = :keep_id
                        WHERE workout_type_id = :duplicate_id
                        """
                    ),
                    {"keep_id": keep_id, "duplicate_id": duplicate_id},
                )
            if "recipes" in table_names:
                connection.execute(
                    sa.text(
                        """
                        UPDATE recipes
                        SET workout_type_id = :keep_id
                        WHERE workout_type_id = :duplicate_id
                        """
                    ),
                    {"keep_id": keep_id, "duplicate_id": duplicate_id},
                )
            connection.execute(
                sa.text("DELETE FROM workout_types WHERE id = :duplicate_id"),
                {"duplicate_id": duplicate_id},
            )


def upgrade() -> None:
    """Fold duplicate workout types and enforce unique names."""
    table_names = _table_names()
    if "workout_types" not in table_names:
        return

    _merge_duplicate_workout_types(table_names)

    if not _has_workout_type_name_constraint():
        op.create_unique_constraint(
            "uq_workout_types_name",
            "workout_types",
            ["name"],
        )


def downgrade() -> None:
    """Drop the workout type name unique constraint if it exists."""
    if "workout_types" not in _table_names():
        return

    op.execute(
        "ALTER TABLE workout_types DROP CONSTRAINT IF EXISTS uq_workout_types_name"
    )
