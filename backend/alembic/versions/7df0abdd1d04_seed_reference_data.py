"""seed reference data

Revision ID: 7df0abdd1d04
Revises: d559e60121f4
Create Date: 2025-05-07 01:00:38.168111

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7df0abdd1d04'
down_revision: Union[str, None] = 'd559e60121f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy.sql import table, column
    import sqlalchemy as sa
    import datetime

    # Intensity Units
    intensity_unit_table = table(
        'intensity_units',
        column('id', sa.Integer),
        column('name', sa.String),
        column('abbreviation', sa.String),
        column('created_at', sa.DateTime),
        column('updated_at', sa.DateTime),
    )
    now = datetime.datetime.now()
    op.bulk_insert(
        intensity_unit_table,
        [
            {'id': 1, 'name': 'Kilograms', 'abbreviation': 'kg', 'created_at': now, 'updated_at': now},
            {'id': 2, 'name': 'Pounds', 'abbreviation': 'lbs', 'created_at': now, 'updated_at': now},
            {'id': 3, 'name': 'Kilometers per hour', 'abbreviation': 'km/h', 'created_at': now, 'updated_at': now},
            {'id': 4, 'name': 'Miles per hour', 'abbreviation': 'mph', 'created_at': now, 'updated_at': now},
            {'id': 5, 'name': 'Bodyweight', 'abbreviation': 'BW', 'created_at': now, 'updated_at': now},
        ]
    )

    # Muscle Groups
    muscle_group_table = table(
        'muscle_groups',
        column('id', sa.Integer),
        column('name', sa.String),
        column('created_at', sa.DateTime),
        column('updated_at', sa.DateTime),
    )
    op.bulk_insert(
        muscle_group_table,
        [
            {'id': 1, 'name': 'Chest', 'created_at': now, 'updated_at': now},
            {'id': 2, 'name': 'Back', 'created_at': now, 'updated_at': now},
            {'id': 3, 'name': 'Legs', 'created_at': now, 'updated_at': now},
            {'id': 4, 'name': 'Shoulders', 'created_at': now, 'updated_at': now},
            {'id': 5, 'name': 'Arms', 'created_at': now, 'updated_at': now},
            {'id': 6, 'name': 'Core', 'created_at': now, 'updated_at': now},
        ]
    )

    # Muscles
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
            # Chest
            {'id': 1, 'name': 'Pectoralis Major', 'muscle_group_id': 1, 'created_at': now, 'updated_at': now},
            {'id': 2, 'name': 'Pectoralis Minor', 'muscle_group_id': 1, 'created_at': now, 'updated_at': now},
            # Back
            {'id': 3, 'name': 'Latissimus Dorsi', 'muscle_group_id': 2, 'created_at': now, 'updated_at': now},
            {'id': 4, 'name': 'Trapezius', 'muscle_group_id': 2, 'created_at': now, 'updated_at': now},
            {'id': 5, 'name': 'Rhomboids', 'muscle_group_id': 2, 'created_at': now, 'updated_at': now},
            # Legs
            {'id': 6, 'name': 'Quadriceps', 'muscle_group_id': 3, 'created_at': now, 'updated_at': now},
            {'id': 7, 'name': 'Hamstrings', 'muscle_group_id': 3, 'created_at': now, 'updated_at': now},
            {'id': 8, 'name': 'Calves', 'muscle_group_id': 3, 'created_at': now, 'updated_at': now},
        ]
    )

    # Exercise Types
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
            {'id': 1, 'name': 'Bench Press', 'description': 'Horizontal pressing movement', 'default_intensity_unit': 1, 'created_at': now, 'updated_at': now},
            {'id': 2, 'name': 'Squat', 'description': 'Lower body compound movement', 'default_intensity_unit': 1, 'created_at': now, 'updated_at': now},
            {'id': 3, 'name': 'Deadlift', 'description': 'Full body pulling movement', 'default_intensity_unit': 1, 'created_at': now, 'updated_at': now},
        ]
    )

    # Exercise Types <-> Muscles (Join Table)
    exercise_types_muscles_table = table(
        'exercise_types_muscles',
        column('exercise_type_id', sa.Integer),
        column('muscle_id', sa.Integer),
    )
    op.bulk_insert(
        exercise_types_muscles_table,
        [
            # Bench Press: chest muscles
            {'exercise_type_id': 1, 'muscle_id': 1},
            {'exercise_type_id': 1, 'muscle_id': 2},
            # Squat: leg muscles
            {'exercise_type_id': 2, 'muscle_id': 6},
            {'exercise_type_id': 2, 'muscle_id': 7},
            {'exercise_type_id': 2, 'muscle_id': 8},
            # Deadlift: back + leg muscles
            {'exercise_type_id': 3, 'muscle_id': 3},
            {'exercise_type_id': 3, 'muscle_id': 4},
            {'exercise_type_id': 3, 'muscle_id': 5},
            {'exercise_type_id': 3, 'muscle_id': 6},
            {'exercise_type_id': 3, 'muscle_id': 7},
            {'exercise_type_id': 3, 'muscle_id': 8},
        ]
    )

    # Workout Types
    workout_type_table = table(
        'workout_types',
        column('id', sa.Integer),
        column('name', sa.String),
        column('description', sa.String),
        column('created_at', sa.DateTime),
        column('updated_at', sa.DateTime),
    )
    op.bulk_insert(
        workout_type_table,
        [
            {'id': 1, 'name': 'Low Intensity Cardio', 'description': 'Steady-state cardio exercises at 50-65% of max heart rate', 'created_at': now, 'updated_at': now},
            {'id': 2, 'name': 'HIIT', 'description': 'High-Intensity Interval Training alternating between intense exercise and rest periods', 'created_at': now, 'updated_at': now},
            {'id': 3, 'name': 'Sports', 'description': 'Athletic activities and sports-specific training', 'created_at': now, 'updated_at': now},
            {'id': 4, 'name': 'Strength Training', 'description': 'Progressive resistance training focusing on building strength and muscle', 'created_at': now, 'updated_at': now},
            {'id': 5, 'name': 'Mobility', 'description': 'Exercises focusing on flexibility, range of motion, and joint health', 'created_at': now, 'updated_at': now},
        ]
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Remove seeded reference data in reverse dependency order
    op.execute("DELETE FROM exercise_types_muscles WHERE exercise_type_id IN (1,2,3) OR muscle_id IN (1,2,3,4,5,6,7,8)")
    op.execute("DELETE FROM exercise_types WHERE id IN (1,2,3)")
    op.execute("DELETE FROM muscles WHERE id IN (1,2,3,4,5,6,7,8)")
    op.execute("DELETE FROM muscle_groups WHERE id IN (1,2,3,4,5,6)")
    op.execute("DELETE FROM intensity_units WHERE id IN (1,2,3,4,5)")
    op.execute("DELETE FROM workout_types WHERE id IN (1,2,3,4,5)")
