"""Routine schema validation tests."""

import pytest
from pydantic import ValidationError

from src.routines.schemas import RoutineCreate, RoutineUpdate, SetTemplateCreate


def test_set_template_requires_intensity_unit():
    with pytest.raises(ValidationError):
        SetTemplateCreate()


def test_routine_create_rejects_empty_name():
    with pytest.raises(ValidationError, match="at least 1 character"):
        RoutineCreate(name="", workout_type_id=1)


def test_routine_create_rejects_name_over_255_chars():
    with pytest.raises(ValidationError, match="at most 255 characters"):
        RoutineCreate(name="a" * 256, workout_type_id=1)


def test_routine_create_requires_name_and_workout_type():
    with pytest.raises(ValidationError):
        RoutineCreate()


def test_routine_update_rejects_empty_name():
    with pytest.raises(ValidationError, match="at least 1 character"):
        RoutineUpdate(name="")
