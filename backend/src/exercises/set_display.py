from __future__ import annotations

from decimal import Decimal
from typing import Optional


def format_duration_seconds(duration_seconds: int | None) -> str | None:
    if duration_seconds is None:
        return None

    if duration_seconds % 60 == 0:
        minutes = duration_seconds // 60
        unit = "min" if minutes == 1 else "min"
        return f"{minutes} {unit}"

    return f"{duration_seconds} sec"


def _format_intensity(
    intensity: Decimal | int | float | None,
    intensity_unit_abbreviation: Optional[str],
) -> str | None:
    if intensity is None:
        return None

    if intensity_unit_abbreviation:
        return f"{intensity} {intensity_unit_abbreviation}"

    return str(intensity)


def _format_rpe(rpe: Decimal | int | float | None) -> str | None:
    if rpe is None:
        return None

    return f"RPE {rpe}"


def _format_rir(rir: Decimal | int | float | None) -> str | None:
    if rir is None:
        return None

    return f"RIR {rir}"


def format_set_summary(
    *,
    reps: int | None,
    duration_seconds: int | None,
    intensity: Decimal | int | float | None,
    rpe: Decimal | int | float | None,
    rir: Decimal | int | float | None,
    intensity_unit_abbreviation: Optional[str],
) -> str:
    lead = None

    if duration_seconds is not None:
        lead = format_duration_seconds(duration_seconds)
    elif reps is not None:
        lead = f"{reps} reps"

    intensity_display = _format_intensity(intensity, intensity_unit_abbreviation)
    rpe_display = _format_rpe(rpe)
    rir_display = _format_rir(rir)

    parts = []
    if lead:
        parts.append(lead)
    if intensity_display:
        parts.append(f"at {intensity_display}" if lead else intensity_display)
    if rpe_display:
        parts.append(rpe_display)
    if rir_display:
        parts.append(rir_display)

    if parts:
        return " ".join(parts)
    return "No targets set"
