from enum import Enum
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, String, Text, desc
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, relationship

from src.core.database import Base

if TYPE_CHECKING:
    from src.routines.models import Routine
    from src.users.models import User


class RoutineProgram(Base):
    """User-facing ordered collection of routine templates."""

    __tablename__ = "routine_programs"

    __table_args__ = (
        Index("ix_routine_programs_creator_visibility", "creator_id", "visibility"),
        Index(
            "ix_routine_programs_creator_created_at_desc",
            "creator_id",
            desc("created_at"),
        ),
        Index(
            "ix_routine_programs_visibility_created_at_desc",
            "visibility",
            desc("created_at"),
        ),
        Index("ix_routine_programs_category_visibility", "category", "visibility"),
        Index("ix_routine_programs_author_visibility", "author", "visibility"),
        Index("ix_routine_programs_times_used_desc", desc("times_used")),
    )

    class ProgramVisibility(str, Enum):
        private = "private"
        public = "public"
        link_only = "link_only"

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    creator_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    visibility = Column(
        SAEnum(ProgramVisibility, name="routine_program_visibility"),
        nullable=False,
        default=ProgramVisibility.private,
    )
    author = Column(String, nullable=True)
    category = Column(String, nullable=True)
    source_label = Column(String, nullable=True)
    is_readonly = Column(Boolean, default=False, nullable=False, server_default="false")
    times_used = Column(Integer, default=0, nullable=False, server_default="0")

    creator: Mapped["User"] = relationship("User", back_populates="routine_programs")
    days: Mapped[List["RoutineProgramDay"]] = relationship(
        "RoutineProgramDay",
        back_populates="program",
        cascade="all, delete-orphan",
        order_by="RoutineProgramDay.sort_order",
    )


class RoutineProgramDay(Base):
    """Ordered routine slot inside a routine program."""

    __tablename__ = "routine_program_days"

    __table_args__ = (
        Index("ix_routine_program_days_program_sort", "program_id", "sort_order"),
        Index("ix_routine_program_days_routine_id", "routine_id"),
        Index(
            "uq_routine_program_days_program_sort",
            "program_id",
            "sort_order",
            unique=True,
        ),
    )

    program_id = Column(
        Integer,
        ForeignKey("routine_programs.id", ondelete="CASCADE"),
        nullable=False,
    )
    routine_id = Column(
        Integer,
        ForeignKey("recipes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    day_label = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False)
    week_number = Column(Integer, nullable=True)
    phase_label = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    program: Mapped["RoutineProgram"] = relationship(
        "RoutineProgram", back_populates="days"
    )
    routine: Mapped["Routine"] = relationship("Routine", back_populates="program_days")
