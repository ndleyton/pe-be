import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  makeExercise,
  makeExerciseType,
} from "@/test/fixtures";

const mockNavigate = vi.fn();

const {
  mockCreateExercise,
  mockUpdateWorkout,
  mockAddGuestExercise,
  mockDeleteGuestExercise,
  mockUpdateGuestExercise,
  mockUpdateGuestWorkout,
} = vi.hoisted(() => ({
  mockCreateExercise: vi.fn(),
  mockUpdateWorkout: vi.fn(),
  mockAddGuestExercise: vi.fn(),
  mockDeleteGuestExercise: vi.fn(),
  mockUpdateGuestExercise: vi.fn(),
  mockUpdateGuestWorkout: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/features/exercises/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/exercises/api")>(
    "@/features/exercises/api",
  );
  return {
    ...actual,
    createExercise: mockCreateExercise,
  };
});

vi.mock("@/features/workouts/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/workouts/api")>(
    "@/features/workouts/api",
  );
  return {
    ...actual,
    updateWorkout: mockUpdateWorkout,
  };
});

vi.mock("@/stores", () => ({
  useGuestStore: (
    selector: (state: {
      addExercise: typeof mockAddGuestExercise;
      deleteExercise: typeof mockDeleteGuestExercise;
      updateExercise: typeof mockUpdateGuestExercise;
      updateWorkout: typeof mockUpdateGuestWorkout;
    }) => unknown,
  ) =>
    selector({
      addExercise: mockAddGuestExercise,
      deleteExercise: mockDeleteGuestExercise,
      updateExercise: mockUpdateGuestExercise,
      updateWorkout: mockUpdateGuestWorkout,
    }),
}));

import { useWorkoutExerciseActions } from "./useWorkoutExerciseActions";

const createWrapper = (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

describe("useWorkoutExerciseActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateWorkout.mockResolvedValue({ id: 123, end_time: "2024-01-01T00:00:00.000Z" });
  });

  it("optimistically adds an authenticated exercise and replaces it with the server response", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    let resolveCreateExercise: (value: unknown) => void;
    const createExercisePromise = new Promise((resolve) => {
      resolveCreateExercise = resolve;
    });
    mockCreateExercise.mockReturnValue(createExercisePromise);

    const setShowAddExerciseModal = vi.fn();
    const setShowFinishModal = vi.fn();
    const exerciseType = makeExerciseType({ id: 42, name: "Bench Press" });
    const { result } = renderHook(
      () =>
        useWorkoutExerciseActions({
          workoutId: "123",
          isAuthenticated: true,
          setShowAddExerciseModal,
          setShowFinishModal,
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    act(() => {
      result.current.handleSelectExerciseType(exerciseType);
    });

    await waitFor(() => {
      const exercises = queryClient.getQueryData<Array<{ id: string | number }>>([
        "exercises",
        "123",
      ]);
      expect(exercises?.[0]?.id).toMatch(/^optimistic-/);
    });

    const createdExercise = makeExercise({
      id: 999,
      exercise_type_id: 42,
      workout_id: 123,
      exercise_type: exerciseType,
      exercise_sets: [],
    });
    resolveCreateExercise!(createdExercise);

    await waitFor(() => {
      expect(
        queryClient.getQueryData<Array<{ id: string | number }>>([
          "exercises",
          "123",
        ]),
      ).toEqual([expect.objectContaining({ id: 999 })]);
    });

    expect(setShowAddExerciseModal).toHaveBeenCalledWith(false);
  });

  it("finishes a guest workout locally and navigates back to workouts", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
    const setShowAddExerciseModal = vi.fn();
    const setShowFinishModal = vi.fn();

    const { result } = renderHook(
      () =>
        useWorkoutExerciseActions({
          workoutId: "guest-workout-1",
          isAuthenticated: false,
          setShowAddExerciseModal,
          setShowFinishModal,
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    act(() => {
      result.current.handleFinishWorkout();
    });

    expect(mockUpdateGuestWorkout).toHaveBeenCalledWith("guest-workout-1", {
      end_time: expect.any(String),
    });
    expect(setShowFinishModal).toHaveBeenCalledWith(false);
    expect(mockNavigate).toHaveBeenCalledWith("/workouts");
  });
});
