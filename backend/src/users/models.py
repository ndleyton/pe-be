from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTable, SQLAlchemyBaseOAuthAccountTable

from src.core.database import Base


class OAuthAccount(SQLAlchemyBaseOAuthAccountTable[int], Base):
    """OAuth account model for user authentication"""
    __tablename__ = "oauth_accounts"

    # Explicitly define PK columns (WORKAROUND)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="cascade"), primary_key=True, nullable=False
    )
    oauth_name: Mapped[str] = mapped_column(
        String(length=100), index=True, primary_key=True, nullable=False
    )

    # Relationship back to the User
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