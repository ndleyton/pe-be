"""add MCP PAT, idempotency, and user timezone support

Revision ID: 20260902_0001
Revises: 3a6db27a297a
Create Date: 2026-09-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260902_0001"
down_revision: Union[str, None] = "3a6db27a297a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = set(inspector.get_table_names())

    if "users" in tables and "timezone" not in _columns(inspector, "users"):
        op.add_column(
            "users",
            sa.Column(
                "timezone",
                sa.String(length=64),
                nullable=False,
                server_default="UTC",
            ),
        )

    if "personal_access_tokens" not in tables:
        op.create_table(
            "personal_access_tokens",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("token_prefix", sa.String(length=16), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("scopes", sa.JSON(), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token_hash"),
        )
        op.create_index(
            "ix_personal_access_tokens_prefix",
            "personal_access_tokens",
            ["token_prefix"],
        )
        op.create_index(
            "ix_personal_access_tokens_user_id",
            "personal_access_tokens",
            ["user_id"],
        )

    inspector = sa.inspect(connection)
    if "mcp_idempotency_records" not in inspector.get_table_names():
        status_enum = postgresql.ENUM(
            "pending",
            "completed",
            "failed",
            name="mcp_idempotency_status",
            create_type=False,
        )
        status_enum.create(connection, checkfirst=True)
        op.create_table(
            "mcp_idempotency_records",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("operation", sa.String(length=64), nullable=False),
            sa.Column("idempotency_key", sa.String(length=128), nullable=False),
            sa.Column("request_hash", sa.String(length=64), nullable=False),
            sa.Column(
                "status",
                status_enum,
                nullable=False,
            ),
            sa.Column("result_entity_type", sa.String(length=64), nullable=True),
            sa.Column("result_entity_id", sa.Integer(), nullable=True),
            sa.Column("result_payload", sa.JSON(), nullable=True),
            sa.Column("error_code", sa.String(length=64), nullable=True),
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id",
                "operation",
                "idempotency_key",
                name="uq_mcp_idempotency_user_operation_key",
            ),
        )
        op.create_index(
            "ix_mcp_idempotency_user_operation",
            "mcp_idempotency_records",
            ["user_id", "operation"],
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = set(inspector.get_table_names())

    if "mcp_idempotency_records" in tables:
        op.drop_table("mcp_idempotency_records")
    postgresql.ENUM(name="mcp_idempotency_status").drop(connection, checkfirst=True)

    inspector = sa.inspect(connection)
    if "personal_access_tokens" in inspector.get_table_names():
        op.drop_table("personal_access_tokens")

    inspector = sa.inspect(connection)
    if "users" in inspector.get_table_names() and "timezone" in _columns(
        inspector, "users"
    ):
        op.drop_column("users", "timezone")
