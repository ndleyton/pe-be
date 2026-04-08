from typing import List, TYPE_CHECKING

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Numeric,
    ForeignKey,
    Boolean,
    Index,
    desc,
)
from sqlalchemy import Enum as SAEnum
from enum import Enum
from sqlalchemy.orm import relationship, Mapped

from src.core.database import Base

if TYPE_CHECKING:
    from src.users.models import User
    from src.workouts.models import WorkoutType
    from src.exercises.models import ExerciseType, IntensityUnit


class Routine(Base):
    """Model for workout routines/templates."""

    __tablename__ = "recipes"

    __table_args__ = (
        Index("ix_recipes_creator_visibility", "creator_id", "visibility"),
        Index(
            "ix_recipes_creator_id_created_at_desc",
            "creator_id",
            desc("created_at"),
        ),
        Index(
            "ix_recipes_visibility_created_at_desc",
            "visibility",
            desc("created_at"),
        ),
    )

    name = Column(String, nullable=False)
    description = Column(Text)
    workout_type_id = Column(
        Integer,
        ForeignKey("workout_types.id", ondelete="RESTRICT"),
        nullable=False,
    )
    creator_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Visibility as an enum (private, public, link_only)
    # Use lowercase member names so SQLAlchemy binds names that match DB labels.
    class RoutineVisibility(str, Enum):
        private = "private"
        public = "public"
        link_only = "link_only"

    # Native PostgreSQL enum uses the same lowercase labels, so no adapter needed.
    visibility = Column(
        SAEnum(RoutineVisibility, name="recipe_visibility"),
        nullable=False,
        default=RoutineVisibility.private,
    )
    # Mutability control for canonical content
    is_readonly = Column(Boolean, default=False, nullable=False)

    # Relationships
    creator: Mapped["User"] = relationship("User", back_populates="routines")
    workout_type: Mapped["WorkoutType"] = relationship("WorkoutType", lazy="joined")
    exercise_templates: Mapped[List["ExerciseTemplate"]] = relationship(
        "ExerciseTemplate", back_populates="routine", cascade="all, delete-orphan"
    )


class ExerciseTemplate(Base):
    """Model for exercise templates within routines."""

    __tablename__ = "exercise_templates"

    __table_args__ = (Index("ix_exercise_templates_recipe_id", "recipe_id"),)

    exercise_type_id = Column(
        Integer,
        ForeignKey("exercise_types.id", ondelete="RESTRICT"),
        nullable=False,
    )
    routine_id = Column(
        "recipe_id",
        Integer,
        ForeignKey("recipes.id", ondelete="CASCADE"),
        nullable=False,
    )
    notes = Column(Text)

    # Relationships
    exercise_type: Mapped["ExerciseType"] = relationship("ExerciseType", lazy="joined")
    routine: Mapped["Routine"] = relationship(
        "Routine", back_populates="exercise_templates"
    )
    set_templates: Mapped[List["SetTemplate"]] = relationship(
        "SetTemplate",
        back_populates="exercise_template",
        cascade="all, delete-orphan",
        order_by="SetTemplate.id",
    )


class SetTemplate(Base):
    """Model for set templates within exercise templates"""

    __tablename__ = "set_templates"

    __table_args__ = (
        Index("ix_set_templates_exercise_template_id", "exercise_template_id"),
    )

    reps = Column(Integer)
    duration_seconds = Column(Integer, nullable=True)
    intensity = Column(Numeric(precision=7, scale=3))
    rpe = Column(Numeric(precision=3, scale=1), nullable=True)
    canonical_intensity = Column(Numeric(precision=10, scale=5), nullable=True)
    intensity_unit_id = Column(
        Integer,
        ForeignKey("intensity_units.id", ondelete="RESTRICT"),
        nullable=False,
    )
    canonical_intensity_unit_id = Column(
        Integer,
        ForeignKey("intensity_units.id", ondelete="RESTRICT"),
        nullable=True,
    )
    exercise_template_id = Column(
        Integer,
        ForeignKey("exercise_templates.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    intensity_unit: Mapped["IntensityUnit"] = relationship(
        "IntensityUnit", lazy="joined", foreign_keys=[intensity_unit_id]
    )
    canonical_intensity_unit: Mapped["IntensityUnit"] = relationship(
        "IntensityUnit",
        lazy="joined",
        foreign_keys=[canonical_intensity_unit_id],
    )
    exercise_template: Mapped["ExerciseTemplate"] = relationship(
        "ExerciseTemplate", back_populates="set_templates"
    )
