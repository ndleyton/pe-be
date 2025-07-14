from typing import List, TYPE_CHECKING

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
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
    
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    name = Column(String)
    notes = Column(Text)
    workout_type_id = Column(Integer, ForeignKey("workout_types.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    owner: Mapped["User"] = relationship(back_populates="workouts")
    exercises: Mapped[List["Exercise"]] = relationship(back_populates="workout") 