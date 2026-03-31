from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional


THREE_DECIMAL_PLACES = Decimal("0.001")


@dataclass(frozen=True)
class IntensityUnitDefinition:
    family: str
    to_base_factor: Decimal


_UNIT_DEFINITIONS = {
    "kg": IntensityUnitDefinition(family="mass", to_base_factor=Decimal("1")),
    "lbs": IntensityUnitDefinition(
        family="mass", to_base_factor=Decimal("0.45359237")
    ),
    "km/h": IntensityUnitDefinition(family="speed", to_base_factor=Decimal("1")),
    "mph": IntensityUnitDefinition(
        family="speed", to_base_factor=Decimal("1.609344")
    ),
    "bw": IntensityUnitDefinition(
        family="bodyweight", to_base_factor=Decimal("1")
    ),
}

_UNIT_ALIASES = {
    "kilograms": "kg",
    "kilogram": "kg",
    "kg": "kg",
    "pounds": "lbs",
    "pound": "lbs",
    "lbs": "lbs",
    "lb": "lbs",
    "kilometers per hour": "km/h",
    "kilometres per hour": "km/h",
    "km/h": "km/h",
    "miles per hour": "mph",
    "mile per hour": "mph",
    "mph": "mph",
    "bodyweight": "bw",
    "bw": "bw",
}


def _to_decimal(value: Decimal | float | int) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _normalize_unit_key(unit: Any) -> Optional[str]:
    if unit is None:
        return None

    if isinstance(unit, str):
        key = unit.strip().lower()
        return _UNIT_ALIASES.get(key, key)

    abbreviation = getattr(unit, "abbreviation", None)
    if isinstance(abbreviation, str):
        key = abbreviation.strip().lower()
        return _UNIT_ALIASES.get(key, key)

    name = getattr(unit, "name", None)
    if isinstance(name, str):
        key = name.strip().lower()
        return _UNIT_ALIASES.get(key, key)

    return None


def are_intensity_units_compatible(source_unit: Any, target_unit: Any) -> bool:
    source_key = _normalize_unit_key(source_unit)
    target_key = _normalize_unit_key(target_unit)
    if not source_key or not target_key:
        return False

    source_definition = _UNIT_DEFINITIONS.get(source_key)
    target_definition = _UNIT_DEFINITIONS.get(target_key)
    if not source_definition or not target_definition:
        return False

    return source_definition.family == target_definition.family


def convert_intensity_value(
    value: Decimal | float | int | None,
    source_unit: Any,
    target_unit: Any,
) -> Optional[Decimal]:
    if value is None:
        return None

    decimal_value = _to_decimal(value)
    if source_unit is None or target_unit is None:
        return decimal_value

    source_key = _normalize_unit_key(source_unit)
    target_key = _normalize_unit_key(target_unit)
    if not source_key or not target_key:
        return decimal_value

    source_definition = _UNIT_DEFINITIONS.get(source_key)
    target_definition = _UNIT_DEFINITIONS.get(target_key)
    if not source_definition or not target_definition:
        return decimal_value

    if source_definition.family != target_definition.family:
        return decimal_value

    base_value = decimal_value * source_definition.to_base_factor
    converted_value = base_value / target_definition.to_base_factor
    return converted_value.quantize(THREE_DECIMAL_PLACES, rounding=ROUND_HALF_UP)
