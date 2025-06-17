from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, Table, UniqueConstraint, MetaData, Index # Added Index back
)
# Use DeclarativeBase and explicit MetaData (keep these changes)
from sqlalchemy.orm import relationship, DeclarativeBase, Mapped, mapped_column

from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTable, SQLAlchemyBaseOAuthAccountTable

# Explicitly create MetaData
metadata_obj = MetaData()

# Pass metadata to DeclarativeBase
class Base(DeclarativeBase):
    metadata = metadata_obj

# Association tables (no primary key) - Use the explicit metadata object
exercise_types_muscles = Table(
    "exercise_types_muscles", metadata_obj,
    Column("exercise_type_id", Integer, ForeignKey("exercise_types.id"), primary_key=True),
    Column("muscle_id", Integer, ForeignKey("muscles.id"), primary_key=True)
)

# --- OAuthAccount Model (WORKAROUND: Explicit PKs) ---
class OAuthAccount(SQLAlchemyBaseOAuthAccountTable[int], Base):
    __tablename__ = "oauth_accounts"

    # --- Explicitly define PK columns (WORKAROUND) ---
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="cascade"), primary_key=True, nullable=False
    )
    oauth_name: Mapped[str] = mapped_column(
        String(length=100), index=True, primary_key=True, nullable=False
    )

    # Relationship back to the User (Keep this)
    user: Mapped["User"] = relationship("User", back_populates="oauth_accounts")

    # Note: Other columns like access_token, account_id, etc., are still inherited.

# --- User Model (Unchanged) ---
class User(SQLAlchemyBaseUserTable[int], Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationship to Workouts
    workouts: Mapped[List["Workout"]] = relationship(back_populates="owner")
    
    oauth_accounts: Mapped[List[OAuthAccount]] = relationship("OAuthAccount", lazy="joined", back_populates="user")


class ExerciseMuscle(Base):
    __tablename__ = "exercise_muscles"
    id = Column(Integer, primary_key=True)
    exercise_type_id = Column(Integer, ForeignKey("exercise_types.id"), nullable=False)
    muscle_id = Column(Integer, ForeignKey("muscles.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    __table_args__ = (UniqueConstraint('exercise_type_id', 'muscle_id'),)

class ExerciseSet(Base):
    __tablename__ = "exercise_sets"
    id = Column(Integer, primary_key=True)
    reps = Column(Integer)
    intensity = Column(Float)
    intensity_unit_id = Column(Integer, ForeignKey("intensity_units.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    rest_time_seconds = Column(Integer)
    done = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

class ExerciseTemplate(Base):
    __tablename__ = "exercise_templates"
    id = Column(Integer, primary_key=True)
    exercise_type_id = Column(Integer, ForeignKey("exercise_types.id"), nullable=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

class ExerciseType(Base):
    __tablename__ = "exercise_types"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String)
    description = Column(String)
    default_intensity_unit = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    muscles = relationship("Muscle", secondary=exercise_types_muscles, back_populates="exercise_types")

class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime(timezone=True))
    notes = Column(Text)
    exercise_type_id = Column(Integer, ForeignKey("exercise_types.id"), nullable=False)
    workout_id = Column(Integer, ForeignKey("workouts.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationship to ExerciseType
    exercise_type = relationship("ExerciseType")

class IntensityUnit(Base):
    __tablename__ = "intensity_units"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    abbreviation = Column(String)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

class MuscleGroup(Base):
    __tablename__ = "muscle_groups"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

class Muscle(Base):
    __tablename__ = "muscles"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    muscle_group_id = Column(Integer, ForeignKey("muscle_groups.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    exercise_types = relationship("ExerciseType", secondary=exercise_types_muscles, back_populates="muscles")

class Recipe(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    workout_type_id = Column(Integer, ForeignKey("workout_types.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

class SetTemplate(Base):
    __tablename__ = "set_templates"
    id = Column(Integer, primary_key=True)
    reps = Column(Integer)
    intensity = Column(Float)
    intensity_unit_id = Column(Integer, ForeignKey("intensity_units.id"), nullable=False)
    exercise_template_id = Column(Integer, ForeignKey("exercise_templates.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

class WorkoutType(Base):
    __tablename__ = "workout_types"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

class Workout(Base):
    __tablename__ = "workouts"
    id = Column(Integer, primary_key=True)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    name = Column(String)
    notes = Column(Text)
    workout_type_id = Column(Integer, ForeignKey("workout_types.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # Relationship to User
    owner: Mapped["User"] = relationship("User", back_populates="workouts")
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
