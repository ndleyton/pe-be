import pytest
from sqlalchemy.exc import IntegrityError

from src.core.errors import DomainValidationError, ValidationErrorCode
from src.exercise_sets.crud import (
    _get_constraint_name as get_exercise_set_constraint_name,
    _map_exercise_set_integrity_error,
)
from src.exercises.crud import (
    _get_constraint_name as get_exercise_constraint_name,
    _map_exercise_integrity_error,
)
from src.routines.crud import (
    _get_constraint_name as get_routine_constraint_name,
    _map_routine_integrity_error,
)
from src.workouts.crud import (
    _get_constraint_name as get_workout_constraint_name,
    _map_workout_integrity_error,
)


_UNSET = object()


class _Diag:
    def __init__(self, constraint_name):
        self.constraint_name = constraint_name


class _Orig(Exception):
    def __init__(
        self,
        message: str,
        *,
        constraint_name=_UNSET,
        diag_constraint_name=_UNSET,
    ):
        super().__init__(message)
        if constraint_name is not _UNSET:
            self.constraint_name = constraint_name
        if diag_constraint_name is not _UNSET:
            self.diag = _Diag(diag_constraint_name)


def _integrity_error(
    *,
    message: str = "integrity error",
    constraint_name=_UNSET,
    diag_constraint_name=_UNSET,
    orig_none: bool = False,
) -> IntegrityError:
    if orig_none:
        return IntegrityError("INSERT", {}, None)

    return IntegrityError(
        "INSERT",
        {},
        _Orig(
            message,
            constraint_name=constraint_name,
            diag_constraint_name=diag_constraint_name,
        ),
    )


def test_domain_validation_error_factories():
    invalid_reference = DomainValidationError.invalid_reference(field="workout_type_id")
    assert invalid_reference.code == ValidationErrorCode.INVALID_REFERENCE
    assert invalid_reference.field == "workout_type_id"
    assert invalid_reference.message == "workout_type_id is invalid"
    assert str(invalid_reference) == "workout_type_id is invalid"

    invalid_range = DomainValidationError.invalid_range(field="end_time")
    assert invalid_range.code == ValidationErrorCode.INVALID_RANGE
    assert invalid_range.field == "end_time"
    assert invalid_range.message == "end_time is out of range"
    assert str(invalid_range) == "end_time is out of range"


@pytest.mark.parametrize(
    "constraint_getter",
    [
        get_workout_constraint_name,
        get_routine_constraint_name,
        get_exercise_constraint_name,
        get_exercise_set_constraint_name,
    ],
)
def test_get_constraint_name_prefers_diag_value(constraint_getter):
    error = _integrity_error(
        message="violates foreign key",
        constraint_name="from_orig",
        diag_constraint_name="from_diag",
    )
    assert constraint_getter(error) == "from_diag"


@pytest.mark.parametrize(
    "constraint_getter",
    [
        get_workout_constraint_name,
        get_routine_constraint_name,
        get_exercise_constraint_name,
        get_exercise_set_constraint_name,
    ],
)
def test_get_constraint_name_falls_back_to_orig(constraint_getter):
    error = _integrity_error(
        message="violates foreign key",
        constraint_name="from_orig",
    )
    assert constraint_getter(error) == "from_orig"


@pytest.mark.parametrize(
    "constraint_getter",
    [
        get_workout_constraint_name,
        get_routine_constraint_name,
        get_exercise_constraint_name,
        get_exercise_set_constraint_name,
    ],
)
def test_get_constraint_name_returns_none_when_missing(constraint_getter):
    error = _integrity_error(orig_none=True)
    assert constraint_getter(error) is None


@pytest.mark.parametrize(
    ("constraint_name", "message", "expected_code", "expected_field"),
    [
        (
            "ck_workouts_end_time_gte_start_time",
            "violates check",
            ValidationErrorCode.INVALID_RANGE,
            "end_time",
        ),
        (
            _UNSET,
            'violates CHECK constraint "ck_workouts_end_time_gte_start_time"',
            ValidationErrorCode.INVALID_RANGE,
            "end_time",
        ),
        (
            "fk_workouts_workout_type_id_workout_types",
            "violates foreign key",
            ValidationErrorCode.INVALID_REFERENCE,
            "workout_type_id",
        ),
        (
            "workouts_workout_type_id_fkey",
            "violates foreign key",
            ValidationErrorCode.INVALID_REFERENCE,
            "workout_type_id",
        ),
        (
            _UNSET,
            "Key (workout_type_id)=(999) is not present (FOREIGN KEY constraint)",
            ValidationErrorCode.INVALID_REFERENCE,
            "workout_type_id",
        ),
    ],
)
def test_map_workout_integrity_error(
    constraint_name, message, expected_code, expected_field
):
    error = _integrity_error(message=message, constraint_name=constraint_name)
    mapped = _map_workout_integrity_error(error)
    assert mapped is not None
    assert mapped.code == expected_code
    assert mapped.field == expected_field


