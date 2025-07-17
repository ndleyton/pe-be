from typing import List, TYPE_CHECKING

from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey
from sqlalchemy.orm import relationship, Mapped

from src.core.database import Base

if TYPE_CHECKING:
    from src.users.models import User
    from src.workouts.models import WorkoutType
    from src.exercises.models import ExerciseType, IntensityUnit


class Recipe(Base):
    """Model for workout recipes/templates"""

    __tablename__ = "recipes"

    name = Column(String, nullable=False)
    description = Column(Text)
    workout_type_id = Column(Integer, ForeignKey("workout_types.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    creator: Mapped["User"] = relationship("User", back_populates="recipes")
    workout_type: Mapped["WorkoutType"] = relationship("WorkoutType", lazy="joined")
    exercise_templates: Mapped[List["ExerciseTemplate"]] = relationship(
        "ExerciseTemplate", back_populates="recipe", cascade="all, delete-orphan"
    )


class ExerciseTemplate(Base):
    """Model for exercise templates within recipes"""

    __tablename__ = "exercise_templates"

    exercise_type_id = Column(Integer, ForeignKey("exercise_types.id"), nullable=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)

    # Relationships
    exercise_type: Mapped["ExerciseType"] = relationship("ExerciseType", lazy="joined")
    recipe: Mapped["Recipe"] = relationship(
        "Recipe", back_populates="exercise_templates"
    )
    set_templates: Mapped[List["SetTemplate"]] = relationship(
        "SetTemplate", back_populates="exercise_template", cascade="all, delete-orphan"
    )


class SetTemplate(Base):
    """Model for set templates within exercise templates"""

    __tablename__ = "set_templates"

    reps = Column(Integer)
    intensity = Column(Float)
    intensity_unit_id = Column(
        Integer, ForeignKey("intensity_units.id"), nullable=False
    )
    exercise_template_id = Column(
        Integer, ForeignKey("exercise_templates.id"), nullable=False
    )

    # Relationships
    intensity_unit: Mapped["IntensityUnit"] = relationship(
        "IntensityUnit", lazy="joined"
    )
    exercise_template: Mapped["ExerciseTemplate"] = relationship(
        "ExerciseTemplate", back_populates="set_templates"
    )
