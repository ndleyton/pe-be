from enum import Enum

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class MCPIdempotencyStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


class MCPIdempotencyRecord(Base):
    __tablename__ = "mcp_idempotency_records"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "operation",
            "idempotency_key",
            name="uq_mcp_idempotency_user_operation_key",
        ),
        Index("ix_mcp_idempotency_user_operation", "user_id", "operation"),
    )

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    operation: Mapped[str] = mapped_column(String(64), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[MCPIdempotencyStatus] = mapped_column(
        SAEnum(MCPIdempotencyStatus, name="mcp_idempotency_status"), nullable=False
    )
    result_entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    result_entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
