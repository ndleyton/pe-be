from enum import Enum
from typing import List, TYPE_CHECKING

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    CheckConstraint,
    Index,
    desc,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship, Mapped

from src.core.database import Base

if TYPE_CHECKING:
    from src.users.models import User
    from src.exercises.models import Exercise


class WorkoutType(Base):
    """Model for workout types"""

    __tablename__ = "workout_types"

    name = Column(String)
    description = Column(String)


class Workout(Base):
    """Model for user workouts"""

    __tablename__ = "workouts"

    class WorkoutVisibility(str, Enum):
        private = "private"
        public = "public"

    __table_args__ = (
        CheckConstraint(
            "end_time IS NULL OR start_time IS NULL OR end_time >= start_time",
            name="ck_workouts_end_time_gte_start_time",
        ),
        Index("ix_workouts_owner_id_id_desc", "owner_id", desc("id")),
        Index(
            "ix_workouts_owner_id_start_time_desc",
            "owner_id",
            desc("start_time"),
        ),
        Index(
            "ix_workouts_owner_visibility_end_time_desc",
            "owner_id",
            "visibility",
            desc("end_time"),
        ),
    )

    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    name = Column(String)
    notes = Column(Text)
    workout_type_id = Column(
        Integer,
        ForeignKey("workout_types.id", ondelete="RESTRICT"),
        nullable=False,
    )
    owner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    recap = Column(Text)
    visibility = Column(
        SAEnum(WorkoutVisibility, name="workout_visibility"),
        nullable=False,
        default=WorkoutVisibility.private,
        server_default=WorkoutVisibility.private.value,
    )

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="workouts")
    exercises: Mapped[List["Exercise"]] = relationship(back_populates="workout")
