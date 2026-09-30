import { describe, expect, it } from "vitest";
import { getPersonalBestEntries, getSetPersonalBest } from "./personalBests";
import type { ExerciseTypeStats } from "@/features/exercises/api";

const left = { date: "2026-09-01", weight: 25, reps: 10, volume: 250 };
const right = { ...left, weight: 20, volume: 200 };
const both = { ...left, weight: 40, volume: 400 };
const stats: ExerciseTypeStats = {
  personalBest: null, sidePersonalBests: { left, right, both }, metricsVersion: 2,
  progressiveOverload: [], lastWorkout: null, totalSets: 3,
  intensityUnit: { id: 1, name: "Kilograms", abbreviation: "kg" },
};

describe("side personal bests", () => {
  it("lists all v2 records even when the legacy best is null", () => {
    expect(getPersonalBestEntries(stats)).toEqual([
      { label: "Left", best: left }, { label: "Right", best: right }, { label: "Both sides", best: both },
    ]);
  });
  it("compares only within the set's bucket, including the current null-as-both policy", () => {
    expect(getSetPersonalBest(stats, "left")).toBe(left);
    expect(getSetPersonalBest(stats, "right")).toBe(right);
    expect(getSetPersonalBest(stats, null)).toBe(both);
    expect(getSetPersonalBest({ personalBest: both, sidePersonalBests: { left } }, "right")).toBeNull();
  });
  it("preserves legacy records when no side buckets are supplied", () => {
    expect(getSetPersonalBest({ personalBest: both }, null)).toBe(both);
    expect(getPersonalBestEntries({ ...stats, sidePersonalBests: undefined, personalBest: both })).toEqual([{ label: "Personal Record", best: both }]);
  });
});
