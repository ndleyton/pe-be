from enum import Enum
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
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship, Mapped

from src.core.database import Base

if TYPE_CHECKING:
    from src.workouts.models import Workout
    from src.exercise_sets.models import ExerciseSet
    from src.users.models import User


class ExerciseType(Base):
    """Model for exercise types"""

    __tablename__ = "exercise_types"

    class ExerciseTypeStatus(str, Enum):
        candidate = "candidate"
        in_review = "in_review"
        released = "released"

    __table_args__ = (
        Index(
            "ix_exercise_types_released_times_used_name",
            desc("times_used"),
            "name",
            postgresql_where=text("status = 'released'"),
        ),
        Index(
            "ix_exercise_types_owner_status_updated_at_desc",
            "owner_id",
            "status",
            desc("updated_at"),
        ),
        Index(
            "ix_exercise_types_in_review_requested_at_desc",
            desc("review_requested_at"),
            postgresql_where=text("status = 'in_review'"),
        ),
        Index(
            "uq_exercise_types_released_lower_name",
            text("lower(name)"),
            unique=True,
            postgresql_where=text("status = 'released'"),
        ),
        Index(
            "uq_exercise_types_owner_lower_name_nonreleased",
            "owner_id",
            text("lower(name)"),
            unique=True,
            postgresql_where=text(
                "owner_id IS NOT NULL AND status IN ('candidate', 'in_review')"
            ),
        ),
    )

    name = Column(String, nullable=False)
    description = Column(String)
    default_intensity_unit = Column(
        Integer,
        ForeignKey("intensity_units.id", ondelete="SET NULL"),
        nullable=True,
    )
    times_used = Column(Integer, default=0, nullable=False)
    owner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status = Column(
        SAEnum(ExerciseTypeStatus, name="exercise_type_status"),
        nullable=False,
        default=ExerciseTypeStatus.released,
    )
    review_requested_at = Column(DateTime(timezone=True), nullable=True)
    released_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    review_notes = Column(Text, nullable=True)
    external_id = Column(String, unique=True, nullable=True)
    images_url = Column(Text, nullable=True)
    reference_images_url = Column(Text, nullable=True)
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
    image_candidates: Mapped[List["ExerciseImageCandidate"]] = relationship(
        "ExerciseImageCandidate",
        back_populates="exercise_type",
        cascade="all, delete-orphan",
    )
    owner: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[owner_id],
    )
    reviewer: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[reviewed_by],
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


class ExerciseImageCandidate(Base):
    """Generated exercise image candidate derived from a reference image."""

    __tablename__ = "exercise_image_candidates"

    __table_args__ = (
        UniqueConstraint("generation_key"),
        UniqueConstraint("storage_path"),
        Index(
            "ix_exercise_image_candidates_exercise_type_option_source",
            "exercise_type_id",
            "option_key",
            "source_image_index",
        ),
    )

    exercise_type_id = Column(
        Integer,
        ForeignKey("exercise_types.id", ondelete="CASCADE"),
        nullable=False,
    )
    generation_key = Column(String(64), nullable=False)
    pipeline_key = Column(String(64), nullable=False)
    option_key = Column(String(64), nullable=False)
    option_label = Column(String(255), nullable=False)
    option_description = Column(Text, nullable=True)
    source_image_index = Column(Integer, nullable=False)
    source_image_url = Column(Text, nullable=False)
    model_name = Column(String(128), nullable=False)
    prompt_version = Column(String(32), nullable=False)
    prompt_summary = Column(Text, nullable=True)
    mime_type = Column(String(64), nullable=False, server_default="image/png")
    storage_path = Column(String(512), nullable=False)

    exercise_type: Mapped["ExerciseType"] = relationship(
        "ExerciseType", back_populates="image_candidates"
    )
