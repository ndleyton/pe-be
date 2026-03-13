from typing import List, Optional, TYPE_CHECKING

from src.workouts.models import Workout
from src.routines.models import Recipe

from sqlalchemy import Integer, String, ForeignKey
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
        Integer, ForeignKey("users.id", ondelete="cascade"), nullable=False
    )

    # Add user relationship
    user: Mapped["User"] = relationship("User", back_populates="oauth_accounts")


class User(SQLAlchemyBaseUserTable[int], Base):
    """User model for application users"""

    __tablename__ = "users"

    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    oauth_accounts: Mapped[List[OAuthAccount]] = relationship(
        "OAuthAccount", lazy="joined", back_populates="user"
    )

    # Forward reference for workouts (will be imported by workouts domain)
    workouts: Mapped[List["Workout"]] = relationship(back_populates="owner")

    # Forward reference for recipes (will be imported by recipes domain)
    recipes: Mapped[List["Recipe"]] = relationship(back_populates="creator")

    # Forward reference for conversations (will be imported by chat domain)
    conversations: Mapped[List["Conversation"]] = relationship(back_populates="user")
