import { describe, expect, it } from "vitest";
import {
  migrateGuestData,
  normalizeGuestTimestamp,
} from "./guestStoreMigration";

describe("guestStoreMigration", () => {
  it("normalizes guest timestamps into UTC-friendly values", () => {
    expect(normalizeGuestTimestamp("")).toBeNull();
    expect(normalizeGuestTimestamp("  ")).toBeNull();
    expect(normalizeGuestTimestamp(null)).toBeNull();
    expect(normalizeGuestTimestamp(123)).toBe("123");
    expect(normalizeGuestTimestamp("2024-01-01T10:00:00-03:00")).toBe(
      "2024-01-01T13:00:00.000Z",
    );
  });

  it("normalizes nested workout timestamps and returns current guest fields", () => {
    const migrated = migrateGuestData({
      workouts: [
        {
          id: "workout-1",
          start_time: "2024-01-01T10:00:00-03:00",
          end_time: "",
          created_at: "2024-01-01T10:00:00-03:00",
          updated_at: "  ",
          exercises: [
            {
              id: "exercise-1",
              timestamp: "2024-01-01T10:15:00-03:00",
              created_at: "2024-01-01T10:15:00-03:00",
              updated_at: null,
              exercise_sets: [
                {
                  id: "set-1",
                  created_at: "2024-01-01T10:20:00-03:00",
                  updated_at: "",
                },
              ],
            },
          ],
        },
      ],
      recipes: [{ id: "legacy-recipe-1" }],
    });

    expect(migrated.workouts[0].start_time).toBe("2024-01-01T13:00:00.000Z");
    expect(migrated.workouts[0].end_time).toBeNull();
    expect(migrated.workouts[0].updated_at).toBeNull();
    expect(migrated.workouts[0].exercises[0].timestamp).toBe(
      "2024-01-01T13:15:00.000Z",
    );
    expect(migrated.workouts[0].exercises[0].exercise_sets[0].created_at).toBe(
      "2024-01-01T13:20:00.000Z",
    );
    expect(migrated.workouts[0].exercises[0].exercise_sets[0].updated_at).toBeNull();
    expect(migrated.exerciseTypes).toEqual([]);
    expect(migrated.workoutTypes).toEqual([]);
  });
});
