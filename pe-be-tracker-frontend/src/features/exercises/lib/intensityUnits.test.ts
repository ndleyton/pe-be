import { describe, expect, it } from "vitest";

import { KNOWN_INTENSITY_UNITS } from "@/features/exercises/constants";
import { makeExercise, makeExerciseSet, makeExerciseType } from "@/test/fixtures";

import {
  convertIntensityValue,
  getCompatibleIntensityUnits,
  prefersDurationForIntensityUnit,
  resolveExerciseDisplayIntensityUnit,
} from "./intensityUnits";

describe("intensityUnits", () => {
  it("converts interchangeable mass and speed units", () => {
    expect(convertIntensityValue(100, 1, 2)).toBe(220.462);
    expect(convertIntensityValue(10, 4, 3)).toBe(16.093);
  });

  it("filters the picker to compatible units", () => {
    expect(
      getCompatibleIntensityUnits(KNOWN_INTENSITY_UNITS, KNOWN_INTENSITY_UNITS[0]).map(
        (unit) => unit.abbreviation,
      ),
    ).toEqual(["kg", "lbs"]);
  });

  it("prefers the unit from the recorded sets for display over the exercise type default", () => {
    const exercise = makeExercise({
      exercise_type: makeExerciseType({ default_intensity_unit: 4 }), // mph
      exercise_sets: [
        makeExerciseSet({
          intensity_unit_id: 3, // km/h
        }),
      ],
    });

    expect(
      resolveExerciseDisplayIntensityUnit(
        exercise,
        KNOWN_INTENSITY_UNITS,
        KNOWN_INTENSITY_UNITS[0],
      ).abbreviation,
    ).toBe("km/h");
  });

  it("prefers duration defaults for speed units", () => {
    expect(prefersDurationForIntensityUnit(KNOWN_INTENSITY_UNITS[2])).toBe(true);
    expect(prefersDurationForIntensityUnit(KNOWN_INTENSITY_UNITS[3])).toBe(true);
    expect(prefersDurationForIntensityUnit(KNOWN_INTENSITY_UNITS[0])).toBe(false);
    expect(prefersDurationForIntensityUnit(3)).toBe(true);
    expect(prefersDurationForIntensityUnit(1)).toBe(false);
  });
});
