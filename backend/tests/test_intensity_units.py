from decimal import Decimal
from types import SimpleNamespace

from src.exercises.intensity_units import (
    are_intensity_units_compatible,
    convert_intensity_value,
    normalize_intensity_for_storage,
)


def test_convert_intensity_value_between_known_units():
    pounds = SimpleNamespace(name="Pounds", abbreviation="lbs")
    kilograms = SimpleNamespace(name="Kilograms", abbreviation="kg")
    mph = SimpleNamespace(name="Miles per hour", abbreviation="mph")
    kmh = SimpleNamespace(name="Kilometers per hour", abbreviation="km/h")

    assert convert_intensity_value(100, kilograms, pounds) == Decimal("220.462")
    assert convert_intensity_value(10, mph, kmh) == Decimal("16.093")


def test_are_intensity_units_compatible_checks_unit_families():
    kilograms = SimpleNamespace(name="Kilograms", abbreviation="kg")
    pounds = SimpleNamespace(name="Pounds", abbreviation="lbs")
    bodyweight = SimpleNamespace(name="Bodyweight", abbreviation="BW")

    assert are_intensity_units_compatible(kilograms, pounds) is True
    assert are_intensity_units_compatible(kilograms, bodyweight) is False


def test_normalize_intensity_for_storage_uses_canonical_family_units():
    pounds = SimpleNamespace(name="Pounds", abbreviation="lbs")
    mph = SimpleNamespace(name="Miles per hour", abbreviation="mph")

    assert normalize_intensity_for_storage(225, pounds) == (
        Decimal("102.05828"),
        "kg",
    )
    assert normalize_intensity_for_storage(10, mph) == (
        Decimal("16.09344"),
        "km/h",
    )
