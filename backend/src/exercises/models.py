from typing import List, TYPE_CHECKING

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Boolean,
    Index,
    desc,
    text,
)
from sqlalchemy.orm import relationship, Mapped

from src.core.database import Base

if TYPE_CHECKING:
    from src.workouts.models import Workout
    from src.exercise_sets.models import ExerciseSet


class ExerciseType(Base):
    """Model for exercise types"""

    __tablename__ = "exercise_types"

    __table_args__ = (
        Index("ix_exercise_types_times_used_name", desc("times_used"), "name"),
    )

    name = Column(String, unique=True)
    description = Column(String)
    default_intensity_unit = Column(
        Integer,
        ForeignKey("intensity_units.id", ondelete="SET NULL"),
        nullable=True,
    )
    times_used = Column(Integer, default=0, nullable=False)
    external_id = Column(String, unique=True, nullable=True)
    images_url = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    equipment = Column(String, nullable=True)
    category = Column(String, nullable=True)

    # Relationships
    exercise_muscles: Mapped[List["ExerciseMuscle"]] = relationship(
        back_populates="exercise_type"
    )
    exercises: Mapped[List["Exercise"]] = relationship(
        "Exercise", back_populates="exercise_type"
    )


class Exercise(Base):
    """Model for exercises within workouts"""

    __tablename__ = "exercises"

    __table_args__ = (
        Index(
            "ix_exercises_workout_id_active_id",
            "workout_id",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_exercises_exercise_type_id_created_at_desc",
            "exercise_type_id",
            desc("created_at"),
        ),
    )

    timestamp = Column(DateTime(timezone=True))
    notes = Column(Text)
    exercise_type_id = Column(
        Integer,
        ForeignKey("exercise_types.id", ondelete="RESTRICT"),
        nullable=False,
    )
    workout_id = Column(
        Integer,
        ForeignKey("workouts.id", ondelete="CASCADE"),
        nullable=False,
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    exercise_type: Mapped["ExerciseType"] = relationship(
        "ExerciseType", back_populates="exercises", lazy="joined"
    )
    workout: Mapped["Workout"] = relationship(back_populates="exercises")
    exercise_sets: Mapped[List["ExerciseSet"]] = relationship(back_populates="exercise")


class IntensityUnit(Base):
    """Model for intensity units (kg, lbs, etc.)"""

    __tablename__ = "intensity_units"

    name = Column(String, unique=True)
    abbreviation = Column(String)


class MuscleGroup(Base):
    """Model for muscle groups"""

    __tablename__ = "muscle_groups"

    name = Column(String, unique=True)

    # Relationships
    muscles: Mapped[List["Muscle"]] = relationship(
        "Muscle", back_populates="muscle_group"
    )


class Muscle(Base):
    """Model for individual muscles"""

    __tablename__ = "muscles"

    name = Column(String, unique=True)
    muscle_group_id = Column(
        Integer,
        ForeignKey("muscle_groups.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationships
    exercise_muscles: Mapped[List["ExerciseMuscle"]] = relationship(
        back_populates="muscle"
    )
    muscle_group: Mapped["MuscleGroup"] = relationship(
        "MuscleGroup", back_populates="muscles"
    )


class ExerciseMuscle(Base):
    """Model for exercise-muscle relationships"""

    __tablename__ = "exercise_muscles"

    exercise_type_id = Column(
        Integer,
        ForeignKey("exercise_types.id", ondelete="CASCADE"),
        nullable=False,
    )
    muscle_id = Column(
        Integer,
        ForeignKey("muscles.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_primary = Column(Boolean, nullable=False, default=False, server_default="false")

    __table_args__ = (UniqueConstraint("exercise_type_id", "muscle_id"),)

    exercise_type: Mapped["ExerciseType"] = relationship(
        back_populates="exercise_muscles"
    )
    muscle: Mapped["Muscle"] = relationship(back_populates="exercise_muscles")
