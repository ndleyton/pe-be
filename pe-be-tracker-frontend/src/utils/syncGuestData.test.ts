import { describe, it, expect, vi, beforeEach } from "vitest";
import { removeSyncedWorkouts, syncGuestDataToServer } from "./syncGuestData";
import { endpoints } from "@/shared/api/endpoints";
import type { GuestData } from "@/stores/useGuestStore";
import {
  makeGuestData,
  makeGuestExercise,
  makeGuestExerciseSet,
  makeGuestExerciseType,
  makeGuestWorkout,
  makeGuestWorkoutType,
  makeSyncResult,
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when no guest data to sync", async () => {
    const emptyGuestData: GuestData = makeGuestData({ workouts: [] });

    const result = await syncGuestDataToServer(
      emptyGuestData);

    expect(result).toEqual(makeSyncResult());
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
      mockGuestData);

    // Missing map/list fields from the server are treated as empty.
    expect(result).toEqual(
      makeSyncResult({ syncedWorkouts: 1, syncedExercises: 1, syncedSets: 1 }),
    );

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
      mockGuestData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
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
      mockGuestData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database transaction failed");
  });

  it("passes through the workout map, imported IDs and deleted IDs", async () => {
    (api.post as any).mockResolvedValueOnce({
      data: {
        success: false,
        error: "Workouts were deleted",
        deletedWorkoutIds: ["w1"],
        workoutIdMap: {},
        importedWorkoutIds: [],
      },
    });

    const result = await syncGuestDataToServer(
      makeGuestData({ workouts: [makeGuestWorkout({ id: "w1" })] }),
    );

    expect(result).toEqual(
      makeSyncResult({
        success: false,
        error: "Workouts were deleted",
        deletedWorkoutIds: ["w1"],
      }),
    );
  });
});

describe("removeSyncedWorkouts", () => {
  const makeWorkoutWithSet = (id: string, reps: number) =>
    makeGuestWorkout({
      id,
      exercises: [
        makeGuestExercise({
          id: `${id}-exercise`,
          workout_id: id,
          exercise_sets: [
            makeGuestExerciseSet({ id: `${id}-set`, reps }),
            makeGuestExerciseSet({ id: `${id}-set-2`, reps: 5 }),
          ],
        }),
      ],
    });

  const editReps = (workout: ReturnType<typeof makeGuestWorkout>, reps: number) => ({
    ...workout,
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      exercise_sets: exercise.exercise_sets.map((set, index) =>
        index === 0 ? { ...set, reps } : set,
      ),
    })),
  });

  const submitted = [makeWorkoutWithSet("a", 10), makeWorkoutWithSet("b", 10)];
  const snapshot = structuredClone(submitted);

  it("keeps a workout edited during sync even when imported, and removes the unchanged one", () => {
    const current = [structuredClone(submitted[0]), editReps(submitted[1], 12)];

    const remaining = removeSyncedWorkouts(
      current,
      snapshot,
      makeSyncResult({
        workoutIdMap: { a: 1, b: 2 },
        importedWorkoutIds: ["a", "b"],
      }),
    );

    expect(remaining.map((w) => w.id)).toEqual(["b"]);
    expect(remaining[0].exercises[0].exercise_sets[0].reps).toBe(12);
  });

  it("does not treat a mapping-only replay as confirmation of local edits", () => {
    const current = [submitted[0], editReps(submitted[1], 12)];

    const remaining = removeSyncedWorkouts(
      current,
      snapshot,
      makeSyncResult({ workoutIdMap: { a: 1, b: 2 }, importedWorkoutIds: [] }),
    );

    expect(remaining.map((w) => w.id)).toEqual(["b"]);
  });

  it("treats reordered sets as a change", () => {
    const reordered = {
      ...submitted[0],
      exercises: [
        {
          ...submitted[0].exercises[0],
          exercise_sets: [...submitted[0].exercises[0].exercise_sets].reverse(),
        },
      ],
    };

    const remaining = removeSyncedWorkouts(
      [reordered],
      snapshot,
      makeSyncResult({ workoutIdMap: { a: 1 }, importedWorkoutIds: ["a"] }),
    );

    expect(remaining).toEqual([reordered]);
  });

  it("keeps workouts missing from the map and workouts created during sync", () => {
    const created = makeWorkoutWithSet("c", 3);

    const remaining = removeSyncedWorkouts(
      [...submitted, created],
      snapshot,
      makeSyncResult({ workoutIdMap: { a: 1 }, importedWorkoutIds: ["a"] }),
    );

    expect(remaining.map((w) => w.id)).toEqual(["b", "c"]);
  });

  it("keeps everything on failure", () => {
    const remaining = removeSyncedWorkouts(
      submitted,
      snapshot,
      makeSyncResult({ success: false, deletedWorkoutIds: ["a"] }),
    );

    expect(remaining).toBe(submitted);
  });
});
