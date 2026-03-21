"""add hot-path indexes for common reads

Revision ID: 2f6b1d8e4c3a
Revises: 1b2f4f77c0ad
Create Date: 2026-03-20 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2f6b1d8e4c3a"
down_revision: Union[str, None] = "1b2f4f77c0ad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_names() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    """Add indexes for the most common tested read paths."""
    table_names = _table_names()

    if "workouts" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_workouts_owner_id_id_desc
            ON workouts (owner_id, id DESC)
            """
        )
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_workouts_owner_id_start_time_desc
            ON workouts (owner_id, start_time DESC)
            """
        )

    if "exercise_types" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_exercise_types_times_used_name
            ON exercise_types (times_used DESC, name)
            """
        )

    if "exercises" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_exercises_workout_id_active_id
            ON exercises (workout_id, id)
            WHERE deleted_at IS NULL
            """
        )
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_exercises_exercise_type_id_created_at_desc
            ON exercises (exercise_type_id, created_at DESC)
            """
        )

    if "exercise_sets" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_exercise_sets_exercise_id_active_id
            ON exercise_sets (exercise_id, id)
            WHERE deleted_at IS NULL
            """
        )

    if "recipes" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_recipes_creator_id_created_at_desc
            ON recipes (creator_id, created_at DESC)
            """
        )
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_recipes_visibility_created_at_desc
            ON recipes (visibility, created_at DESC)
            """
        )

    if "exercise_templates" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_exercise_templates_recipe_id
            ON exercise_templates (recipe_id)
            """
        )

    if "set_templates" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_set_templates_exercise_template_id
            ON set_templates (exercise_template_id)
            """
        )

    if "conversations" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_conversations_user_active_updated_at_desc
            ON conversations (user_id, updated_at DESC)
            WHERE is_active
            """
        )

    if "conversation_messages" in table_names:
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_conversation_messages_conversation_id_created_at
            ON conversation_messages (conversation_id, created_at)
            """
        )


def downgrade() -> None:
    """Drop hot-path indexes added in this revision."""
    table_names = _table_names()

    if "conversation_messages" in table_names:
        op.execute(
            "DROP INDEX IF EXISTS ix_conversation_messages_conversation_id_created_at"
        )

    if "conversations" in table_names:
        op.execute("DROP INDEX IF EXISTS ix_conversations_user_active_updated_at_desc")

    if "set_templates" in table_names:
        op.execute("DROP INDEX IF EXISTS ix_set_templates_exercise_template_id")

    if "exercise_templates" in table_names:
        op.execute("DROP INDEX IF EXISTS ix_exercise_templates_recipe_id")

    if "recipes" in table_names:
        op.execute("DROP INDEX IF EXISTS ix_recipes_visibility_created_at_desc")
        op.execute("DROP INDEX IF EXISTS ix_recipes_creator_id_created_at_desc")

    if "exercise_sets" in table_names:
        op.execute("DROP INDEX IF EXISTS ix_exercise_sets_exercise_id_active_id")

    if "exercises" in table_names:
        op.execute(
            "DROP INDEX IF EXISTS ix_exercises_exercise_type_id_created_at_desc"
        )
        op.execute("DROP INDEX IF EXISTS ix_exercises_workout_id_active_id")

    if "exercise_types" in table_names:
        op.execute("DROP INDEX IF EXISTS ix_exercise_types_times_used_name")

    if "workouts" in table_names:
        op.execute("DROP INDEX IF EXISTS ix_workouts_owner_id_start_time_desc")
        op.execute("DROP INDEX IF EXISTS ix_workouts_owner_id_id_desc")
