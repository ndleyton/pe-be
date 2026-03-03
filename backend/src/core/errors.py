from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ValidationErrorCode(str, Enum):
    INVALID_REFERENCE = "invalid_reference"
    INVALID_RANGE = "invalid_range"


@dataclass
class DomainValidationError(Exception):
    code: ValidationErrorCode
    message: str
    field: Optional[str] = None

    def __str__(self) -> str:
        return self.message

    @classmethod
    def invalid_reference(
        cls, *, field: str, message: Optional[str] = None
    ) -> "DomainValidationError":
        return cls(
            code=ValidationErrorCode.INVALID_REFERENCE,
            field=field,
            message=message or f"{field} is invalid",
        )

    @classmethod
    def invalid_range(
        cls, *, field: str, message: Optional[str] = None
    ) -> "DomainValidationError":
        return cls(
            code=ValidationErrorCode.INVALID_RANGE,
            field=field,
            message=message or f"{field} is out of range",
        )
