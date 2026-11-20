import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@/test/testUtils";
import {
  addGuestExercise,
  addGuestSet,
  addGuestWorkout,
  makeRoutine,
  makeSyncResult,
} from "@/test/fixtures";
import { useGuestStore, flushGuestPersist } from "./useGuestStore";
import {
  showSyncDeletedWorkoutsToast,
  syncGuestDataToServer,
} from "@/utils/syncGuestData";
import type { SyncResult } from "@/utils/syncGuestData";

const mocks = vi.hoisted(() => ({
  authState: {
    user: null as null | { id: number; email: string },
  },
  setItem: vi.fn().mockResolvedValue(undefined),
  getItem: vi.fn().mockResolvedValue(null),
}));

// Mock IndexedDB storage
vi.mock("./indexedDBStorage", () => ({
  createIndexedDBStorage: () => ({
    getItem: (name: string) => mocks.getItem(name),
    setItem: (name: string, value: string) => mocks.setItem(name, value),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock sync utilities
// Keep the real cleanup helpers; stub only the network call and toasts.
vi.mock("@/utils/syncGuestData", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/syncGuestData")>()),
  syncGuestDataToServer: vi.fn(),
  showSyncSuccessToast: vi.fn(),
  showSyncErrorToast: vi.fn(),
  showSyncDeletedWorkoutsToast: vi.fn(),
}));

// Mock auth store
vi.mock("./useAuthStore", () => ({
  useAuthStore: {
    getState: () => mocks.authState,
  },
}));

describe("useGuestStore", () => {
  const mockSyncGuestDataToServer = vi.mocked(syncGuestDataToServer);

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.getItem.mockResolvedValue(null);
    mocks.authState.user = null;
    // Reset store state between tests
    if (useGuestStore.persist && useGuestStore.persist.clearStorage) {
      await useGuestStore.persist.clearStorage();
    }
    // Also manually reset the store to initial state
    useGuestStore.getState().clear();
  });

  it("flushGuestPersist waits until the latest guest write reaches storage", async () => {
    let finishWrite: () => void = () => {};
    mocks.setItem.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishWrite = resolve; }),
    );
    const flushed = vi.fn();

    const { result } = renderHook(() => useGuestStore());
    act(() => {
      addGuestWorkout(result.current);
    });
    flushGuestPersist().then(flushed);

    await Promise.resolve();
    expect(flushed).not.toHaveBeenCalled();

    finishWrite();
    await flushGuestPersist();
    expect(flushed).toHaveBeenCalledTimes(1);
  });

  it("initializes with default data", () => {
    const { result } = renderHook(() => useGuestStore());
    const state = result.current;

    expect(state.workouts).toEqual([]);
    expect(state.exerciseTypes).toHaveLength(22); // Updated default exercise types
    expect(state.workoutTypes).toHaveLength(4); // Default workout types
    expect(state.hasAttemptedSync).toBe(false);
  });

  it("migrates v3 persisted snapshots to include routines", () => {
    const persistOptions = useGuestStore.persist.getOptions();
    const migrate = persistOptions.migrate;

    expect(persistOptions.version).toBe(5);
    expect(migrate).toBeDefined();

    const migrated = migrate!(
      {
        workouts: [],
        exerciseTypes: [],
        workoutTypes: [],
        hasAttemptedSync: true,
      },
      3,
    ) as ReturnType<typeof useGuestStore.getState>;

    expect(migrated.routines).toEqual([]);
    expect(migrated.hasAttemptedSync).toBe(true);
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
            images: ["https://cdn.example.com/bench-press-1.webp"],
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
    expect(workout.exercises[0].exercise_type.images).toEqual([
      "https://cdn.example.com/bench-press-1.webp",
    ]);
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

  it("does not reuse a soft-deleted set's position for a new set", () => {
    const { result } = renderHook(() => useGuestStore());
    let exerciseId!: string;

    act(() => {
      const workoutId = addGuestWorkout(result.current);
      exerciseId = addGuestExercise(result.current, workoutId);
      addGuestSet(result.current, exerciseId);
      const deletedSetId = addGuestSet(result.current, exerciseId);
      result.current.softDeleteExerciseSet(deletedSetId);
      addGuestSet(result.current, exerciseId);
    });

    const positions = result.current
      .getExercise(exerciseId)!
      .exercise_sets.map((set) => set.position);
    expect(positions).toEqual([0, 1, 2]);
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

  it("awaits the shared in-flight sync promise for concurrent callers", async () => {
    let resolveSync: ((value: SyncResult) => void) | undefined;

    mocks.authState.user = {
      id: 1,
      email: "user@example.com",
    };

    const { result } = renderHook(() => useGuestStore());

    act(() => {
      addGuestWorkout(result.current, {
        name: "Pending Sync Workout",
      });
    });

    mockSyncGuestDataToServer.mockImplementationOnce(
      () =>
        new Promise<SyncResult>((resolve) => {
          resolveSync = resolve;
        }),
    );

    const firstSyncPromise = result.current.syncWithServer();
    const secondSyncPromise = result.current.syncWithServer();

    expect(mockSyncGuestDataToServer).toHaveBeenCalledTimes(1);

    let secondResolved = false;
    void secondSyncPromise.then(() => {
      secondResolved = true;
    });

    await Promise.resolve();
    expect(secondResolved).toBe(false);

    const syncResult = makeSyncResult({ syncedWorkouts: 1 });
    resolveSync?.(syncResult);

    await expect(firstSyncPromise).resolves.toBe(syncResult);
    await expect(secondSyncPromise).resolves.toBe(syncResult);
  });

  describe("targeted cleanup after sync", () => {
    const deferSync = () => {
      let resolve: (value: SyncResult) => void = () => {};
      mockSyncGuestDataToServer.mockImplementationOnce(
        () =>
          new Promise<SyncResult>((r) => {
            resolve = r;
          }),
      );
      return (value: SyncResult) => resolve(value);
    };

    const addWorkoutWithSet = (name: string) => {
      const store = useGuestStore.getState();
      const workoutId = addGuestWorkout(store, { name });
      const exerciseId = addGuestExercise(useGuestStore.getState(), workoutId);
      const setId = addGuestSet(useGuestStore.getState(), exerciseId, {
        reps: 10,
      });
      return { workoutId, setId };
    };

    beforeEach(() => {
      mocks.authState.user = { id: 1, email: "user@example.com" };
    });

    it.each([
      ["imported", (ids: string[]) => ids],
      ["mapping-only replay", () => []],
    ])(
      "keeps a workout edited during sync and removes the unchanged one (%s)",
      async (_label, importedIds) => {
        const unchanged = addWorkoutWithSet("Unchanged");
        const edited = addWorkoutWithSet("Edited");
        const resolveSync = deferSync();

        const syncPromise = useGuestStore.getState().syncWithServer();
        useGuestStore.getState().updateExerciseSet(edited.setId, { reps: 12 });

        // The dispatched payload is the pre-edit snapshot.
        const sent = mockSyncGuestDataToServer.mock.calls[0][0].workouts;
        expect(
          sent.find((w) => w.id === edited.workoutId)?.exercises[0]
            .exercise_sets[0].reps,
        ).toBe(10);

        const ids = [unchanged.workoutId, edited.workoutId];
        resolveSync(
          makeSyncResult({
            syncedWorkouts: 2,
            workoutIdMap: { [ids[0]]: 101, [ids[1]]: 102 },
            importedWorkoutIds: importedIds(ids),
          }),
        );
        await syncPromise;

        const { workouts } = useGuestStore.getState();
        expect(workouts.map((w) => w.id)).toEqual([edited.workoutId]);
        expect(workouts[0].exercises[0].exercise_sets[0].reps).toBe(12);
      },
    );

    it("keeps workouts created during sync, routines and the types they reference", async () => {
      const synced = addWorkoutWithSet("Synced");
      const routine = makeRoutine();
      useGuestStore.setState({ routines: [routine] });
      const resolveSync = deferSync();

      const syncPromise = useGuestStore.getState().syncWithServer();
      const { exerciseTypes, workoutTypes } = useGuestStore.getState();
      const exerciseType = exerciseTypes[1];
      const workoutType = workoutTypes[workoutTypes.length - 1];
      const createdId = addGuestWorkout(useGuestStore.getState(), {
        name: "Created during sync",
        workout_type: workoutType,
        workout_type_id: workoutType.id,
      });
      addGuestExercise(useGuestStore.getState(), createdId, {
        exercise_type: exerciseType,
        exercise_type_id: exerciseType.id,
      });

      resolveSync(
        makeSyncResult({
          syncedWorkouts: 1,
          workoutIdMap: { [synced.workoutId]: 101 },
          importedWorkoutIds: [synced.workoutId],
        }),
      );
      await syncPromise;

      const state = useGuestStore.getState();
      expect(state.workouts.map((w) => w.id)).toEqual([createdId]);
      expect(state.routines).toEqual([routine]);
      expect(state.exerciseTypes.map((t) => t.id)).toContain(exerciseType.id);
      expect(state.workoutTypes.map((t) => t.id)).toContain(workoutType.id);
    });

    it("keeps a submitted workout the server omits from the map", async () => {
      const mapped = addWorkoutWithSet("Mapped");
      const omitted = addWorkoutWithSet("Omitted");
      mockSyncGuestDataToServer.mockResolvedValueOnce(
        makeSyncResult({
          workoutIdMap: { [mapped.workoutId]: 101 },
          importedWorkoutIds: [mapped.workoutId],
        }),
      );

      await useGuestStore.getState().syncWithServer();

      expect(useGuestStore.getState().workouts.map((w) => w.id)).toEqual([
        omitted.workoutId,
      ]);
    });

    it("keeps data, warns and stops retrying workouts deleted on the server, across reloads", async () => {
      const deleted = addWorkoutWithSet("Deleted on server");
      const other = addWorkoutWithSet("Other");
      mockSyncGuestDataToServer.mockResolvedValueOnce(
        makeSyncResult({
          success: false,
          error: "Workouts were deleted",
          deletedWorkoutIds: [deleted.workoutId],
        }),
      );

      const result = await useGuestStore.getState().syncWithServer();

      expect(result.success).toBe(false);
      expect(showSyncDeletedWorkoutsToast).toHaveBeenCalledWith(1);
      const state = useGuestStore.getState();
      expect(state.workouts.map((w) => w.id)).toEqual([
        deleted.workoutId,
        other.workoutId,
      ]);
      expect(state.hasAttemptedSync).toBe(false);

      // Simulate a reload from the persisted snapshot.
      await flushGuestPersist();
      const persisted = mocks.setItem.mock.calls.at(-1)?.[1] as string;
      expect(JSON.parse(persisted).state.syncBlockedWorkoutIds).toEqual([
        deleted.workoutId,
      ]);
      useGuestStore.getState().clear();
      mocks.getItem.mockResolvedValue(persisted);
      await useGuestStore.persist.rehydrate();
      expect(useGuestStore.getState().workouts).toHaveLength(2);

      mockSyncGuestDataToServer.mockResolvedValueOnce(makeSyncResult());
      await useGuestStore.getState().syncWithServer();

      expect(mockSyncGuestDataToServer).toHaveBeenCalledTimes(2);
      expect(
        mockSyncGuestDataToServer.mock.calls[1][0].workouts.map((w) => w.id),
      ).toEqual([other.workoutId]);

      // With only the deleted workout left, no request is sent at all.
      useGuestStore.getState().deleteWorkout(other.workoutId);
      useGuestStore.setState({ hasAttemptedSync: false });
      await useGuestStore.getState().syncWithServer();
      expect(mockSyncGuestDataToServer).toHaveBeenCalledTimes(2);
    });
  });
});
