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
    CheckConstraint,
    JSON,
    UniqueConstraint,
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
        CheckConstraint(
            "side IS NULL OR side IN ('left', 'right', 'both')",
            name="ck_exercise_sets_side",
        ),
        CheckConstraint("position >= 0", name="ck_exercise_sets_position"),
        Index(
            "uq_exercise_sets_active_position",
            "exercise_id",
            "position",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    reps = Column(Integer)
    duration_seconds = Column(Integer, nullable=True)
    intensity = Column(Numeric(precision=7, scale=3))
    rpe = Column(Numeric(precision=3, scale=1), nullable=True)
    rir = Column(Numeric(precision=3, scale=1), nullable=True)
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
    side = Column(String, nullable=True)
    position = Column(Integer, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    exercise: Mapped["Exercise"] = relationship(back_populates="exercise_sets")
    intensity_unit: Mapped["IntensityUnit"] = relationship(
        foreign_keys=[intensity_unit_id]
    )
    canonical_intensity_unit: Mapped["IntensityUnit"] = relationship(
        foreign_keys=[canonical_intensity_unit_id]
    )


class ExerciseSetCreationRequest(Base):
    __tablename__ = "exercise_set_creation_requests"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "operation",
            "idempotency_key",
            name="uq_exercise_set_creation_user_operation_key",
        ),
    )

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    operation = Column(String(64), nullable=False)
    idempotency_key = Column(String(128), nullable=False)
    request_hash = Column(String(64), nullable=False)
    result_payload = Column(JSON, nullable=True)
