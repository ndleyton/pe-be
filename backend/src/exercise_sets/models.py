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
    Index,
    text,
)
from sqlalchemy.orm import relationship, Mapped

from src.core.database import Base

if TYPE_CHECKING:
    from src.exercises.models import Exercise
    from src.exercises.models import IntensityUnit


class ExerciseSet(Base):
    """Model for individual exercise sets"""

    __tablename__ = "exercise_sets"

    __table_args__ = (
        Index(
            "ix_exercise_sets_exercise_id_active_id",
            "exercise_id",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
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
    intensity_unit: Mapped["IntensityUnit"] = relationship(
        foreign_keys=[intensity_unit_id]
    )
    canonical_intensity_unit: Mapped["IntensityUnit"] = relationship(
        foreign_keys=[canonical_intensity_unit_id]
    )
