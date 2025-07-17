from typing import List, TYPE_CHECKING

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Table,
    UniqueConstraint,
    Boolean,
)
from sqlalchemy.orm import relationship, Mapped

from src.core.database import Base

if TYPE_CHECKING:
    from src.workouts.models import Workout
    from src.exercise_sets.models import ExerciseSet


# Association table for exercise types and muscles
exercise_types_muscles = Table(
    "exercise_types_muscles",
    Base.metadata,
    Column(
        "exercise_type_id", Integer, ForeignKey("exercise_types.id"), primary_key=True
    ),
    Column("muscle_id", Integer, ForeignKey("muscles.id"), primary_key=True),
)


class ExerciseType(Base):
    """Model for exercise types"""

    __tablename__ = "exercise_types"

    name = Column(String, unique=True)
    description = Column(String)
    default_intensity_unit = Column(Integer, nullable=True)
    times_used = Column(Integer, default=0, nullable=False)
    external_id = Column(String, unique=True, nullable=True)
    images_url = Column(Text, nullable=True)

    # Relationships
    muscles = relationship(
        "Muscle", secondary=exercise_types_muscles, back_populates="exercise_types"
    )
    exercises: Mapped[List["Exercise"]] = relationship(
        "Exercise", back_populates="exercise_type"
    )


class Exercise(Base):
    """Model for exercises within workouts"""

    __tablename__ = "exercises"

    timestamp = Column(DateTime(timezone=True))
    notes = Column(Text)
    exercise_type_id = Column(Integer, ForeignKey("exercise_types.id"), nullable=False)
    workout_id = Column(Integer, ForeignKey("workouts.id"), nullable=False)

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
    muscle_group_id = Column(Integer, ForeignKey("muscle_groups.id"), nullable=False)

    # Relationships
    exercise_types = relationship(
        "ExerciseType", secondary=exercise_types_muscles, back_populates="muscles"
    )
    muscle_group: Mapped["MuscleGroup"] = relationship(
        "MuscleGroup", back_populates="muscles"
    )


class ExerciseMuscle(Base):
    """Model for exercise-muscle relationships"""

    __tablename__ = "exercise_muscles"

    exercise_type_id = Column(Integer, ForeignKey("exercise_types.id"), nullable=False)
    muscle_id = Column(Integer, ForeignKey("muscles.id"), nullable=False)
    is_primary = Column(Boolean, nullable=False, default=False, server_default="false")

    __table_args__ = (UniqueConstraint("exercise_type_id", "muscle_id"),)
