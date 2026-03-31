from decimal import Decimal
from types import SimpleNamespace

from src.exercises.intensity_units import (
    are_intensity_units_compatible,
    convert_intensity_value,
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
