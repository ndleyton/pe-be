"""Remember guest import identities and bind sync keys to their payload."""

from alembic import op
import sqlalchemy as sa

revision = "20261117_0001"
down_revision = "20261012_0001"
branch_labels = None
depends_on = None

MAPPINGS = (
    ("guest_workout_mappings", "workout_id", "workouts.id"),
    ("guest_exercise_type_mappings", "exercise_type_id", "exercise_types.id"),
)


def _sync_log_columns(inspector):
    return {c["name"] for c in inspector.get_columns("sync_logs")}


def upgrade():
    inspector = sa.inspect(op.get_bind())
    for table, column, target in MAPPINGS:
        if not inspector.has_table(table):
            op.create_table(
                table,
                sa.Column("id", sa.Integer(), primary_key=True),
                sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
                sa.Column(
                    "user_id",
                    sa.Integer(),
                    sa.ForeignKey("users.id", ondelete="CASCADE"),
                    nullable=False,
                ),
                sa.Column("guest_id", sa.String(), nullable=False),
                sa.Column(
                    column,
                    sa.Integer(),
                    sa.ForeignKey(target, ondelete="CASCADE"),
                    nullable=False,
                ),
                sa.UniqueConstraint("user_id", "guest_id"),
            )
    if "request_fingerprint" not in _sync_log_columns(inspector):
        op.add_column(
            "sync_logs",
            sa.Column("request_fingerprint", sa.String(64), nullable=True),
        )


def downgrade():
    inspector = sa.inspect(op.get_bind())
    if "request_fingerprint" in _sync_log_columns(inspector):
        op.drop_column("sync_logs", "request_fingerprint")
    for table, _, _ in MAPPINGS:
        if inspector.has_table(table):
            op.drop_table(table)
