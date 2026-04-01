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
      result.current.updateSetField(1, "weight", 60);
    });

    expect(result.current.exerciseSets[0].intensity).toBe(60);
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
      intensity: 60,
      reps: 12,
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
      intensity_unit_id: 2,
      exercise_id: 123,
      rest_time_seconds: 0,
      done: false,
      notes: undefined,
      type: "working",
    });
    expect(onExerciseUpdate).toHaveBeenCalled();
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
});
