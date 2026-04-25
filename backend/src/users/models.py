from typing import List, Optional, TYPE_CHECKING

from src.workouts.models import Workout
from src.routines.models import Routine

from sqlalchemy import Boolean, Index, Integer, String, Text, ForeignKey, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from fastapi_users_db_sqlalchemy import (
    SQLAlchemyBaseUserTable,
    SQLAlchemyBaseOAuthAccountTable,
)

from src.core.database import Base

if TYPE_CHECKING:
    from src.chat.models import Conversation


class OAuthAccount(SQLAlchemyBaseOAuthAccountTable[int], Base):
    """OAuth account model for user authentication"""

    __tablename__ = "oauth_accounts"

    # Add user_id foreign key that FastAPI-Users needs
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    # Add user relationship
    user: Mapped["User"] = relationship("User", back_populates="oauth_accounts")


class User(SQLAlchemyBaseUserTable[int], Base):
    """User model for application users"""

    __tablename__ = "users"

    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    __table_args__ = (Index("ix_users_username_unique", func.lower(username), unique=True),)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_profile_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # Relationships
    oauth_accounts: Mapped[List[OAuthAccount]] = relationship(
        "OAuthAccount", lazy="joined", back_populates="user"
    )

    # Forward reference for workouts (will be imported by workouts domain)
    workouts: Mapped[List["Workout"]] = relationship(back_populates="owner")

    # Forward reference for routines (backed by the legacy `recipes` table)
    routines: Mapped[List["Routine"]] = relationship(back_populates="creator")

    # Forward reference for conversations (will be imported by chat domain)
    conversations: Mapped[List["Conversation"]] = relationship(back_populates="user")
