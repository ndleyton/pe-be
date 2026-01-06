import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@/test/testUtils";
import { useGuestStore } from "./useGuestStore";
import type {
  GuestWorkout,
  GuestExercise,
  GuestExerciseSet,
} from "./useGuestStore";

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
    expect(state.routines.length).toBeGreaterThan(0); // Seeded routines available in guest mode
    expect(state.hasAttemptedSync).toBe(false);
  });

  it("adds a workout", () => {
    const { result } = renderHook(() => useGuestStore());

    act(() => {
      const workoutType = result.current.workoutTypes[0];
      const workoutId = result.current.addWorkout({
        name: "Test Workout",
        notes: "Test notes",
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
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
      const workoutType = result.current.workoutTypes[0];
      workoutId = result.current.addWorkout({
        name: "Original Name",
        notes: "Original notes",
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
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
      const workoutType = result.current.workoutTypes[0];
      workoutId = result.current.addWorkout({
        name: "Test Workout",
        notes: null,
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
      });
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
      const workoutType = result.current.workoutTypes[0];
      workoutId = result.current.addWorkout({
        name: "Test Workout",
        notes: null,
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
      });
    });

    act(() => {
      const exerciseType = result.current.exerciseTypes[0];
      result.current.addExercise({
        workout_id: workoutId,
        exercise_type_id: exerciseType.id,
        exercise_type: exerciseType,
        notes: "Exercise notes",
        timestamp: "2024-01-01T10:00:00Z",
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
      const workoutType = result.current.workoutTypes[0];
      workoutId = result.current.addWorkout({
        name: "Test Workout",
        notes: null,
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
      });

      const exerciseType = result.current.exerciseTypes[0];
      exerciseId = result.current.addExercise({
        workout_id: workoutId,
        exercise_type_id: exerciseType.id,
        exercise_type: exerciseType,
        notes: null,
        timestamp: "2024-01-01T10:00:00Z",
      });
    });

    act(() => {
      result.current.addExerciseSet({
        exercise_id: exerciseId,
        reps: 10,
        intensity: 50,
        intensity_unit_id: 2,
        rest_time_seconds: 60,
        done: false,
      });
    });

    const state = result.current;
    const workout = state.workouts.find((w) => w.id === workoutId);
    const exercise = workout!.exercises.find((e) => e.id === exerciseId);
    expect(exercise!.exercise_sets).toHaveLength(1);
    expect(exercise!.exercise_sets[0].reps).toBe(10);
    expect(exercise!.exercise_sets[0].intensity).toBe(50);
    expect(exercise!.exercise_sets[0].done).toBe(false);
  });

  it("creates and manages routines", () => {
    const { result } = renderHook(() => useGuestStore());

    const initialLen = result.current.routines.length;
    let routineId = "";
    act(() => {
      routineId = result.current.addRoutine({
        name: "Test Routine",
        description: "A test routine",
        exercises: [],
      });
    });

    const state = result.current;
    expect(state.routines.length).toBe(initialLen + 1);
    const created = state.routines.find((r) => r.id === routineId)!;
    expect(created.name).toBe("Test Routine");
    expect(created.description).toBe("A test routine");
  });

  it("creates routine from workout", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;
    let exerciseId!: string;

    // Create workout with exercise and sets
    act(() => {
      const workoutType = result.current.workoutTypes[0];
      workoutId = result.current.addWorkout({
        name: "Test Workout",
        notes: null,
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
      });

      const exerciseType = result.current.exerciseTypes[0];
      exerciseId = result.current.addExercise({
        workout_id: workoutId,
        exercise_type_id: exerciseType.id,
        exercise_type: exerciseType,
        notes: "Exercise notes",
        timestamp: "2024-01-01T10:00:00Z",
      });

      result.current.addExerciseSet({
        exercise_id: exerciseId,
        reps: 10,
        intensity: 50,
        intensity_unit_id: 2,
        rest_time_seconds: 60,
        done: false,
      });
    });

    // Create routine from workout
    let routineId = "";
    act(() => {
      const workout = result.current.workouts.find((w) => w.id === workoutId)!;
      routineId = result.current.createRoutineFromWorkout(
        "My Routine",
        workout.exercises,
      );
    });

    const state = result.current;
    const routine = state.routines.find((r) => r.id === routineId)!;
    expect(routine.name).toBe("My Routine");
    expect(routine.exercises).toHaveLength(1);
    expect(routine.exercises[0].sets).toHaveLength(1);
    expect(routine.exercises[0].sets[0].reps).toBe(10);
  });

  it("creates routine from workout", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;
    let exerciseId!: string;

    // Create workout with exercise and sets
    act(() => {
      const workoutType = result.current.workoutTypes[0];
      workoutId = result.current.addWorkout({
        name: "Test Workout",
        notes: null,
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
      });

      const exerciseType = result.current.exerciseTypes[0];
      exerciseId = result.current.addExercise({
        workout_id: workoutId,
        exercise_type_id: exerciseType.id,
        exercise_type: exerciseType,
        notes: "Exercise notes",
        timestamp: "2024-01-01T10:00:00Z",
      });

      result.current.addExerciseSet({
        exercise_id: exerciseId,
        reps: 10,
        intensity: 50,
        intensity_unit_id: 2,
        rest_time_seconds: 60,
        done: false,
      });
    });

    // Create routine from workout
    let routineId = "";
    act(() => {
      const workout = result.current.workouts.find((w) => w.id === workoutId)!;
      routineId = result.current.createRoutineFromWorkout(
        "My Routine",
        workout.exercises,
      );
    });

    const state = result.current;
    const routine = state.routines.find((r) => r.id === routineId)!;
    expect(routine.name).toBe("My Routine");
    expect(routine.exercises).toHaveLength(1);
    expect(routine.exercises[0].sets).toHaveLength(1);
    expect(routine.exercises[0].sets[0].reps).toBe(10);
  });

  it("creates exercises from routine", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;

    // Create workout and routine
    act(() => {
      const workoutType = result.current.workoutTypes[0];
      workoutId = result.current.addWorkout({
        name: "Test Workout",
        notes: null,
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
      });

      result.current.addRoutine({
        name: "Test Routine",
        exercises: [
          {
            id: "routine-ex-1",
            exercise_type_id: result.current.exerciseTypes[0].id,
            exercise_type: result.current.exerciseTypes[0],
            sets: [
              {
                id: "routine-set-1",
                reps: 12,
                intensity: 60,
                intensity_unit_id: 2,
                rest_time_seconds: 90,
              },
            ],
            notes: "From routine",
          },
        ],
      });
    });

    // Create exercises from the newly added routine (last item)
    act(() => {
      const routine = result.current.routines[result.current.routines.length - 1];
      result.current.createExercisesFromRoutine(routine, workoutId);
    });

    const state = result.current;
    const workout = state.workouts.find((w) => w.id === workoutId)!;
    expect(workout.exercises).toHaveLength(1);
    expect(workout.exercises[0].notes).toBe("From routine");
    expect(workout.exercises[0].exercise_sets).toHaveLength(1);
    expect(workout.exercises[0].exercise_sets[0].reps).toBe(12);
    expect(workout.exercises[0].exercise_sets[0].done).toBe(false);
  });

  it("provides utility methods to find workouts and exercises", () => {
    const { result } = renderHook(() => useGuestStore());
    let workoutId!: string;
    let exerciseId!: string;

    act(() => {
      const workoutType = result.current.workoutTypes[0];
      workoutId = result.current.addWorkout({
        name: "Test Workout",
        notes: null,
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
      });

      const exerciseType = result.current.exerciseTypes[0];
      exerciseId = result.current.addExercise({
        workout_id: workoutId,
        exercise_type_id: exerciseType.id,
        exercise_type: exerciseType,
        notes: null,
        timestamp: "2024-01-01T10:00:00Z",
      });
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
      const workoutType = result.current.workoutTypes[0];
      workoutId = result.current.addWorkout({
        name: "Test Workout",
        notes: null,
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
      });

      const exerciseType = result.current.exerciseTypes[0];
      exerciseId = result.current.addExercise({
        workout_id: workoutId,
        exercise_type_id: exerciseType.id,
        exercise_type: exerciseType,
        notes: null,
        timestamp: "2024-01-01T10:00:00Z",
      });
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
      const workoutType = result.current.workoutTypes[0];
      workoutId = result.current.addWorkout({
        name: "Test Workout",
        notes: null,
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
      });

      const exerciseType = result.current.exerciseTypes[0];
      exerciseId = result.current.addExercise({
        workout_id: workoutId,
        exercise_type_id: exerciseType.id,
        exercise_type: exerciseType,
        notes: null,
        timestamp: "2024-01-01T10:00:00Z",
      });

      setId = result.current.addExerciseSet({
        exercise_id: exerciseId,
        reps: 10,
        intensity: 50,
        intensity_unit_id: 2,
        rest_time_seconds: 60,
        done: false,
      });
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
      routines: freshResult.current.routines,
      hasAttemptedSync: freshResult.current.hasAttemptedSync,
    };

    // Add some data to the clear test store
    const initialClearRoutinesLen = clearResult.current.routines.length;
    act(() => {
      const workoutType = clearResult.current.workoutTypes[0];
      clearResult.current.addWorkout({
        name: "Test Workout",
        notes: null,
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
      });
      clearResult.current.addRoutine({
        name: "Test Routine",
        exercises: [],
      });
    });

    // Verify data was added
    expect(clearResult.current.workouts).toHaveLength(1);
    expect(clearResult.current.routines.length).toBe(initialClearRoutinesLen + 1);

    // Clear the store
    act(() => {
      clearResult.current.clear();
    });

    // Get cleared state
    const clearedState = {
      workouts: clearResult.current.workouts,
      exerciseTypes: clearResult.current.exerciseTypes,
      workoutTypes: clearResult.current.workoutTypes,
      routines: clearResult.current.routines,
      hasAttemptedSync: clearResult.current.hasAttemptedSync,
    };

    // Compare structures (excluding specific IDs since they're random)
    expect(clearedState.workouts).toEqual(freshState.workouts);
    // Routines are seeded with random IDs; compare stable fields
    expect(clearedState.routines.length).toBe(freshState.routines.length);
    expect(clearedState.routines.map((r) => r.name)).toEqual(
      freshState.routines.map((r) => r.name),
    );
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
      const workoutType = result.current.workoutTypes[0];
      result.current.addWorkout({
        name: "Test Workout",
        notes: null,
        start_time: "2024-01-01T10:00:00Z",
        end_time: null,
        workout_type_id: workoutType.id,
        workout_type: workoutType,
        exercises: [],
      });
    });

    expect(result.current.workouts).toHaveLength(1);

    act(() => {
      result.current.clear();
    });

    const state = result.current;
    expect(state.workouts).toEqual([]);
    expect(state.routines.length).toBeGreaterThan(0);
    expect(state.hasAttemptedSync).toBe(false);
    // Should still have default exercise types and workout types
    expect(state.exerciseTypes.length).toBeGreaterThan(0);
    expect(state.workoutTypes.length).toBeGreaterThan(0);
  });
});
