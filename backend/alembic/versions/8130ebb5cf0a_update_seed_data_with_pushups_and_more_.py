"""update_seed_data_with_pushups_and_more_muscles

Revision ID: 8130ebb5cf0a
Revises: c9de8cd9d9f6
Create Date: 2025-06-27 18:47:22.325459

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8130ebb5cf0a'
down_revision: Union[str, None] = 'c9de8cd9d9f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy.sql import table, column
    import datetime

    now = datetime.datetime.now()

    # Add new muscles with higher IDs to avoid conflicts
    muscle_table = table(
        'muscles',
        column('id', sa.Integer),
        column('name', sa.String),
        column('muscle_group_id', sa.Integer),
        column('created_at', sa.DateTime),
        column('updated_at', sa.DateTime),
    )
    op.bulk_insert(
        muscle_table,
        [
            # Additional back muscle
            {'id': 9, 'name': 'Erector Spinae', 'muscle_group_id': 2, 'created_at': now, 'updated_at': now},
            # Additional leg muscle
            {'id': 10, 'name': 'Glutes', 'muscle_group_id': 3, 'created_at': now, 'updated_at': now},
            # Shoulders
            {'id': 11, 'name': 'Anterior Deltoid', 'muscle_group_id': 4, 'created_at': now, 'updated_at': now},
            {'id': 12, 'name': 'Medial Deltoid', 'muscle_group_id': 4, 'created_at': now, 'updated_at': now},
            {'id': 13, 'name': 'Posterior Deltoid', 'muscle_group_id': 4, 'created_at': now, 'updated_at': now},
            # Arms
            {'id': 14, 'name': 'Biceps', 'muscle_group_id': 5, 'created_at': now, 'updated_at': now},
            {'id': 15, 'name': 'Triceps', 'muscle_group_id': 5, 'created_at': now, 'updated_at': now},
            {'id': 16, 'name': 'Forearms', 'muscle_group_id': 5, 'created_at': now, 'updated_at': now},
            # Core
            {'id': 17, 'name': 'Rectus Abdominis', 'muscle_group_id': 6, 'created_at': now, 'updated_at': now},
            {'id': 18, 'name': 'Obliques', 'muscle_group_id': 6, 'created_at': now, 'updated_at': now},
            {'id': 19, 'name': 'Transverse Abdominis', 'muscle_group_id': 6, 'created_at': now, 'updated_at': now},
        ]
    )

    # Add new exercise types
    exercise_type_table = table(
        'exercise_types',
        column('id', sa.Integer),
        column('name', sa.String),
        column('description', sa.String),
        column('default_intensity_unit', sa.Integer),
        column('created_at', sa.DateTime),
        column('updated_at', sa.DateTime),
    )
    op.bulk_insert(
        exercise_type_table,
        [
            {'id': 4, 'name': 'Push-ups', 'description': 'Bodyweight pushing exercise', 'default_intensity_unit': 5, 'created_at': now, 'updated_at': now},
            {'id': 5, 'name': 'Pull-ups', 'description': 'Bodyweight pulling exercise', 'default_intensity_unit': 5, 'created_at': now, 'updated_at': now},
            {'id': 6, 'name': 'Overhead Press', 'description': 'Vertical pressing movement', 'default_intensity_unit': 1, 'created_at': now, 'updated_at': now},
            {'id': 7, 'name': 'Barbell Row', 'description': 'Horizontal pulling movement', 'default_intensity_unit': 1, 'created_at': now, 'updated_at': now},
            {'id': 8, 'name': 'Dips', 'description': 'Bodyweight tricep exercise', 'default_intensity_unit': 5, 'created_at': now, 'updated_at': now},
        ]
    )

    # Add new exercise-muscle relationships
    exercise_types_muscles_table = table(
        'exercise_types_muscles',
        column('exercise_type_id', sa.Integer),
        column('muscle_id', sa.Integer),
    )
    
    # Add updated relationships for existing exercises
    op.bulk_insert(
        exercise_types_muscles_table,
        [
            # Bench Press: add triceps
            {'exercise_type_id': 1, 'muscle_id': 15}, # Triceps
            # Squat: add glutes
            {'exercise_type_id': 2, 'muscle_id': 10}, # Glutes
            # Deadlift: add erector spinae + glutes
            {'exercise_type_id': 3, 'muscle_id': 9},  # Erector Spinae
            {'exercise_type_id': 3, 'muscle_id': 10}, # Glutes
        ]
    )
    
    # Add relationships for new exercises
    op.bulk_insert(
        exercise_types_muscles_table,
        [
            # Push-ups: chest + shoulders + triceps
            {'exercise_type_id': 4, 'muscle_id': 1},  # Pectoralis Major
            {'exercise_type_id': 4, 'muscle_id': 2},  # Pectoralis Minor
            {'exercise_type_id': 4, 'muscle_id': 11}, # Anterior Deltoid
            {'exercise_type_id': 4, 'muscle_id': 15}, # Triceps
            # Pull-ups: back + biceps
            {'exercise_type_id': 5, 'muscle_id': 3},  # Latissimus Dorsi
            {'exercise_type_id': 5, 'muscle_id': 4},  # Trapezius
            {'exercise_type_id': 5, 'muscle_id': 5},  # Rhomboids
            {'exercise_type_id': 5, 'muscle_id': 14}, # Biceps
            # Overhead Press: shoulders + triceps
            {'exercise_type_id': 6, 'muscle_id': 11}, # Anterior Deltoid
            {'exercise_type_id': 6, 'muscle_id': 12}, # Medial Deltoid
            {'exercise_type_id': 6, 'muscle_id': 13}, # Posterior Deltoid
            {'exercise_type_id': 6, 'muscle_id': 15}, # Triceps
            # Barbell Row: back + biceps
            {'exercise_type_id': 7, 'muscle_id': 3},  # Latissimus Dorsi
            {'exercise_type_id': 7, 'muscle_id': 4},  # Trapezius
            {'exercise_type_id': 7, 'muscle_id': 5},  # Rhomboids
            {'exercise_type_id': 7, 'muscle_id': 14}, # Biceps
            # Dips: chest + triceps
            {'exercise_type_id': 8, 'muscle_id': 1},  # Pectoralis Major
            {'exercise_type_id': 8, 'muscle_id': 2},  # Pectoralis Minor
            {'exercise_type_id': 8, 'muscle_id': 15}, # Triceps
        ]
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Remove seeded reference data in reverse dependency order
    op.execute("DELETE FROM exercise_types_muscles WHERE exercise_type_id IN (4,5,6,7,8)")
    op.execute("DELETE FROM exercise_types_muscles WHERE muscle_id IN (9,10,11,12,13,14,15,16,17,18,19)")
    op.execute("DELETE FROM exercise_types WHERE id IN (4,5,6,7,8)")
    op.execute("DELETE FROM muscles WHERE id IN (9,10,11,12,13,14,15,16,17,18,19)")
