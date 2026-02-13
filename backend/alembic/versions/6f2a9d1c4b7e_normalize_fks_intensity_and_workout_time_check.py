"""normalize fks, numeric template intensity, and workout time check

Revision ID: 6f2a9d1c4b7e
Revises: b9a1c2d3e4f5
Create Date: 2026-02-12 01:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6f2a9d1c4b7e"
down_revision: Union[str, None] = "b9a1c2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _drop_fk_if_exists(table_name: str, column_name: str, referred_table: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for fk in inspector.get_foreign_keys(table_name):
        if (
            fk.get("name")
            and fk.get("constrained_columns") == [column_name]
            and fk.get("referred_table") == referred_table
        ):
            op.drop_constraint(fk["name"], table_name=table_name, type_="foreignkey")
            return


def upgrade() -> None:
    """Upgrade schema."""
    # Ensure existing data is valid before adding constraints.
    op.execute(
        """
        UPDATE exercise_types
        SET default_intensity_unit = NULL
        WHERE default_intensity_unit IS NOT NULL
          AND default_intensity_unit NOT IN (SELECT id FROM intensity_units)
        """
    )
    op.execute(
        """
        UPDATE workouts
        SET end_time = start_time
        WHERE end_time IS NOT NULL
          AND start_time IS NOT NULL
          AND end_time < start_time
        """
    )

    # Unify set template intensity precision with exercise_sets.
    op.alter_column(
        "set_templates",
        "intensity",
        existing_type=sa.Float(),
        type_=sa.Numeric(precision=7, scale=3),
        existing_nullable=True,
        postgresql_using="intensity::numeric(7,3)",
    )

    # Replace FK constraints with explicit ondelete behavior.
    _drop_fk_if_exists("exercise_types", "default_intensity_unit", "intensity_units")
    op.create_foreign_key(
        "fk_exercise_types_default_intensity_unit_intensity_units",
        "exercise_types",
        "intensity_units",
        ["default_intensity_unit"],
        ["id"],
        ondelete="SET NULL",
    )

    _drop_fk_if_exists("workouts", "workout_type_id", "workout_types")
    _drop_fk_if_exists("workouts", "owner_id", "users")
    op.create_foreign_key(
        "fk_workouts_workout_type_id_workout_types",
        "workouts",
        "workout_types",
        ["workout_type_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_workouts_owner_id_users",
        "workouts",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="CASCADE",
    )

    _drop_fk_if_exists("recipes", "workout_type_id", "workout_types")
    _drop_fk_if_exists("recipes", "creator_id", "users")
    op.create_foreign_key(
        "fk_recipes_workout_type_id_workout_types",
        "recipes",
        "workout_types",
        ["workout_type_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_recipes_creator_id_users",
        "recipes",
        "users",
        ["creator_id"],
        ["id"],
        ondelete="CASCADE",
    )

    _drop_fk_if_exists("exercises", "exercise_type_id", "exercise_types")
    _drop_fk_if_exists("exercises", "workout_id", "workouts")
    op.create_foreign_key(
        "fk_exercises_exercise_type_id_exercise_types",
        "exercises",
        "exercise_types",
        ["exercise_type_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_exercises_workout_id_workouts",
        "exercises",
        "workouts",
        ["workout_id"],
        ["id"],
        ondelete="CASCADE",
    )

    _drop_fk_if_exists("exercise_sets", "intensity_unit_id", "intensity_units")
    _drop_fk_if_exists("exercise_sets", "exercise_id", "exercises")
    op.create_foreign_key(
        "fk_exercise_sets_intensity_unit_id_intensity_units",
        "exercise_sets",
        "intensity_units",
        ["intensity_unit_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_exercise_sets_exercise_id_exercises",
        "exercise_sets",
        "exercises",
        ["exercise_id"],
        ["id"],
        ondelete="CASCADE",
    )

    _drop_fk_if_exists("muscles", "muscle_group_id", "muscle_groups")
    op.create_foreign_key(
        "fk_muscles_muscle_group_id_muscle_groups",
        "muscles",
        "muscle_groups",
        ["muscle_group_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    _drop_fk_if_exists("exercise_muscles", "exercise_type_id", "exercise_types")
    _drop_fk_if_exists("exercise_muscles", "muscle_id", "muscles")
    op.create_foreign_key(
        "fk_exercise_muscles_exercise_type_id_exercise_types",
        "exercise_muscles",
        "exercise_types",
        ["exercise_type_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_exercise_muscles_muscle_id_muscles",
        "exercise_muscles",
        "muscles",
        ["muscle_id"],
        ["id"],
        ondelete="CASCADE",
    )

    _drop_fk_if_exists("exercise_templates", "exercise_type_id", "exercise_types")
    _drop_fk_if_exists("exercise_templates", "recipe_id", "recipes")
    op.create_foreign_key(
        "fk_exercise_templates_exercise_type_id_exercise_types",
        "exercise_templates",
        "exercise_types",
        ["exercise_type_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_exercise_templates_recipe_id_recipes",
        "exercise_templates",
        "recipes",
        ["recipe_id"],
        ["id"],
        ondelete="CASCADE",
    )

    _drop_fk_if_exists("set_templates", "intensity_unit_id", "intensity_units")
    _drop_fk_if_exists("set_templates", "exercise_template_id", "exercise_templates")
    op.create_foreign_key(
        "fk_set_templates_intensity_unit_id_intensity_units",
        "set_templates",
        "intensity_units",
        ["intensity_unit_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_set_templates_exercise_template_id_exercise_templates",
        "set_templates",
        "exercise_templates",
        ["exercise_template_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_check_constraint(
        "ck_workouts_end_time_gte_start_time",
        "workouts",
        "end_time IS NULL OR start_time IS NULL OR end_time >= start_time",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "ck_workouts_end_time_gte_start_time",
        "workouts",
        type_="check",
    )

    op.drop_constraint(
        "fk_set_templates_exercise_template_id_exercise_templates",
        "set_templates",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_set_templates_intensity_unit_id_intensity_units",
        "set_templates",
        type_="foreignkey",
    )
    op.create_foreign_key(
        None,
        "set_templates",
        "intensity_units",
        ["intensity_unit_id"],
        ["id"],
    )
    op.create_foreign_key(
        None,
        "set_templates",
        "exercise_templates",
        ["exercise_template_id"],
        ["id"],
    )

    op.drop_constraint(
        "fk_exercise_templates_recipe_id_recipes",
        "exercise_templates",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_exercise_templates_exercise_type_id_exercise_types",
        "exercise_templates",
        type_="foreignkey",
    )
    op.create_foreign_key(
        None,
        "exercise_templates",
        "exercise_types",
        ["exercise_type_id"],
        ["id"],
    )
    op.create_foreign_key(
        None,
        "exercise_templates",
        "recipes",
        ["recipe_id"],
        ["id"],
    )

    op.drop_constraint(
        "fk_exercise_muscles_muscle_id_muscles",
        "exercise_muscles",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_exercise_muscles_exercise_type_id_exercise_types",
        "exercise_muscles",
        type_="foreignkey",
    )
    op.create_foreign_key(
        None,
        "exercise_muscles",
        "exercise_types",
        ["exercise_type_id"],
        ["id"],
    )
    op.create_foreign_key(
        None,
        "exercise_muscles",
        "muscles",
        ["muscle_id"],
        ["id"],
    )

    op.drop_constraint(
        "fk_muscles_muscle_group_id_muscle_groups",
        "muscles",
        type_="foreignkey",
    )
    op.create_foreign_key(
        None,
        "muscles",
        "muscle_groups",
        ["muscle_group_id"],
        ["id"],
    )

    op.drop_constraint(
        "fk_exercise_sets_exercise_id_exercises",
        "exercise_sets",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_exercise_sets_intensity_unit_id_intensity_units",
        "exercise_sets",
        type_="foreignkey",
    )
    op.create_foreign_key(
        None,
        "exercise_sets",
        "intensity_units",
        ["intensity_unit_id"],
        ["id"],
    )
    op.create_foreign_key(
        None,
        "exercise_sets",
        "exercises",
        ["exercise_id"],
        ["id"],
    )

    op.drop_constraint(
        "fk_exercises_workout_id_workouts",
        "exercises",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_exercises_exercise_type_id_exercise_types",
        "exercises",
        type_="foreignkey",
    )
    op.create_foreign_key(
        None,
        "exercises",
        "exercise_types",
        ["exercise_type_id"],
        ["id"],
    )
    op.create_foreign_key(
        None,
        "exercises",
        "workouts",
        ["workout_id"],
        ["id"],
    )

    op.drop_constraint(
        "fk_recipes_creator_id_users",
        "recipes",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_recipes_workout_type_id_workout_types",
        "recipes",
        type_="foreignkey",
    )
    op.create_foreign_key(
        None,
        "recipes",
        "users",
        ["creator_id"],
        ["id"],
    )
    op.create_foreign_key(
        None,
        "recipes",
        "workout_types",
        ["workout_type_id"],
        ["id"],
    )

    op.drop_constraint(
        "fk_workouts_owner_id_users",
        "workouts",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_workouts_workout_type_id_workout_types",
        "workouts",
        type_="foreignkey",
    )
    op.create_foreign_key(
        None,
        "workouts",
        "users",
        ["owner_id"],
        ["id"],
    )
    op.create_foreign_key(
        None,
        "workouts",
        "workout_types",
        ["workout_type_id"],
        ["id"],
    )

    op.drop_constraint(
        "fk_exercise_types_default_intensity_unit_intensity_units",
        "exercise_types",
        type_="foreignkey",
    )

    op.alter_column(
        "set_templates",
        "intensity",
        existing_type=sa.Numeric(precision=7, scale=3),
        type_=sa.Float(),
        existing_nullable=True,
        postgresql_using="intensity::double precision",
    )
