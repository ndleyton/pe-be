from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, Table, UniqueConstraint
)
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

# Association tables (no primary key)
exercise_types_muscles = Table(
    "exercise_types_muscles", Base.metadata,
    Column("exercise_type_id", Integer, ForeignKey("exercise_types.id"), primary_key=True),
    Column("muscle_id", Integer, ForeignKey("muscles.id"), primary_key=True)
)

class ExerciseMuscle(Base):
    __tablename__ = "exercise_muscles"
    id = Column(Integer, primary_key=True)
    exercise_type_id = Column(Integer, ForeignKey("exercise_types.id"), nullable=False)
    muscle_id = Column(Integer, ForeignKey("muscles.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class ExerciseTemplate(Base):
    __tablename__ = "exercise_templates"
    id = Column(Integer, primary_key=True)
    exercise_type_id = Column(Integer, ForeignKey("exercise_types.id"), nullable=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class ExerciseType(Base):
    __tablename__ = "exercise_types"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    default_intensity_unit = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    muscles = relationship("Muscle", secondary=exercise_types_muscles, back_populates="exercise_types")

class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime)
    notes = Column(Text)
    exercise_type_id = Column(Integer, ForeignKey("exercise_types.id"), nullable=False)
    workout_id = Column(Integer, ForeignKey("workouts.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class IntensityUnit(Base):
    __tablename__ = "intensity_units"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    abbreviation = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class MuscleGroup(Base):
    __tablename__ = "muscle_groups"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Muscle(Base):
    __tablename__ = "muscles"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    muscle_group_id = Column(Integer, ForeignKey("muscle_groups.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    exercise_types = relationship("ExerciseType", secondary=exercise_types_muscles, back_populates="muscles")

class Recipe(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    workout_type_id = Column(Integer, ForeignKey("workout_types.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class SetTemplate(Base):
    __tablename__ = "set_templates"
    id = Column(Integer, primary_key=True)
    reps = Column(Integer)
    intensity = Column(Float)
    intensity_unit_id = Column(Integer, ForeignKey("intensity_units.id"), nullable=False)
    exercise_template_id = Column(Integer, ForeignKey("exercise_templates.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    email = Column(String, unique=True)
    encrypted_password = Column(String, default="", nullable=False)
    reset_password_token = Column(String, unique=True)
    reset_password_sent_at = Column(DateTime)
    remember_created_at = Column(DateTime)
    provider = Column(String)
    uid = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class WorkoutType(Base):
    __tablename__ = "workout_types"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Workout(Base):
    __tablename__ = "workouts"
    id = Column(Integer, primary_key=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    name = Column(String)
    notes = Column(Text)
    workout_type_id = Column(Integer, ForeignKey("workout_types.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
