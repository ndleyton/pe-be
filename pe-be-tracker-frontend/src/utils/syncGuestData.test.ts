import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncGuestDataToServer } from "./syncGuestData";
import { endpoints } from "@/shared/api/endpoints";
import type { GuestData } from "@/stores/useGuestStore";
import {
  makeGuestData,
  makeGuestExercise,
  makeGuestExerciseSet,
  makeGuestExerciseType,
  makeGuestWorkout,
  makeGuestWorkoutType,
} from "@/test/fixtures";

// Mock the API client
vi.mock("@/shared/api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock the date utility
vi.mock("@/utils/date", () => ({
  toUTCISOString: vi.fn((date) => date),
}));

import api from "@/shared/api/client";

describe("syncGuestDataToServer", () => {
  const mockClearGuestData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when no guest data to sync", async () => {
    const emptyGuestData: GuestData = makeGuestData({ workouts: [] });

    const result = await syncGuestDataToServer(
      emptyGuestData,
      mockClearGuestData,
    );

    expect(result).toEqual({
      success: true,
      syncedWorkouts: 0,
      syncedExercises: 0,
      syncedSets: 0,
      syncedRoutines: 0,
    });
    expect(mockClearGuestData).not.toHaveBeenCalled();
  });

  it("syncs all data in a single bulk request successfully", async () => {
    const workoutType = makeGuestWorkoutType({
      id: "guest-wt-1",
      name: "Strength Training",
    });
    const exerciseType = makeGuestExerciseType({
      id: "guest-et-1",
      name: "Push-ups",
      default_intensity_unit: 1,
    });
    const exercise = makeGuestExercise({
      id: "guest-exercise-1",
      timestamp: "2023-01-01T10:30:00Z",
      exercise_type: exerciseType,
      exercise_type_id: exerciseType.id,
      workout_id: "guest-workout-1",
      exercise_sets: [
        makeGuestExerciseSet({
          id: "guest-set-1",
          reps: 10,
          intensity_unit_id: 1,
          exercise_id: "guest-exercise-1",
          done: true,
        }),
      ],
    });
    const mockGuestData: GuestData = makeGuestData({
      workouts: [
        makeGuestWorkout({
          id: "guest-workout-1",
          name: "Test Workout",
          start_time: "2023-01-01T10:00:00Z",
          workout_type: workoutType,
          workout_type_id: workoutType.id,
          exercises: [exercise],
        }),
      ],
      exerciseTypes: [exerciseType],
      workoutTypes: [workoutType]
    });

    // Mock successful bulk sync response
    (api.post as any).mockResolvedValueOnce({
      data: {
        success: true,
        syncedWorkouts: 1,
        syncedExercises: 1,
        syncedSets: 1,
        syncedRoutines: 0
      }
    });

    const result = await syncGuestDataToServer(
      mockGuestData,
      mockClearGuestData,
    );

    expect(result).toEqual({
      success: true,
      syncedWorkouts: 1,
      syncedExercises: 1,
      syncedSets: 1,
      syncedRoutines: 0,
    });

    expect(mockClearGuestData).toHaveBeenCalled();

    // Verify correct bulk payload was sent
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(
      endpoints.sync,
      expect.objectContaining({
        workouts: expect.arrayContaining([
          expect.objectContaining({
            id: "guest-workout-1",
            exercises: expect.arrayContaining([
              expect.objectContaining({
                id: "guest-exercise-1",
                exercise_sets: expect.arrayContaining([
                  expect.objectContaining({ id: "guest-set-1" }),
                ]),
              }),
            ]),
          }),
        ]),
        exerciseTypes: expect.arrayContaining([
          expect.objectContaining({ id: "guest-et-1" }),
        ]),
        workoutTypes: expect.arrayContaining([
          expect.objectContaining({ id: "guest-wt-1" }),
        ]),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Idempotency-Key": expect.any(String),
        }),
      }),
    );
  });

  it("handles bulk sync failure gracefully", async () => {
    const mockGuestData: GuestData = makeGuestData({
        workouts: [makeGuestWorkout({ id: "w1" })]
    });

    // Mock API to throw an error
    (api.post as any).mockRejectedValue(new Error("Network error"));

    const result = await syncGuestDataToServer(
      mockGuestData,
      mockClearGuestData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
    expect(mockClearGuestData).not.toHaveBeenCalled();
  });

  it("handles successful response with success=false", async () => {
    const mockGuestData: GuestData = makeGuestData({
        workouts: [makeGuestWorkout({ id: "w1" })]
    });

    (api.post as any).mockResolvedValueOnce({
        data: {
          success: false,
          error: "Database transaction failed"
        }
      });

    const result = await syncGuestDataToServer(
      mockGuestData,
      mockClearGuestData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database transaction failed");
    expect(mockClearGuestData).not.toHaveBeenCalled();
  });
});
