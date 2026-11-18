from sqlalchemy import (
    JSON,
    Column,
    Integer,
    String,
    ForeignKey,
    Boolean,
    UniqueConstraint,
)
from src.core.database import Base


class SyncLog(Base):
    __tablename__ = "sync_logs"

    # id from Base is the primary key.
    # We add a unique constraint for the (user_id, idempotency_key) pair.
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    idempotency_key = Column(String, nullable=False)

    success = Column(Boolean, nullable=False, default=True)
    synced_workouts = Column(Integer, default=0)
    synced_exercises = Column(Integer, default=0)
    workout_id_map = Column(JSON, nullable=True)
    synced_sets = Column(Integer, default=0)
    synced_routines = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint(
            "user_id", "idempotency_key", name="uq_sync_logs_user_idempotency"
        ),
    )


class GuestWorkoutMapping(Base):
    __tablename__ = "guest_workout_mappings"
    __table_args__ = (UniqueConstraint("user_id", "guest_id"),)

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    guest_id = Column(String, nullable=False)
    workout_id = Column(
        Integer, ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False
    )


class GuestExerciseTypeMapping(Base):
    __tablename__ = "guest_exercise_type_mappings"
    __table_args__ = (UniqueConstraint("user_id", "guest_id"),)

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    guest_id = Column(String, nullable=False)
    exercise_type_id = Column(
        Integer, ForeignKey("exercise_types.id", ondelete="CASCADE"), nullable=False
    )
