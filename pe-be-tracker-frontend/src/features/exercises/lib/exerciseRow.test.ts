import { describe, expect, it } from "vitest";

import type { ExerciseSet, PersonalBestData } from "@/features/exercises/api";
import {
  calculateIsPersonalBest,
  getRirDescription,
  getRpeDescription,
} from "./exerciseRow";

describe("exerciseRow library", () => {
  describe("calculateIsPersonalBest", () => {
    const mockSet: ExerciseSet = {
      id: 1,
      exercise_id: 1,
      intensity: 100,
      intensity_unit_id: 1,
      reps: 5,
      rest_time_seconds: 60,
      done: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      type: "working",
    };

    const mockPB: PersonalBestData = {
      weight: 100,
      reps: 5,
      volume: 500,
      date: "2023-01-01T00:00:00Z",
    };

    it("should return false if personalBest is null", () => {
      expect(calculateIsPersonalBest(mockSet, 100, 5, null, null, null)).toBe(false);
    });

    it("should return false if set is not done", () => {
      const notDoneSet = { ...mockSet, done: false };
      expect(calculateIsPersonalBest(notDoneSet, 100, 5, null, mockPB, 100)).toBe(false);
    });

    it("should return true if current weight is higher than PB", () => {
      expect(calculateIsPersonalBest(mockSet, 105, 5, null, mockPB, 100)).toBe(true);
    });

    it("should return true if current weight is same but reps are higher", () => {
      expect(calculateIsPersonalBest(mockSet, 100, 6, null, mockPB, 100)).toBe(true);
    });

    it("should return false if weight and reps are same or lower", () => {
      expect(calculateIsPersonalBest(mockSet, 100, 5, null, mockPB, 100)).toBe(false);
      expect(calculateIsPersonalBest(mockSet, 95, 10, null, mockPB, 100)).toBe(false);
    });

    it("should handle floating point precision", () => {
      // 100.00001 should be same as 100 for PR detection if reps are same
      expect(calculateIsPersonalBest(mockSet, 100.00001, 5, null, mockPB, 100)).toBe(false);
      // But higher reps should still trigger PR
      expect(calculateIsPersonalBest(mockSet, 100.00001, 6, null, mockPB, 100)).toBe(true);
    });
  });

  describe("getRirDescription", () => {
    it("should return the correct label for integer values", () => {
      expect(getRirDescription(0)).toBe("Failure (no reps left)");
      expect(getRirDescription(1)).toBe("1 rep left");
      expect(getRirDescription(2)).toBe("2 reps left");
    });

    it("should handle the 'Maybe' logic for half increments", () => {
      expect(getRirDescription(0.5)).toBe("Maybe 1 left");
      expect(getRirDescription(1.5)).toBe("Maybe 2 left");
      expect(getRirDescription(2.5)).toBe("Maybe 3 left");
    });

    it("should handle the ceiling for 4+ reps", () => {
      expect(getRirDescription(4)).toBe("4+ reps left");
      expect(getRirDescription(5)).toBe("4+ reps left");
    });

    it("should return default for null", () => {
      expect(getRirDescription(null)).toBe("Slide up for higher effort");
    });
  });

  describe("getRpeDescription", () => {
    it("should return clear labels for common RPE values", () => {
      expect(getRpeDescription(10)).toBe("Max Effort");
      expect(getRpeDescription(9)).toBe("Very Hard");
      expect(getRpeDescription(8)).toBe("Hard");
      expect(getRpeDescription(7)).toBe("Moderate");
    });

    it("should return default for null", () => {
      expect(getRpeDescription(null)).toBe("Slide up for higher effort");
    });
  });
});
