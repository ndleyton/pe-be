"""add public profile fields to users

Revision ID: 20260424_0001
Revises: 0f4c6d7e8a9b
Create Date: 2026-04-24 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260424_0001"
down_revision: Union[str, None] = "0f4c6d7e8a9b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "users" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("users")}

    if "username" not in columns:
        op.add_column("users", sa.Column("username", sa.String(length=40), nullable=True))
    if "bio" not in columns:
        op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))
    if "avatar_url" not in columns:
        op.add_column("users", sa.Column("avatar_url", sa.Text(), nullable=True))
    if "is_profile_public" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "is_profile_public",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
        op.alter_column("users", "is_profile_public", server_default=None)

    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_username_unique" not in indexes:
        op.create_index("ix_users_username_unique", "users", ["username"], unique=True)


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "users" not in inspector.get_table_names():
        return

    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_username_unique" in indexes:
        op.drop_index("ix_users_username_unique", table_name="users")

    columns = {column["name"] for column in inspector.get_columns("users")}
    for column_name in ("is_profile_public", "avatar_url", "bio", "username"):
        if column_name in columns:
            op.drop_column("users", column_name)
