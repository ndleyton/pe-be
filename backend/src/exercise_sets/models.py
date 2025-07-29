from typing import TYPE_CHECKING

from sqlalchemy import Column, Integer, Float, Boolean, ForeignKey, Text, String
from sqlalchemy.orm import relationship, Mapped

from src.core.database import Base

if TYPE_CHECKING:
    from src.exercises.models import Exercise
    from src.exercises.models import IntensityUnit


class ExerciseSet(Base):
    """Model for individual exercise sets"""

    __tablename__ = "exercise_sets"

    reps = Column(Integer)
    intensity = Column(Float)
    intensity_unit_id = Column(
        Integer, ForeignKey("intensity_units.id"), nullable=False
    )
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    rest_time_seconds = Column(Integer)
    done = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    type = Column(String, nullable=True)

    # Relationships
    exercise: Mapped["Exercise"] = relationship(back_populates="exercise_sets")
    intensity_unit: Mapped["IntensityUnit"] = relationship()
