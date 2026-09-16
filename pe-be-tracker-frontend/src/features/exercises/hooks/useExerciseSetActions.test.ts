import { act, renderHook } from "@/test/testUtils";
import {
  makeExercise,
  makeExerciseSet,
  makeExerciseType,
} from "@/test/fixtures";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  mockCreateExerciseSet,
  mockDeleteExercise,
  mockDeleteExerciseSet,
  mockInvalidateQueries,
  mockUpdateExerciseSet,
  mockDeleteGuestExercise,
  mockAuthState,
} = vi.hoisted(() => ({
  mockCreateExerciseSet: vi.fn(),
  mockDeleteExercise: vi.fn(),
  mockDeleteExerciseSet: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockUpdateExerciseSet: vi.fn(),
  mockDeleteGuestExercise: vi.fn(),
  mockAuthState: {
    isAuthenticated: true,
  },
}));

vi.mock("@/features/exercises/api", async () => {
  const actual = await vi.importActual("@/features/exercises/api");
  return {
    ...actual,
    createExerciseSet: mockCreateExerciseSet,
    deleteExercise: mockDeleteExercise,
    deleteExerciseSet: mockDeleteExerciseSet,
    updateExerciseSet: mockUpdateExerciseSet,
  };
});

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
  useGuestStore: (selector: (state: { deleteExercise: typeof mockDeleteGuestExercise }) => unknown) =>
    selector({
      deleteExercise: mockDeleteGuestExercise,
    }),
}));

import { useExerciseSetActions } from "./useExerciseSetActions";

