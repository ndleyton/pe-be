import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeExerciseType,
  makeWorkout,
} from "@/test/fixtures";

const mockNavigate = vi.fn();

const {
  mockCreateExercise,
  mockGetExerciseTypes,
  mockGuestAddExercise,
  mockGuestDeleteExercise,
  mockGuestUpdateExercise,
  mockGuestUpdateWorkout,
} = vi.hoisted(() => ({
  mockCreateExercise: vi.fn(),
  mockGetExerciseTypes: vi.fn(),
  mockGuestAddExercise: vi.fn(),
  mockGuestDeleteExercise: vi.fn(),
  mockGuestUpdateExercise: vi.fn(),
  mockGuestUpdateWorkout: vi.fn(),
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

vi.mock("@/shared/api/client", () => ({
  default: {
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/features/exercises/api", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/exercises/api")
  >("@/features/exercises/api");
  return {
    ...actual,
    createExercise: mockCreateExercise,
    getExerciseTypes: mockGetExerciseTypes,
  };
});

vi.mock("@/stores", () => ({
  useGuestStore: (
    selector: (
      state: {
        addExercise: typeof mockGuestAddExercise;
        deleteExercise: typeof mockGuestDeleteExercise;
        updateExercise: typeof mockGuestUpdateExercise;
        updateWorkout: typeof mockGuestUpdateWorkout;
      },
    ) => unknown,
  ) =>
    selector({
      addExercise: mockGuestAddExercise,
      deleteExercise: mockGuestDeleteExercise,
      updateExercise: mockGuestUpdateExercise,
      updateWorkout: mockGuestUpdateWorkout,
    }),
}));

import api from "@/shared/api/client";
import { useWorkoutExerciseActions } from "./useWorkoutExerciseActions";

const createWrapper = () => {
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

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useWorkoutExerciseActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.patch).mockResolvedValue({
      data: makeWorkout({
        id: 123,
        end_time: "2024-01-01T11:00:00.000Z",
      }),
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  it("finishes an authenticated workout and navigates back to workouts", async () => {
    const closeFinishModal = vi.fn();
    const { result } = renderHook(
      () =>
        useWorkoutExerciseActions({
          exercises: [],
          isAuthenticated: true,
          onFinishModalClose: closeFinishModal,
          serverWorkout: makeWorkout({ id: 123 }),
          showFinishModal: false,
          workoutId: "123",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    act(() => {
      result.current.handleFinishWorkout();
    });

    await waitFor(() => {
      expect(vi.mocked(api.patch)).toHaveBeenCalledWith("/workouts/123", {
        end_time: expect.any(String),
      });
    });

    expect(closeFinishModal).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/workouts");
  });

  it("adds a guest exercise without going through the server mutation flow", () => {
    const { result } = renderHook(
      () =>
        useWorkoutExerciseActions({
          exercises: [],
          isAuthenticated: false,
          onFinishModalClose: vi.fn(),
          serverWorkout: undefined,
          showFinishModal: false,
          workoutId: "guest-123",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    act(() => {
      result.current.handleSelectExerciseType(
        makeExerciseType({ id: 99, name: "Cable Fly" }) as never,
      );
    });

    expect(mockGuestAddExercise).toHaveBeenCalledWith(
      expect.objectContaining({
        exercise_type_id: "99",
        workout_id: "guest-123",
        notes: null,
      }),
    );
    expect(mockCreateExercise).not.toHaveBeenCalled();
  });
});
