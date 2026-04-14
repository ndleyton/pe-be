"""remove exercise_types_muscles table

Revision ID: 3d9978befc19
Revises: e3f5a7b8c9d1
Create Date: 2025-07-18 01:46:09.063933

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3d9978befc19"
down_revision: Union[str, None] = "e3f5a7b8c9d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove the legacy exercise_types_muscles table.

    This table is redundant since we now use the exercise_muscles table
    which includes additional fields like is_primary and timestamps.
    """
    # Check if table exists before dropping to avoid Alembic tracking issues
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "exercise_types_muscles" in inspector.get_table_names():
        # Use Alembic's drop_table instead of raw SQL for proper tracking
        op.drop_table("exercise_types_muscles")


def downgrade() -> None:
    """Recreate the exercise_types_muscles table."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    # Only recreate table if it doesn't already exist
    if "exercise_types_muscles" not in inspector.get_table_names():
        # Recreate the table structure using Alembic's create_table
        op.create_table(
            "exercise_types_muscles",
            sa.Column("exercise_type_id", sa.Integer(), nullable=False),
            sa.Column("muscle_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["exercise_type_id"], ["exercise_types.id"]),
            sa.ForeignKeyConstraint(["muscle_id"], ["muscles.id"]),
            sa.PrimaryKeyConstraint("exercise_type_id", "muscle_id"),
        )

        # Check if exercise_muscles table exists before migrating data
        if "exercise_muscles" in inspector.get_table_names():
            # Use SQLAlchemy table objects for safer data migration
            from sqlalchemy.sql import table, column

            exercise_muscles = table(
                "exercise_muscles",
                column("exercise_type_id", sa.Integer),
                column("muscle_id", sa.Integer),
            )

            exercise_types_muscles = table(
                "exercise_types_muscles",
                column("exercise_type_id", sa.Integer),
                column("muscle_id", sa.Integer),
            )

            # Migrate data using SQLAlchemy constructs instead of raw SQL
            # Note: This will lose the is_primary information from exercise_muscles
            select_stmt = sa.select(
                [exercise_muscles.c.exercise_type_id, exercise_muscles.c.muscle_id]
            ).distinct()

            try:
                # Execute the select and insert the results
                result = connection.execute(select_stmt)
                rows_to_insert = [
                    {
                        "exercise_type_id": row.exercise_type_id,
                        "muscle_id": row.muscle_id,
                    }
                    for row in result
                ]

                if rows_to_insert:
                    op.bulk_insert(exercise_types_muscles, rows_to_insert)
            except Exception as e:
                # Log the error but don't fail the migration
                print(f"Warning: Could not migrate data from exercise_muscles: {e}")
                print("The exercise_types_muscles table was created but is empty.")
