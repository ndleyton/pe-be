from enum import Enum
from typing import List, Optional, TYPE_CHECKING

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
    Boolean,
    text,
    and_,
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
            desc("id"),
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
    workout_type: Mapped["WorkoutType"] = relationship("WorkoutType")
    exercises: Mapped[List["Exercise"]] = relationship(back_populates="workout")
    photos: Mapped[List["WorkoutPhoto"]] = relationship(
        "WorkoutPhoto",
        back_populates="workout",
        cascade="all, delete-orphan",
    )
    photo: Mapped[Optional["WorkoutPhoto"]] = relationship(
        "WorkoutPhoto",
        primaryjoin=lambda: and_(
            Workout.id == WorkoutPhoto.workout_id,
            WorkoutPhoto.is_primary.is_(True),
            WorkoutPhoto.deleted_at.is_(None),
        ),
        uselist=False,
        viewonly=True,
        overlaps="photos,workout",
    )


class WorkoutPhoto(Base):
    """Uploaded photo attached to a workout."""

    __tablename__ = "workout_photos"
    __table_args__ = (
        Index(
            "ix_workout_photos_workout_id_is_primary",
            "workout_id",
            "is_primary",
        ),
        Index("ix_workout_photos_user_id", "user_id"),
        Index(
            "uq_workout_photos_one_active_primary",
            "workout_id",
            unique=True,
            postgresql_where=text("is_primary = true AND deleted_at IS NULL"),
        ),
    )

    workout_id = Column(
        Integer,
        ForeignKey("workouts.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    storage_key = Column(String(512), nullable=False, unique=True)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    sha256 = Column(String(64), nullable=False)
    original_filename = Column(String(255), nullable=True)
    is_primary = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    workout: Mapped["Workout"] = relationship("Workout", back_populates="photos")
    user: Mapped["User"] = relationship("User", back_populates="workout_photos")