def test_map_workout_integrity_error_returns_none_for_unknown():
    mapped = _map_workout_integrity_error(
        _integrity_error(
            message="random db error", constraint_name="some_other_constraint"
        )
    )
    assert mapped is None


@pytest.mark.parametrize(
    ("constraint_name", "message", "expected_field"),
    [
        ("fk_recipes_workout_type_id_workout_types", "fk violation", "workout_type_id"),
        ("recipes_workout_type_id_fkey", "fk violation", "workout_type_id"),
        (
            _UNSET,
            "workout_type_id violates foreign key constraint",
            "workout_type_id",
        ),
        (
            "fk_exercise_templates_exercise_type_id_exercise_types",
            "fk violation",
            "exercise_templates.exercise_type_id",
        ),
        (
            "exercise_templates_exercise_type_id_fkey",
            "fk violation",
            "exercise_templates.exercise_type_id",
        ),
        (
            _UNSET,
            "exercise_type_id violates foreign key constraint",
            "exercise_templates.exercise_type_id",
        ),
        (
            "fk_set_templates_intensity_unit_id_intensity_units",
            "fk violation",
            "exercise_templates.set_templates.intensity_unit_id",
        ),
        (
            "set_templates_intensity_unit_id_fkey",
            "fk violation",
            "exercise_templates.set_templates.intensity_unit_id",
        ),
        (
            _UNSET,
            "intensity_unit_id violates foreign key constraint",
            "exercise_templates.set_templates.intensity_unit_id",
        ),
    ],
)
def test_map_routine_integrity_error(constraint_name, message, expected_field):
    mapped = _map_routine_integrity_error(
        _integrity_error(message=message, constraint_name=constraint_name)
    )
    assert mapped is not None
    assert mapped.code == ValidationErrorCode.INVALID_REFERENCE
    assert mapped.field == expected_field


def test_map_routine_integrity_error_returns_none_for_unknown():
    mapped = _map_routine_integrity_error(
        _integrity_error(message="random db error", constraint_name="unknown")
    )
    assert mapped is None


@pytest.mark.parametrize(
    ("constraint_name", "message", "expected_field"),
    [
        (
            "fk_exercises_exercise_type_id_exercise_types",
            "fk violation",
            "exercise_type_id",
        ),
        ("exercises_exercise_type_id_fkey", "fk violation", "exercise_type_id"),
        (
            _UNSET,
            "exercise_type_id violates foreign key constraint",
            "exercise_type_id",
        ),
        ("fk_exercises_workout_id_workouts", "fk violation", "workout_id"),
        ("exercises_workout_id_fkey", "fk violation", "workout_id"),
        (_UNSET, "workout_id violates foreign key constraint", "workout_id"),
    ],
)
def test_map_exercise_integrity_error(constraint_name, message, expected_field):
    mapped = _map_exercise_integrity_error(
        _integrity_error(message=message, constraint_name=constraint_name)
    )
    assert mapped is not None
    assert mapped.code == ValidationErrorCode.INVALID_REFERENCE
    assert mapped.field == expected_field


def test_map_exercise_integrity_error_returns_none_for_unknown():
    mapped = _map_exercise_integrity_error(
        _integrity_error(message="random db error", constraint_name="unknown")
    )
    assert mapped is None


@pytest.mark.parametrize(
    ("constraint_name", "message", "expected_field"),
    [
        (
            "fk_exercise_sets_intensity_unit_id_intensity_units",
            "fk violation",
            "intensity_unit_id",
        ),
        (
            "exercise_sets_intensity_unit_id_fkey",
            "fk violation",
            "intensity_unit_id",
        ),
        (
            _UNSET,
            "intensity_unit_id violates foreign key constraint",
            "intensity_unit_id",
        ),
        ("fk_exercise_sets_exercise_id_exercises", "fk violation", "exercise_id"),
        ("exercise_sets_exercise_id_fkey", "fk violation", "exercise_id"),
        (_UNSET, "exercise_id violates foreign key constraint", "exercise_id"),
    ],
)
def test_map_exercise_set_integrity_error(constraint_name, message, expected_field):
    mapped = _map_exercise_set_integrity_error(
        _integrity_error(message=message, constraint_name=constraint_name)
    )
    assert mapped is not None
    assert mapped.code == ValidationErrorCode.INVALID_REFERENCE
    assert mapped.field == expected_field


def test_map_exercise_set_integrity_error_returns_none_for_unknown():
    mapped = _map_exercise_set_integrity_error(
        _integrity_error(message="random db error", constraint_name="unknown")
    )
    assert mapped is None
