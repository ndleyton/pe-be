from typing import TYPE_CHECKING

from sqlalchemy import (
    Column,
    Integer,
    Boolean,
    ForeignKey,
    Text,
    String,
    DateTime,
    Numeric,
)
from sqlalchemy.orm import relationship, Mapped

from src.core.database import Base

if TYPE_CHECKING:
    from src.exercises.models import Exercise
    from src.exercises.models import IntensityUnit


class ExerciseSet(Base):
    """Model for individual exercise sets"""

    __tablename__ = "exercise_sets"

    reps = Column(Integer)
    intensity = Column(Numeric(precision=7, scale=3))
    intensity_unit_id = Column(
        Integer,
        ForeignKey("intensity_units.id", ondelete="RESTRICT"),
        nullable=False,
    )
    exercise_id = Column(
        Integer,
        ForeignKey("exercises.id", ondelete="CASCADE"),
        nullable=False,
    )
    rest_time_seconds = Column(Integer)
    done = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    type = Column(String, nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    exercise: Mapped["Exercise"] = relationship(back_populates="exercise_sets")
    intensity_unit: Mapped["IntensityUnit"] = relationship()
