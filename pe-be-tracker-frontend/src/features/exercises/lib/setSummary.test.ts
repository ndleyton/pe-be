import { describe, expect, it } from "vitest";

import { formatSetSummary } from "./setSummary";

describe("formatSetSummary", () => {
  it("formats rep-based sets", () => {
    expect(
      formatSetSummary({
        reps: 8,
        intensity: 100,
        intensityUnitAbbreviation: "kg",
      }),
    ).toBe("8 reps @ 100 kg");
  });

  it("formats duration-based sets with intensity", () => {
    expect(
      formatSetSummary({
        duration_seconds: 1200,
        intensity: 10,
        intensityUnitAbbreviation: "km/h",
      }),
    ).toBe("20:00 @ 10 km/h");
  });

  it("formats duration-only sets", () => {
    expect(
      formatSetSummary({
        duration_seconds: 45,
      }),
    ).toBe("00:45");
  });

  it("does not append placeholder intensity segments", () => {
    expect(
      formatSetSummary({
        reps: 8,
        intensity: 0,
        intensityUnitAbbreviation: "kg",
      }),
    ).toBe("8 reps");
  });
});
