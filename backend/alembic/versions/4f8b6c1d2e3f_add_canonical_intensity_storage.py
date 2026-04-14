"""add canonical intensity storage

Revision ID: 4f8b6c1d2e3f
Revises: 3c4d5e6f7a8b
Create Date: 2026-03-31 02:00:00.000000
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4f8b6c1d2e3f"
down_revision: Union[str, None] = "b2be93819887"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FIVE_DECIMAL_PLACES = Decimal("0.00001")

UNIT_ALIASES = {
    "kg": "kg",
    "kilogram": "kg",
    "kilograms": "kg",
    "lb": "lbs",
    "lbs": "lbs",
    "pound": "lbs",
    "pounds": "lbs",
    "km/h": "km/h",
    "kilometers per hour": "km/h",
    "kilometres per hour": "km/h",
    "mph": "mph",
    "mile per hour": "mph",
    "miles per hour": "mph",
    "bw": "bw",
    "bodyweight": "bw",
}

UNIT_FACTORS = {
    "kg": ("kg", Decimal("1")),
    "lbs": ("kg", Decimal("0.45359237")),
    "km/h": ("km/h", Decimal("1")),
    "mph": ("km/h", Decimal("1.609344")),
    "bw": ("bw", Decimal("1")),
}


def _normalize_unit_key(value: str | None) -> str | None:
    if not value:
        return None
    return UNIT_ALIASES.get(value.strip().lower())


def _table_names(inspector: sa.Inspector) -> set[str]:
    return set(inspector.get_table_names())


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _foreign_key_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {
        fk["name"]
        for fk in inspector.get_foreign_keys(table_name)
        if fk.get("name") is not None
    }


def _load_unit_maps(connection) -> tuple[dict[str, int], dict[int, str]]:
    rows = connection.execute(
        sa.text("SELECT id, name, abbreviation FROM intensity_units")
    ).mappings()

    unit_id_by_key: dict[str, int] = {}
    unit_key_by_id: dict[int, str] = {}

    for row in rows:
        normalized_keys = [
            _normalize_unit_key(row.get("abbreviation")),
            _normalize_unit_key(row.get("name")),
        ]
        for key in normalized_keys:
            if key is None:
                continue
            unit_id_by_key.setdefault(key, row["id"])
            unit_key_by_id[row["id"]] = key

    return unit_id_by_key, unit_key_by_id


def _canonicalize_intensity(
    *,
    intensity,
    intensity_unit_id: int,
    unit_id_by_key: dict[str, int],
    unit_key_by_id: dict[int, str],
) -> tuple[Decimal | None, int]:
    decimal_intensity = (
        None
        if intensity is None
        else Decimal(str(intensity)).quantize(FIVE_DECIMAL_PLACES)
    )
    unit_key = unit_key_by_id.get(intensity_unit_id)
    if unit_key is None:
        return decimal_intensity, intensity_unit_id

    canonical_key, factor = UNIT_FACTORS.get(unit_key, (unit_key, Decimal("1")))
    canonical_unit_id = unit_id_by_key.get(canonical_key, intensity_unit_id)

    if decimal_intensity is None:
        return None, canonical_unit_id

    return (
        (decimal_intensity * factor).quantize(
            FIVE_DECIMAL_PLACES, rounding=ROUND_HALF_UP
        ),
        canonical_unit_id,
    )


def _add_canonical_columns(table_name: str) -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = _column_names(inspector, table_name)

    if "canonical_intensity" not in columns:
        op.add_column(
            table_name,
            sa.Column(
                "canonical_intensity", sa.Numeric(precision=10, scale=5), nullable=True
            ),
        )

    if "canonical_intensity_unit_id" not in columns:
        op.add_column(
            table_name,
            sa.Column("canonical_intensity_unit_id", sa.Integer(), nullable=True),
        )


def _add_canonical_fk(table_name: str, constraint_name: str) -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    foreign_keys = _foreign_key_names(inspector, table_name)
    if constraint_name not in foreign_keys:
        op.create_foreign_key(
            constraint_name,
            table_name,
            "intensity_units",
            ["canonical_intensity_unit_id"],
            ["id"],
            ondelete="RESTRICT",
        )


def _backfill_table(table_name: str) -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    if table_name not in _table_names(inspector):
        return

    columns = _column_names(inspector, table_name)
    if (
        "canonical_intensity" not in columns
        or "canonical_intensity_unit_id" not in columns
    ):
        return

    unit_id_by_key, unit_key_by_id = _load_unit_maps(connection)
    rows = connection.execute(
        sa.text(
            f"""
            SELECT id, intensity, intensity_unit_id
            FROM {table_name}
            """
        )
    ).mappings()

    for row in rows:
        canonical_intensity, canonical_intensity_unit_id = _canonicalize_intensity(
            intensity=row["intensity"],
            intensity_unit_id=row["intensity_unit_id"],
            unit_id_by_key=unit_id_by_key,
            unit_key_by_id=unit_key_by_id,
        )
        connection.execute(
            sa.text(
                f"""
                UPDATE {table_name}
                SET canonical_intensity = :canonical_intensity,
                    canonical_intensity_unit_id = :canonical_intensity_unit_id
                WHERE id = :id
                """
            ),
            {
                "id": row["id"],
                "canonical_intensity": canonical_intensity,
                "canonical_intensity_unit_id": canonical_intensity_unit_id,
            },
        )


def _drop_fk_if_exists(table_name: str, constraint_name: str) -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    foreign_keys = _foreign_key_names(inspector, table_name)
    if constraint_name in foreign_keys:
        op.drop_constraint(constraint_name, table_name, type_="foreignkey")


def _drop_column_if_exists(table_name: str, column_name: str) -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = _column_names(inspector, table_name)
    if column_name in columns:
        op.drop_column(table_name, column_name)


def upgrade() -> None:
    """Add canonical storage columns and backfill them from existing intensity data."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    table_names = _table_names(inspector)

    if "exercise_sets" in table_names:
        _add_canonical_columns("exercise_sets")
        _add_canonical_fk(
            "exercise_sets",
            "fk_exercise_sets_canonical_intensity_unit_id_intensity_units",
        )
        _backfill_table("exercise_sets")

    if "set_templates" in table_names:
        _add_canonical_columns("set_templates")
        _add_canonical_fk(
            "set_templates",
            "fk_set_templates_canonical_intensity_unit_id_intensity_units",
        )
        _backfill_table("set_templates")


def downgrade() -> None:
    """Remove canonical intensity storage columns."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    table_names = _table_names(inspector)

    if "exercise_sets" in table_names:
        _drop_fk_if_exists(
            "exercise_sets",
            "fk_exercise_sets_canonical_intensity_unit_id_intensity_units",
        )
        _drop_column_if_exists("exercise_sets", "canonical_intensity_unit_id")
        _drop_column_if_exists("exercise_sets", "canonical_intensity")

    if "set_templates" in table_names:
        _drop_fk_if_exists(
            "set_templates",
            "fk_set_templates_canonical_intensity_unit_id_intensity_units",
        )
        _drop_column_if_exists("set_templates", "canonical_intensity_unit_id")
        _drop_column_if_exists("set_templates", "canonical_intensity")
