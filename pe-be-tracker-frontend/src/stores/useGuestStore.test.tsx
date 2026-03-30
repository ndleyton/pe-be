import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@/test/testUtils";
import {
  addGuestExercise,
  addGuestSet,
  addGuestWorkout,
  makeRoutine,
} from "@/test/fixtures";
import { useGuestStore } from "./useGuestStore";

// Mock IndexedDB storage
vi.mock("./indexedDBStorage", () => ({
  createIndexedDBStorage: () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock sync utilities
vi.mock("@/utils/syncGuestData", () => ({
  syncGuestDataToServer: vi.fn(),
  showSyncSuccessToast: vi.fn(),
  showSyncErrorToast: vi.fn(),
}));

// Mock auth store
vi.mock("./useAuthStore", () => ({
  useAuthStore: {
    getState: () => ({
      user: null,
    }),
  },
}));

describe("useGuestStore", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset store state between tests
    if (useGuestStore.persist && useGuestStore.persist.clearStorage) {
      await useGuestStore.persist.clearStorage();
    }
    // Also manually reset the store to initial state
    useGuestStore.getState().clear();
  });

  it("initializes with default data", () => {
    const { result } = renderHook(() => useGuestStore());
    const state = result.current;

    expect(state.workouts).toEqual([]);
    expect(state.exerciseTypes).toHaveLength(22); // Updated default exercise types
    expect(state.workoutTypes).toHaveLength(4); // Default workout types
    expect(state.hasAttemptedSync).toBe(false);
  });

  it("adds a workout", () => {
    const { result } = renderHook(() => useGuestStore());

    act(() => {
      const workoutId = addGuestWorkout(result.current, {
        name: "Test Workout",
        notes: "Test notes",
      });

      expect(workoutId).toBeDefined();
      expect(typeof workoutId).toBe("string");
    });

    const state = result.current;
    expect(state.workouts).toHaveLength(1);
    expect(state.workouts[0].name).toBe("Test Workout");
    expect(state.workouts[0].notes).toBe("Test notes");
    expect(state.workouts[0].exercises).toEqual([]);
  });

  it("updates a workout", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;

    act(() => {
      workoutId = addGuestWorkout(result.current, {
        name: "Original Name",
        notes: "Original notes",
      });
    });

    act(() => {
      result.current.updateWorkout(workoutId, {
        name: "Updated Name",
        end_time: "2024-01-01T11:00:00Z",
      });
    });

    const state = result.current;
    const workout = state.workouts.find((w) => w.id === workoutId);
    expect(workout).toBeDefined();
    expect(workout!.name).toBe("Updated Name");
    expect(workout!.end_time).toBe("2024-01-01T11:00:00Z");
    expect(workout!.notes).toBe("Original notes"); // Should remain unchanged
  });

  it("deletes a workout", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;

    act(() => {
      workoutId = addGuestWorkout(result.current);
    });

    expect(result.current.workouts).toHaveLength(1);

    act(() => {
      result.current.deleteWorkout(workoutId);
    });

    expect(result.current.workouts).toHaveLength(0);
  });

  it("adds an exercise to a workout", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;

    act(() => {
      workoutId = addGuestWorkout(result.current);
    });

    act(() => {
      addGuestExercise(result.current, workoutId, {
        notes: "Exercise notes",
      });
    });

    const state = result.current;
    const workout = state.workouts.find((w) => w.id === workoutId);
    expect(workout).toBeDefined();
    expect(workout!.exercises).toHaveLength(1);
    expect(workout!.exercises[0].notes).toBe("Exercise notes");
    expect(workout!.exercises[0].exercise_sets).toEqual([]);
  });

  it("adds exercise sets to an exercise", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;
    let exerciseId!: string;

    act(() => {
      workoutId = addGuestWorkout(result.current);
      exerciseId = addGuestExercise(result.current, workoutId);
    });

    act(() => {
      addGuestSet(result.current, exerciseId);
    });

    const state = result.current;
    const workout = state.workouts.find((w) => w.id === workoutId);
    const exercise = workout!.exercises.find((e) => e.id === exerciseId);
    expect(exercise!.exercise_sets).toHaveLength(1);
    expect(exercise!.exercise_sets[0].reps).toBe(10);
    expect(exercise!.exercise_sets[0].intensity).toBe(50);
    expect(exercise!.exercise_sets[0].done).toBe(false);
  });

  it("preserves untouched workout and exercise references when updating an exercise", () => {
    const { result } = renderHook(() => useGuestStore());
    let firstWorkoutId!: string;
    let secondWorkoutId!: string;
    let touchedExerciseId!: string;
    let untouchedExerciseId!: string;

    act(() => {
      firstWorkoutId = addGuestWorkout(result.current, {
        name: "Workout A",
      });

      secondWorkoutId = addGuestWorkout(result.current, {
        name: "Workout B",
        start_time: "2024-01-01T11:00:00Z",
      });

      touchedExerciseId = addGuestExercise(result.current, firstWorkoutId, {
        notes: "Touched",
      });

      untouchedExerciseId = addGuestExercise(result.current, firstWorkoutId, {
        notes: "Untouched",
        timestamp: "2024-01-01T10:05:00Z",
      });

      addGuestExercise(result.current, secondWorkoutId, {
        notes: "Other workout",
        timestamp: "2024-01-01T11:00:00Z",
      });
    });

    const firstWorkoutBefore = result.current.getWorkout(firstWorkoutId)!;
    const secondWorkoutBefore = result.current.getWorkout(secondWorkoutId)!;
    const touchedExerciseBefore = firstWorkoutBefore.exercises.find(
      (exercise) => exercise.id === touchedExerciseId,
    )!;
    const untouchedExerciseBefore = firstWorkoutBefore.exercises.find(
      (exercise) => exercise.id === untouchedExerciseId,
    )!;

    act(() => {
      result.current.updateExercise(touchedExerciseId, {
        notes: "Updated notes",
      });
    });

    const firstWorkoutAfter = result.current.getWorkout(firstWorkoutId)!;
    const secondWorkoutAfter = result.current.getWorkout(secondWorkoutId)!;
    const touchedExerciseAfter = firstWorkoutAfter.exercises.find(
      (exercise) => exercise.id === touchedExerciseId,
    )!;
    const untouchedExerciseAfter = firstWorkoutAfter.exercises.find(
      (exercise) => exercise.id === untouchedExerciseId,
    )!;

    expect(firstWorkoutAfter).not.toBe(firstWorkoutBefore);
    expect(secondWorkoutAfter).toBe(secondWorkoutBefore);
    expect(touchedExerciseAfter).not.toBe(touchedExerciseBefore);
    expect(untouchedExerciseAfter).toBe(untouchedExerciseBefore);
    expect(touchedExerciseAfter.notes).toBe("Updated notes");
  });

  it("preserves untouched workouts, exercises, and sets when updating a set", () => {
    const { result } = renderHook(() => useGuestStore());
    let firstWorkoutId!: string;
    let secondWorkoutId!: string;
    let touchedExerciseId!: string;
    let untouchedExerciseId!: string;
    let touchedSetId!: string;
    let untouchedSetId!: string;

    act(() => {
      firstWorkoutId = addGuestWorkout(result.current, {
        name: "Workout A",
      });

      secondWorkoutId = addGuestWorkout(result.current, {
        name: "Workout B",
        start_time: "2024-01-01T11:00:00Z",
      });

      touchedExerciseId = addGuestExercise(result.current, firstWorkoutId, {
        notes: "Touched",
      });

      untouchedExerciseId = addGuestExercise(result.current, firstWorkoutId, {
        notes: "Untouched",
        timestamp: "2024-01-01T10:05:00Z",
      });

      addGuestExercise(result.current, secondWorkoutId, {
        notes: "Other workout",
        timestamp: "2024-01-01T11:00:00Z",
      });

      touchedSetId = addGuestSet(result.current, touchedExerciseId);

      untouchedSetId = addGuestSet(result.current, touchedExerciseId, {
        reps: 8,
        intensity: 55,
      });

      addGuestSet(result.current, untouchedExerciseId, {
        reps: 12,
        intensity: 40,
        rest_time_seconds: 90,
      });
    });

    const firstWorkoutBefore = result.current.getWorkout(firstWorkoutId)!;
    const secondWorkoutBefore = result.current.getWorkout(secondWorkoutId)!;
    const touchedExerciseBefore = firstWorkoutBefore.exercises.find(
      (exercise) => exercise.id === touchedExerciseId,
    )!;
    const untouchedExerciseBefore = firstWorkoutBefore.exercises.find(
      (exercise) => exercise.id === untouchedExerciseId,
    )!;
    const touchedSetBefore = touchedExerciseBefore.exercise_sets.find(
      (set) => set.id === touchedSetId,
    )!;
    const untouchedSetBefore = touchedExerciseBefore.exercise_sets.find(
      (set) => set.id === untouchedSetId,
    )!;

    act(() => {
      result.current.updateExerciseSet(touchedSetId, {
        done: true,
      });
    });

    const firstWorkoutAfter = result.current.getWorkout(firstWorkoutId)!;
    const secondWorkoutAfter = result.current.getWorkout(secondWorkoutId)!;
    const touchedExerciseAfter = firstWorkoutAfter.exercises.find(
      (exercise) => exercise.id === touchedExerciseId,
    )!;
    const untouchedExerciseAfter = firstWorkoutAfter.exercises.find(
      (exercise) => exercise.id === untouchedExerciseId,
    )!;
    const touchedSetAfter = touchedExerciseAfter.exercise_sets.find(
      (set) => set.id === touchedSetId,
    )!;
    const untouchedSetAfter = touchedExerciseAfter.exercise_sets.find(
      (set) => set.id === untouchedSetId,
    )!;

    expect(firstWorkoutAfter).not.toBe(firstWorkoutBefore);
    expect(secondWorkoutAfter).toBe(secondWorkoutBefore);
    expect(touchedExerciseAfter).not.toBe(touchedExerciseBefore);
    expect(untouchedExerciseAfter).toBe(untouchedExerciseBefore);
    expect(touchedSetAfter).not.toBe(touchedSetBefore);
    expect(untouchedSetAfter).toBe(untouchedSetBefore);
    expect(touchedSetAfter.done).toBe(true);
  });

  it("creates exercises from a server routine", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;

    act(() => {
      workoutId = addGuestWorkout(result.current);
    });

    const routine = makeRoutine({
      exercise_templates: [
        {
          id: 11,
          exercise_type_id: 7,
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          exercise_type: {
            id: 7,
            name: "Bench Press",
            description: "Chest press",
            default_intensity_unit: 2,
            times_used: 0,
          },
          set_templates: [
            {
              id: 21,
              reps: 12,
              intensity: 60,
              intensity_unit_id: 2,
              created_at: "2024-01-01T10:00:00Z",
              updated_at: "2024-01-01T10:00:00Z",
              intensity_unit: {
                id: 2,
                name: "Kilograms",
                abbreviation: "kg",
              },
            },
          ],
        },
      ],
    });

    act(() => {
      result.current.createExercisesFromRoutine(routine, workoutId);
    });

    const state = result.current;
    const workout = state.workouts.find((w) => w.id === workoutId)!;
    expect(workout.exercises).toHaveLength(1);
    expect(workout.exercises[0].notes).toBeNull();
    expect(workout.exercises[0].exercise_type.name).toBe("Bench Press");
    expect(workout.exercises[0].exercise_sets).toHaveLength(1);
    expect(workout.exercises[0].exercise_sets[0].reps).toBe(12);
    expect(workout.exercises[0].exercise_sets[0].done).toBe(false);
  });

  it("provides utility methods to find workouts and exercises", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;
    let exerciseId!: string;

    act(() => {
      workoutId = addGuestWorkout(result.current);
      exerciseId = addGuestExercise(result.current, workoutId);
    });

    const workout = result.current.getWorkout(workoutId);
    expect(workout).toBeDefined();
    expect(workout!.name).toBe("Test Workout");

    const exercise = result.current.getExercise(exerciseId);
    expect(exercise).toBeDefined();
    expect(exercise!.workout_id).toBe(workoutId);
  });

  it("handles soft delete and restore for exercises", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;
    let exerciseId!: string;

    act(() => {
      workoutId = addGuestWorkout(result.current);
      exerciseId = addGuestExercise(result.current, workoutId);
    });

    // Exercise should be active initially
    expect(result.current.getActiveExercises(workoutId)).toHaveLength(1);

    // Soft delete the exercise
    act(() => {
      result.current.softDeleteExercise(exerciseId);
    });

    // Exercise should be soft deleted (not in active list)
    expect(result.current.getActiveExercises(workoutId)).toHaveLength(0);

    // But still exist in the workout
    const workout = result.current.getWorkout(workoutId);
    expect(workout!.exercises).toHaveLength(1);
    expect(workout!.exercises[0].deleted_at).toBeTruthy();

    // Restore the exercise
    act(() => {
      result.current.restoreExercise(exerciseId);
    });

    // Exercise should be active again
    expect(result.current.getActiveExercises(workoutId)).toHaveLength(1);
    const restoredWorkout = result.current.getWorkout(workoutId);
    expect(restoredWorkout!.exercises[0].deleted_at).toBeNull();
  });

  it("handles soft delete and restore for exercise sets", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;
    let exerciseId!: string;
    let setId!: string;

    act(() => {
      workoutId = addGuestWorkout(result.current);
      exerciseId = addGuestExercise(result.current, workoutId);
      setId = addGuestSet(result.current, exerciseId);
    });

    // Set should be active initially
    expect(result.current.getActiveSets(exerciseId)).toHaveLength(1);

    // Soft delete the set
    act(() => {
      result.current.softDeleteExerciseSet(setId);
    });

    // Set should be soft deleted (not in active list)
    expect(result.current.getActiveSets(exerciseId)).toHaveLength(0);

    // But still exist in the exercise
    const exercise = result.current.getExercise(exerciseId);
    expect(exercise!.exercise_sets).toHaveLength(1);
    expect(exercise!.exercise_sets[0].deleted_at).toBeTruthy();

    // Restore the set
    act(() => {
      result.current.restoreExerciseSet(setId);
    });

    // Set should be active again
    expect(result.current.getActiveSets(exerciseId)).toHaveLength(1);
    const restoredExercise = result.current.getExercise(exerciseId);
    expect(restoredExercise!.exercise_sets[0].deleted_at).toBeNull();
  });

  it("ensures clear() produces identical state to fresh initialization", () => {
    const { result: freshResult } = renderHook(() => useGuestStore());
    const { result: clearResult } = renderHook(() => useGuestStore());

    // Get fresh state
    const freshState = {
      workouts: freshResult.current.workouts,
      exerciseTypes: freshResult.current.exerciseTypes,
      workoutTypes: freshResult.current.workoutTypes,
      hasAttemptedSync: freshResult.current.hasAttemptedSync,
    };

    // Add some data to the clear test store
    act(() => {
      addGuestWorkout(clearResult.current);
    });

    // Verify data was added
    expect(clearResult.current.workouts).toHaveLength(1);

    // Clear the store
    act(() => {
      clearResult.current.clear();
    });

    // Get cleared state
    const clearedState = {
      workouts: clearResult.current.workouts,
      exerciseTypes: clearResult.current.exerciseTypes,
      workoutTypes: clearResult.current.workoutTypes,
      hasAttemptedSync: clearResult.current.hasAttemptedSync,
    };

    // Compare structures (excluding specific IDs since they're random)
    expect(clearedState.workouts).toEqual(freshState.workouts);
    expect(clearedState.hasAttemptedSync).toEqual(freshState.hasAttemptedSync);

    // Compare exercise types (same count and names)
    expect(clearedState.exerciseTypes).toHaveLength(
      freshState.exerciseTypes.length,
    );
    expect(clearedState.exerciseTypes.map((e) => e.name)).toEqual(
      freshState.exerciseTypes.map((e) => e.name),
    );

    // Compare workout types (same count and names)
    expect(clearedState.workoutTypes).toHaveLength(
      freshState.workoutTypes.length,
    );
    expect(clearedState.workoutTypes.map((w) => w.name)).toEqual(
      freshState.workoutTypes.map((w) => w.name),
    );
  });

  it("clears all data", () => {
    const { result } = renderHook(() => useGuestStore());

    act(() => {
      addGuestWorkout(result.current);
    });

    expect(result.current.workouts).toHaveLength(1);

    act(() => {
      result.current.clear();
    });

    const state = result.current;
    expect(state.workouts).toEqual([]);
    expect(state.hasAttemptedSync).toBe(false);
    // Should still have default exercise types and workout types
    expect(state.exerciseTypes.length).toBeGreaterThan(0);
    expect(state.workoutTypes.length).toBeGreaterThan(0);
  });
});