describe("useExerciseSetActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockAuthState.isAuthenticated = true;
    mockCreateExerciseSet.mockResolvedValue(
      makeExerciseSet({
        id: 999,
        reps: 10,
        intensity: 50,
        intensity_unit_id: 2,
        exercise_id: 123,
      }),
    );
    mockUpdateExerciseSet.mockResolvedValue({});
    mockDeleteExerciseSet.mockResolvedValue(undefined);
    mockDeleteExercise.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces and merges authenticated set updates", async () => {
    const exercise = makeExercise({
      id: 123,
      workout_id: 456,
      exercise_type: makeExerciseType({
        id: 7,
        name: "Bench Press",
      }),
      exercise_sets: [
        makeExerciseSet({
          id: 1,
          exercise_id: 123,
          reps: 10,
          intensity: 50,
        }),
      ],
    });
    const onExerciseUpdate = vi.fn();

    const { result } = renderHook(() =>
      useExerciseSetActions({
        exercise,
        onExerciseUpdate,
        workoutId: "456",
      }),
    );

    act(() => {
      result.current.updateSetField(1, "weight", 220.462, 2);
    });

    expect(result.current.exerciseSets[0].intensity).toBe(100);
    expect(onExerciseUpdate).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.updateSetField(1, "reps", 12);
    });

    expect(result.current.exerciseSets[0].reps).toBe(12);
    expect(onExerciseUpdate).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockUpdateExerciseSet).toHaveBeenCalledTimes(1);
    expect(mockUpdateExerciseSet).toHaveBeenCalledWith(1, {
      intensity: 100,
      reps: 12,
      duration_seconds: null,
    });
  });

  it("stores time updates as duration_seconds and clears reps", async () => {
    const exercise = makeExercise({
      id: 123,
      workout_id: 456,
      exercise_sets: [
        makeExerciseSet({
          id: 1,
          exercise_id: 123,
          reps: 10,
          duration_seconds: null,
          intensity: 12,
          intensity_unit_id: 3,
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExerciseSetActions({
        exercise,
        workoutId: "456",
      }),
    );

    act(() => {
      result.current.updateSetField(1, "duration_seconds", 605);
    });

    expect(result.current.exerciseSets[0].duration_seconds).toBe(605);
    expect(result.current.exerciseSets[0].reps).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockUpdateExerciseSet).toHaveBeenCalledWith(1, {
      duration_seconds: 605,
      reps: null,
    });
  });

  it("publishes guest-friendly set ids without calling exercise set APIs", () => {
    mockAuthState.isAuthenticated = false;
    const exercise = makeExercise({
      id: 123,
      exercise_sets: [
        makeExerciseSet({
          id: 1,
          exercise_id: 123,
          reps: 10,
          intensity: 50,
        }),
      ],
    });
    const onExerciseUpdate = vi.fn();

    const { result } = renderHook(() =>
      useExerciseSetActions({
        exercise,
        onExerciseUpdate,
      }),
    );

    act(() => {
      result.current.updateSetField(1, "reps", 11);
    });

    expect(mockUpdateExerciseSet).not.toHaveBeenCalled();
    expect(onExerciseUpdate).toHaveBeenCalledTimes(1);
    expect(onExerciseUpdate.mock.calls[0][0].exercise_sets[0].id).toBe("1");
    expect(onExerciseUpdate.mock.calls[0][0].exercise_sets[0].exercise_id).toBe(
      "123",
    );
  });

  it("adds an optimistic set and replaces it with the created server set", async () => {
    const exercise = makeExercise({
      id: 123,
      exercise_sets: [
        makeExerciseSet({
          id: 1,
          exercise_id: 123,
          reps: 10,
          intensity: 50,
        }),
      ],
    });
    const onExerciseUpdate = vi.fn();

    const { result } = renderHook(() =>
      useExerciseSetActions({
        exercise,
        onExerciseUpdate,
      }),
    );

    await act(async () => {
      await result.current.addSet(2);
    });

    expect(result.current.exerciseSets).toHaveLength(2);
    expect(result.current.exerciseSets[1].id).toBe(999);

    expect(mockCreateExerciseSet).toHaveBeenCalledWith({
      reps: 10,
      intensity: 110.231,
      rpe: null,
      rir: null,
      intensity_unit_id: 2,
      exercise_id: 123,
      rest_time_seconds: 0,
      done: false,
      notes: undefined,
      type: "working",
    });
    expect(onExerciseUpdate).toHaveBeenCalled();
  });

  it("flushes queued optimistic set edits with the reconciled server id", async () => {
    let resolveCreateExerciseSet: (
      createdSet: ReturnType<typeof makeExerciseSet>,
    ) => void = () => undefined;
    mockCreateExerciseSet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreateExerciseSet = resolve;
        }),
    );
    const exercise = makeExercise({
      id: 123,
      exercise_sets: [
        makeExerciseSet({
          id: 1,
          exercise_id: 123,
          reps: 10,
          intensity: 50,
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExerciseSetActions({
        exercise,
      }),
    );

    act(() => {
      void result.current.addSet(2);
    });

    const optimisticSetKey = result.current.exerciseSets[1].client_key;
    expect(optimisticSetKey).toMatch(/^temp-/);

    act(() => {
      result.current.updateSetField(optimisticSetKey!, "reps", 12);
    });

    expect(mockUpdateExerciseSet).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreateExerciseSet(
        makeExerciseSet({
          id: 999,
          reps: 10,
          intensity: 50,
          intensity_unit_id: 2,
          exercise_id: 123,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockUpdateExerciseSet).toHaveBeenCalledWith(999, {
      reps: 12,
      duration_seconds: null,
    });
    expect(mockUpdateExerciseSet).not.toHaveBeenCalledWith(
      optimisticSetKey,
      expect.anything(),
    );
  });

  it("preserves duration_seconds when seeding a new set from a duration-based prior set", async () => {
    mockCreateExerciseSet.mockResolvedValue(
      makeExerciseSet({
        id: 999,
        reps: null,
        duration_seconds: 1200,
        intensity: 10,
        intensity_unit_id: 3,
        exercise_id: 123,
      }),
    );

    const exercise = makeExercise({
      id: 123,
      exercise_sets: [
        makeExerciseSet({
          id: 1,
          exercise_id: 123,
          reps: null,
          duration_seconds: 1200,
          intensity: 10,
          intensity_unit_id: 3,
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExerciseSetActions({
        exercise,
      }),
    );

    await act(async () => {
      await result.current.addSet(3);
    });

    expect(result.current.exerciseSets[1].duration_seconds).toBe(1200);
    expect(mockCreateExerciseSet).toHaveBeenCalledWith({
      duration_seconds: 1200,
      intensity: 10,
      rpe: null,
      rir: null,
      intensity_unit_id: 3,
      exercise_id: 123,
      rest_time_seconds: 0,
      done: false,
      notes: undefined,
      type: "working",
    });
  });

  it("defaults blank speed-based sets to a duration target", async () => {
    mockCreateExerciseSet.mockResolvedValue(
      makeExerciseSet({
        id: 999,
        reps: null,
        duration_seconds: 600,
        intensity: null,
        intensity_unit_id: 3,
        exercise_id: 123,
      }),
    );

    const exercise = makeExercise({
      id: 123,
      exercise_sets: [],
    });

    const { result } = renderHook(() =>
      useExerciseSetActions({
        exercise,
      }),
    );

    await act(async () => {
      await result.current.addSet(3);
    });

    expect(result.current.exerciseSets[0].duration_seconds).toBe(600);
    expect(mockCreateExerciseSet).toHaveBeenCalledWith({
      duration_seconds: 600,
      intensity: 0,
      rpe: null,
      rir: null,
      intensity_unit_id: 3,
      exercise_id: 123,
      rest_time_seconds: 0,
      done: false,
      notes: undefined,
      type: "warmup",
    });
  });

  it("swaps rep-based speed sets to time when creating a new set", async () => {
    mockCreateExerciseSet.mockResolvedValue(
      makeExerciseSet({
        id: 999,
        reps: null,
        duration_seconds: 600,
        intensity: 10,
        intensity_unit_id: 3,
        exercise_id: 123,
      }),
    );

    const exercise = makeExercise({
      id: 123,
      exercise_sets: [
        makeExerciseSet({
          id: 1,
          exercise_id: 123,
          reps: 12,
          duration_seconds: null,
          intensity: 10,
          intensity_unit_id: 3,
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExerciseSetActions({
        exercise,
      }),
    );

    await act(async () => {
      await result.current.addSet(3);
    });

    expect(result.current.exerciseSets[1].reps).toBeNull();
    expect(result.current.exerciseSets[1].duration_seconds).toBe(600);
    expect(mockCreateExerciseSet).toHaveBeenCalledWith({
      duration_seconds: 600,
      intensity: 10,
      rpe: null,
      rir: null,
      intensity_unit_id: 3,
      exercise_id: 123,
      rest_time_seconds: 0,
      done: false,
      notes: undefined,
      type: "working",
    });
  });

  it("can toggle a set between reps and time", async () => {
    const exercise = makeExercise({
      id: 123,
      workout_id: 456,
      exercise_sets: [
        makeExerciseSet({
          id: 1,
          exercise_id: 123,
          reps: 10,
          duration_seconds: null,
          intensity_unit_id: 3,
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExerciseSetActions({
        exercise,
        workoutId: "456",
      }),
    );

    act(() => {
      result.current.setSetValueMode(1, "time");
    });

    expect(result.current.exerciseSets[0].reps).toBeNull();
    expect(result.current.exerciseSets[0].duration_seconds).toBe(600);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockUpdateExerciseSet).toHaveBeenLastCalledWith(1, {
      reps: null,
      duration_seconds: 600,
    });
  });

  it("keeps exercise sets sorted when initial props arrive out of order", () => {
    const exercise = makeExercise({
      id: 123,
      exercise_sets: [
        makeExerciseSet({
          id: 2,
          exercise_id: 123,
          created_at: "2024-01-02T00:00:00Z",
        }),
        makeExerciseSet({
          id: 1,
          exercise_id: 123,
          created_at: "2024-01-01T00:00:00Z",
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExerciseSetActions({
        exercise,
      }),
    );

    expect(result.current.exerciseSets.map((set) => set.id)).toEqual([1, 2]);
  });

  it("does not let a late create response roll back newer local set edits", async () => {
    let resolveCreateExerciseSet: ((value: ReturnType<typeof makeExerciseSet>) => void) | undefined;
    mockCreateExerciseSet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreateExerciseSet = resolve;
        }),
    );

    const exercise = makeExercise({
      id: 123,
      exercise_sets: [
        makeExerciseSet({
          id: 1,
          exercise_id: 123,
          reps: 10,
          intensity: 50,
        }),
      ],
    });
    const onExerciseUpdate = vi.fn();

    const { result } = renderHook(() =>
      useExerciseSetActions({
        exercise,
        onExerciseUpdate,
      }),
    );

    act(() => {
      void result.current.addSet(2);
    });

    expect(result.current.exerciseSets).toHaveLength(2);
    expect(String(result.current.exerciseSets[1].id)).toContain("temp-");

    act(() => {
      result.current.updateSetField(1, "reps", 12);
    });

    expect(result.current.exerciseSets[0].reps).toBe(12);

    await act(async () => {
      resolveCreateExerciseSet?.(
        makeExerciseSet({
          id: 999,
          exercise_id: 123,
          reps: 10,
          intensity: 50,
          intensity_unit_id: 2,
          created_at: "2024-01-03T00:00:00Z",
        }),
      );
      await Promise.resolve();
    });

    expect(result.current.exerciseSets.map((set) => set.id)).toEqual([1, 999]);
    expect(result.current.exerciseSets[0].reps).toBe(12);
    expect(onExerciseUpdate).toHaveBeenCalled();
  });

  describe("Reliable Repeated Input and Serialization (Option D + K)", () => {
    it("handles a burst of 10 synchronous increments immediately and saves once after 500ms", async () => {
      const exercise = makeExercise({
        id: 123,
        exercise_sets: [
          makeExerciseSet({
            id: 1,
            exercise_id: 123,
            reps: 10,
          }),
        ],
      });

      const { result } = renderHook(() =>
        useExerciseSetActions({
          exercise,
        }),
      );

      act(() => {
        for (let i = 0; i < 10; i += 1) {
          result.current.incrementReps(1);
        }
      });

      // Immediate local update to 20
      expect(result.current.exerciseSets[0].reps).toBe(20);
      expect(mockUpdateExerciseSet).not.toHaveBeenCalled();

      // After 500ms debounce quiet period
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockUpdateExerciseSet).toHaveBeenCalledTimes(1);
      expect(mockUpdateExerciseSet).toHaveBeenCalledWith(1, {
        reps: 20,
        duration_seconds: null,
      });
    });

    it("prevents lost-write race when new input arrives while an earlier request is in flight", async () => {
      let resolveFirstUpdate: (() => void) | undefined;
      mockUpdateExerciseSet.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstUpdate = resolve;
          }),
      );

      const exercise = makeExercise({
        id: 123,
        exercise_sets: [
          makeExerciseSet({
            id: 1,
            exercise_id: 123,
            reps: 10,
          }),
        ],
      });

      const { result } = renderHook(() =>
        useExerciseSetActions({
          exercise,
        }),
      );

      // t = 0ms: First increment
      act(() => {
        result.current.incrementReps(1);
      });
      expect(result.current.exerciseSets[0].reps).toBe(11);

      // t = 500ms: First timer fires, Request A in flight with reps: 11
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(mockUpdateExerciseSet).toHaveBeenCalledTimes(1);
      expect(mockUpdateExerciseSet).toHaveBeenNthCalledWith(1, 1, {
        reps: 11,
        duration_seconds: null,
      });

      // t = 550ms: Second increment while Request A is in flight
      act(() => {
        result.current.incrementReps(1);
      });
      expect(result.current.exerciseSets[0].reps).toBe(12);

      // t = 600ms: Request A resolves
      await act(async () => {
        resolveFirstUpdate?.();
        await Promise.resolve();
      });

      // Advance timers by another 500ms to allow the second debounced update to fire
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      // Verify second request was sent with reps: 12 without TypeError or dropped write
      expect(mockUpdateExerciseSet).toHaveBeenCalledTimes(2);
      expect(mockUpdateExerciseSet).toHaveBeenNthCalledWith(2, 1, {
        reps: 12,
        duration_seconds: null,
      });
      expect(result.current.exerciseSets[0].reps).toBe(12);
    });

    it("serializes overlapping requests so only one request per set is in flight at a time", async () => {
      let resolveFirstUpdate: (() => void) | undefined;
      mockUpdateExerciseSet.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstUpdate = resolve;
          }),
      );

      const exercise = makeExercise({
        id: 123,
        exercise_sets: [
          makeExerciseSet({
            id: 1,
            exercise_id: 123,
            reps: 10,
          }),
        ],
      });

      const { result } = renderHook(() =>
        useExerciseSetActions({
          exercise,
        }),
      );

      // 0ms: +1
      act(() => {
        result.current.incrementReps(1);
      });
      // 500ms: Request A starts
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(mockUpdateExerciseSet).toHaveBeenCalledTimes(1);

      // 550ms: +1
      act(() => {
        result.current.incrementReps(1);
      });
      expect(result.current.exerciseSets[0].reps).toBe(12);

      // 1050ms: Second timer expires, but Request A is STILL in flight
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      // Still only 1 call because Request A has not settled!
      expect(mockUpdateExerciseSet).toHaveBeenCalledTimes(1);

      // Request A now settles
      await act(async () => {
        resolveFirstUpdate?.();
        await Promise.resolve();
      });

      // Now drain next queued update
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockUpdateExerciseSet).toHaveBeenCalledTimes(2);
      expect(mockUpdateExerciseSet).toHaveBeenLastCalledWith(1, {
        reps: 12,
        duration_seconds: null,
      });
    });

    it("preserves dirty local fields when incoming props bring stale server data", () => {
      const exercise = makeExercise({
        id: 123,
        exercise_sets: [
          makeExerciseSet({
            id: 1,
            exercise_id: 123,
            reps: 10,
            notes: "Original note",
          }),
        ],
      });

      const { result, rerender } = renderHook(
        ({ ex }) =>
          useExerciseSetActions({
            exercise: ex,
          }),
        {
          initialProps: { ex: exercise },
        },
      );

      // Make dirty edit locally
      act(() => {
        result.current.incrementReps(1);
      });
      expect(result.current.exerciseSets[0].reps).toBe(11);

      // Server refetch returns stale reps (10) but updated notes ("Server note")
      const staleIncomingExercise = {
        ...exercise,
        exercise_sets: [
          makeExerciseSet({
            id: 1,
            exercise_id: 123,
            reps: 10,
            notes: "Server note",
          }),
        ],
      };

      rerender({ ex: staleIncomingExercise });

      // Local dirty reps (11) must be preserved, while clean notes ("Server note") is adopted!
      expect(result.current.exerciseSets[0].reps).toBe(11);
      expect(result.current.exerciseSets[0].notes).toBe("Server note");
    });

    it("queues edits on a temporary set until creation resolves with a real server ID", async () => {
      let resolveCreate: ((value: ReturnType<typeof makeExerciseSet>) => void) | undefined;
      mockCreateExerciseSet.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          }),
      );

      const exercise = makeExercise({
        id: 123,
        exercise_sets: [],
      });

      const { result } = renderHook(() =>
        useExerciseSetActions({
          exercise,
        }),
      );

      act(() => {
        void result.current.addSet(1);
      });

      const tempId = result.current.exerciseSets[0].id;
      expect(String(tempId)).toContain("temp-");

      // Increment on temp set before create resolves
      act(() => {
        result.current.incrementReps(tempId);
      });

      // Advance debounce timer
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      // No PUT to temp ID
      expect(mockUpdateExerciseSet).not.toHaveBeenCalled();

      // Create resolves with server ID 777
      await act(async () => {
        resolveCreate?.(
          makeExerciseSet({
            id: 777,
            exercise_id: 123,
            reps: 0,
          }),
        );
        await Promise.resolve();
      });

      // Advance timers for queued edit to flush
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockUpdateExerciseSet).toHaveBeenCalledWith(777, {
        reps: 1,
        duration_seconds: null,
      });
    });

    it("cancels pending update timers when a set is deleted", async () => {
      const exercise = makeExercise({
        id: 123,
        exercise_sets: [
          makeExerciseSet({
            id: 1,
            exercise_id: 123,
            reps: 10,
          }),
        ],
      });

      const { result } = renderHook(() =>
        useExerciseSetActions({
          exercise,
        }),
      );

      act(() => {
        result.current.incrementReps(1);
      });

      // Delete set before debounce timer expires
      await act(async () => {
        await result.current.deleteSet(1);
      });

      // Advance debounce timer
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      // No update should be sent for the deleted set
      expect(mockUpdateExerciseSet).not.toHaveBeenCalled();
    });
  });
});
