"""add MCP PAT, idempotency, and user timezone support

Revision ID: 20260902_0001
Revises: 3a6db27a297a
Create Date: 2026-09-02
"""

import logging
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260902_0001"
down_revision: Union[str, None] = "3a6db27a297a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OWNERSHIP_MARKER = "alembic:20260902_0001"
_logger = logging.getLogger(__name__)


def _columns(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _column_comment(
    inspector: sa.Inspector, table_name: str, column_name: str
) -> str | None:
    for column in inspector.get_columns(table_name):
        if column["name"] == column_name:
            return column.get("comment")
    return None


def _table_comment(inspector: sa.Inspector, table_name: str) -> str | None:
    return inspector.get_table_comment(table_name).get("text")


def _enum_exists(connection: sa.Connection, enum_name: str) -> bool:
    return bool(
        connection.scalar(
            sa.text(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_type AS type
                    JOIN pg_namespace AS namespace
                      ON namespace.oid = type.typnamespace
                    WHERE type.typname = :enum_name
                      AND type.typtype = 'e'
                      AND namespace.nspname = current_schema()
                )
                """
            ),
            {"enum_name": enum_name},
        )
    )


def _enum_comment(connection: sa.Connection, enum_name: str) -> str | None:
    return connection.scalar(
        sa.text(
            """
            SELECT obj_description(type.oid, 'pg_type')
            FROM pg_type AS type
            JOIN pg_namespace AS namespace
              ON namespace.oid = type.typnamespace
            WHERE type.typname = :enum_name
              AND type.typtype = 'e'
              AND namespace.nspname = current_schema()
            """
        ),
        {"enum_name": enum_name},
    )


def _enum_referenced_by_columns(
    connection: sa.Connection, enum_name: str, table_name: str | None = None
) -> bool:
    query = """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND (udt_name = :enum_name OR udt_name = '_' || :enum_name)
    """
    params: dict[str, str] = {"enum_name": enum_name}
    if table_name is not None:
        query += " AND table_name = :table_name"
        params["table_name"] = table_name
    query += "\n        )"
    return bool(connection.scalar(sa.text(query), params))


def _log_skipped_drop(artifact: str) -> None:
    _logger.warning(
        "Skipping removal of %s because it is not marked as created by "
        "revision 20260902_0001. Verify ownership before removing it manually.",
        artifact,
    )


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
        op.execute(
            f"COMMENT ON COLUMN users.timezone IS '{_OWNERSHIP_MARKER}'"
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
        op.execute(
            f"COMMENT ON TABLE personal_access_tokens IS '{_OWNERSHIP_MARKER}'"
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
        enum_already_existed = _enum_exists(connection, "mcp_idempotency_status")
        status_enum = postgresql.ENUM(
            "pending",
            "completed",
            "failed",
            name="mcp_idempotency_status",
            create_type=False,
        )
        status_enum.create(connection, checkfirst=True)
        if not enum_already_existed:
            op.execute(
                f"COMMENT ON TYPE mcp_idempotency_status IS '{_OWNERSHIP_MARKER}'"
            )
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
        op.execute(
            f"COMMENT ON TABLE mcp_idempotency_records IS '{_OWNERSHIP_MARKER}'"
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
        if _table_comment(inspector, "mcp_idempotency_records") == _OWNERSHIP_MARKER:
            op.drop_table("mcp_idempotency_records")
        else:
            _log_skipped_drop("table mcp_idempotency_records")

    inspector = sa.inspect(connection)
    preserved_records_depend_on_enum = (
        "mcp_idempotency_records" in inspector.get_table_names()
        and _enum_referenced_by_columns(
            connection, "mcp_idempotency_status", table_name="mcp_idempotency_records"
        )
    )

    if _enum_exists(connection, "mcp_idempotency_status"):
        if _enum_comment(connection, "mcp_idempotency_status") == _OWNERSHIP_MARKER:
            if preserved_records_depend_on_enum:
                _logger.warning(
                    "Skipping removal of enum mcp_idempotency_status because the "
                    "preserved mcp_idempotency_records table still depends on it."
                )
            elif _enum_referenced_by_columns(
                connection, "mcp_idempotency_status"
            ):
                _logger.warning(
                    "Skipping removal of enum mcp_idempotency_status because it is still "
                    "referenced by preserved tables or columns."
                )
            else:
                postgresql.ENUM(name="mcp_idempotency_status").drop(
                    connection, checkfirst=False
                )
        else:
            _log_skipped_drop("enum mcp_idempotency_status")

    inspector = sa.inspect(connection)
    if "personal_access_tokens" in inspector.get_table_names():
        if _table_comment(inspector, "personal_access_tokens") == _OWNERSHIP_MARKER:
            op.drop_table("personal_access_tokens")
        else:
            _log_skipped_drop("table personal_access_tokens")

    inspector = sa.inspect(connection)
    if "users" in inspector.get_table_names() and "timezone" in _columns(
        inspector, "users"
    ):
        if _column_comment(inspector, "users", "timezone") == _OWNERSHIP_MARKER:
            op.drop_column("users", "timezone")
        else:
            _log_skipped_drop("column users.timezone")
