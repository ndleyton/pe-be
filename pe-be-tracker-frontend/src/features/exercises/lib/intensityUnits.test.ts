import { describe, expect, it } from "vitest";

import { KNOWN_INTENSITY_UNITS } from "@/features/exercises/constants";
import { makeExercise, makeExerciseSet, makeExerciseType } from "@/test/fixtures";

import {
  convertIntensityValue,
  getCompatibleIntensityUnits,
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

  it("prefers the exercise default intensity unit for display", () => {
    const exercise = makeExercise({
      exercise_type: makeExerciseType({ default_intensity_unit: 4 }),
      exercise_sets: [
        makeExerciseSet({
          intensity_unit_id: 3,
        }),
      ],
    });

    expect(
      resolveExerciseDisplayIntensityUnit(
        exercise,
        KNOWN_INTENSITY_UNITS,
        KNOWN_INTENSITY_UNITS[0],
      ).abbreviation,
    ).toBe("mph");
  });
});
