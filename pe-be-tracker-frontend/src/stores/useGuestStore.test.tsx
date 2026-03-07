import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@/test/testUtils";
import {
  useGuestStore,
  type GuestExercise,
  type GuestExerciseSet,
  type GuestWorkout,
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

type GuestStoreState = ReturnType<typeof useGuestStore.getState>;

const addTestWorkout = (
  store: GuestStoreState,
  overrides: Partial<Omit<GuestWorkout, "id" | "created_at" | "updated_at">> = {},
) => {
  const workoutType = store.workoutTypes[0];

  return store.addWorkout({
    name: "Test Workout",
    notes: null,
    start_time: "2024-01-01T10:00:00Z",
    end_time: null,
    workout_type_id: workoutType.id,
    workout_type: workoutType,
    exercises: [],
    ...overrides,
  });
};

const addTestExercise = (
  store: GuestStoreState,
  workoutId: string,
  overrides: Partial<
    Omit<GuestExercise, "id" | "created_at" | "updated_at" | "exercise_sets">
  > = {},
) => {
  const exerciseType = store.exerciseTypes[0];

  return store.addExercise({
    workout_id: workoutId,
    exercise_type_id: exerciseType.id,
    exercise_type: exerciseType,
    notes: null,
    timestamp: "2024-01-01T10:00:00Z",
    ...overrides,
  });
};

const addTestSet = (
  store: GuestStoreState,
  exerciseId: string,
  overrides: Partial<Omit<GuestExerciseSet, "id" | "created_at" | "updated_at">> = {},
) =>
  store.addExerciseSet({
    exercise_id: exerciseId,
    reps: 10,
    intensity: 50,
    intensity_unit_id: 2,
    rest_time_seconds: 60,
    done: false,
    ...overrides,
  });

const getWorkout = (store: GuestStoreState, workoutId: string) =>
  store.workouts.find((workout) => workout.id === workoutId)!;

const getExercise = (workout: GuestWorkout, exerciseId: string) =>
  workout.exercises.find((exercise) => exercise.id === exerciseId)!;

const getSet = (exercise: GuestExercise, setId: string) =>
  exercise.exercise_sets.find((set) => set.id === setId)!;

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
      const workoutId = addTestWorkout(result.current, {
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
      workoutId = addTestWorkout(result.current, {
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
      workoutId = addTestWorkout(result.current);
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
      workoutId = addTestWorkout(result.current);
    });

    act(() => {
      addTestExercise(result.current, workoutId, {
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
      workoutId = addTestWorkout(result.current);
      exerciseId = addTestExercise(result.current, workoutId);
    });

    act(() => {
      addTestSet(result.current, exerciseId);
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
      firstWorkoutId = addTestWorkout(result.current, {
        name: "Workout A",
      });

      secondWorkoutId = addTestWorkout(result.current, {
        name: "Workout B",
        start_time: "2024-01-01T11:00:00Z",
      });

      touchedExerciseId = addTestExercise(result.current, firstWorkoutId, {
        notes: "Touched",
      });

      untouchedExerciseId = addTestExercise(result.current, firstWorkoutId, {
        notes: "Untouched",
        timestamp: "2024-01-01T10:05:00Z",
      });

      addTestExercise(result.current, secondWorkoutId, {
        notes: "Other workout",
        timestamp: "2024-01-01T11:00:00Z",
      });
    });

    const firstWorkoutBefore = getWorkout(result.current, firstWorkoutId);
    const secondWorkoutBefore = getWorkout(result.current, secondWorkoutId);
    const touchedExerciseBefore = getExercise(
      firstWorkoutBefore,
      touchedExerciseId,
    );
    const untouchedExerciseBefore = getExercise(
      firstWorkoutBefore,
      untouchedExerciseId,
    );

    act(() => {
      result.current.updateExercise(touchedExerciseId, {
        notes: "Updated notes",
      });
    });

    const firstWorkoutAfter = getWorkout(result.current, firstWorkoutId);
    const secondWorkoutAfter = getWorkout(result.current, secondWorkoutId);
    const touchedExerciseAfter = getExercise(firstWorkoutAfter, touchedExerciseId);
    const untouchedExerciseAfter = getExercise(
      firstWorkoutAfter,
      untouchedExerciseId,
    );

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
      firstWorkoutId = addTestWorkout(result.current, {
        name: "Workout A",
      });

      secondWorkoutId = addTestWorkout(result.current, {
        name: "Workout B",
        start_time: "2024-01-01T11:00:00Z",
      });

      touchedExerciseId = addTestExercise(result.current, firstWorkoutId, {
        notes: "Touched",
      });

      untouchedExerciseId = addTestExercise(result.current, firstWorkoutId, {
        notes: "Untouched",
        timestamp: "2024-01-01T10:05:00Z",
      });

      addTestExercise(result.current, secondWorkoutId, {
        notes: "Other workout",
        timestamp: "2024-01-01T11:00:00Z",
      });

      touchedSetId = addTestSet(result.current, touchedExerciseId);

      untouchedSetId = addTestSet(result.current, touchedExerciseId, {
        reps: 8,
        intensity: 55,
      });

      addTestSet(result.current, untouchedExerciseId, {
        reps: 12,
        intensity: 40,
        rest_time_seconds: 90,
      });
    });

    const firstWorkoutBefore = getWorkout(result.current, firstWorkoutId);
    const secondWorkoutBefore = getWorkout(result.current, secondWorkoutId);
    const touchedExerciseBefore = getExercise(
      firstWorkoutBefore,
      touchedExerciseId,
    );
    const untouchedExerciseBefore = getExercise(
      firstWorkoutBefore,
      untouchedExerciseId,
    );
    const touchedSetBefore = getSet(touchedExerciseBefore, touchedSetId);
    const untouchedSetBefore = getSet(touchedExerciseBefore, untouchedSetId);

    act(() => {
      result.current.updateExerciseSet(touchedSetId, {
        done: true,
      });
    });

    const firstWorkoutAfter = getWorkout(result.current, firstWorkoutId);
    const secondWorkoutAfter = getWorkout(result.current, secondWorkoutId);
    const touchedExerciseAfter = getExercise(firstWorkoutAfter, touchedExerciseId);
    const untouchedExerciseAfter = getExercise(
      firstWorkoutAfter,
      untouchedExerciseId,
    );
    const touchedSetAfter = getSet(touchedExerciseAfter, touchedSetId);
    const untouchedSetAfter = getSet(touchedExerciseAfter, untouchedSetId);

    expect(firstWorkoutAfter).not.toBe(firstWorkoutBefore);
    expect(secondWorkoutAfter).toBe(secondWorkoutBefore);
    expect(touchedExerciseAfter).not.toBe(touchedExerciseBefore);
    expect(untouchedExerciseAfter).toBe(untouchedExerciseBefore);
    expect(touchedSetAfter).not.toBe(touchedSetBefore);
    expect(untouchedSetAfter).toBe(untouchedSetBefore);
    expect(touchedSetAfter.done).toBe(true);
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
      workoutId = addTestWorkout(result.current);
      exerciseId = addTestExercise(result.current, workoutId, {
        notes: "Exercise notes",
      });

      addTestSet(result.current, exerciseId);
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
      workoutId = addTestWorkout(result.current);

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
      workoutId = addTestWorkout(result.current);
      exerciseId = addTestExercise(result.current, workoutId);
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
      workoutId = addTestWorkout(result.current);
      exerciseId = addTestExercise(result.current, workoutId);
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
      workoutId = addTestWorkout(result.current);
      exerciseId = addTestExercise(result.current, workoutId);
      setId = addTestSet(result.current, exerciseId);
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
      addTestWorkout(clearResult.current);
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
      addTestWorkout(result.current);
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
