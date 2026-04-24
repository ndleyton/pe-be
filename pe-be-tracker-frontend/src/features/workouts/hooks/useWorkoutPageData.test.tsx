import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeGuestWorkout,
  makeRoutine,
  makeWorkout,
} from "@/test/fixtures";

const mockNavigate = vi.fn();

const {
  mockGetExercisesInWorkout,
  mockSyncWorkoutTimer,
  mockCreateExercisesFromRoutine,
  mockAuthState,
  mockGuestState,
} = vi.hoisted(() => ({
  mockGetExercisesInWorkout: vi.fn(),
  mockSyncWorkoutTimer: vi.fn(),
  mockCreateExercisesFromRoutine: vi.fn(),
  mockAuthState: {
    isAuthenticated: true,
    initialized: true,
  },
  mockGuestState: {
    hydrated: true,
    workouts: [] as ReturnType<typeof makeGuestWorkout>[],
  },
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
    get: vi.fn(),
  },
}));

vi.mock("@/features/exercises/api", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/exercises/api")
  >("@/features/exercises/api");
  return {
    ...actual,
    getExercisesInWorkout: mockGetExercisesInWorkout,
  };
});

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
  useGuestStore: (
    selector: (
      state: typeof mockGuestState & {
        createExercisesFromRoutine: typeof mockCreateExercisesFromRoutine;
      },
    ) => unknown,
  ) =>
    selector({
      ...mockGuestState,
      createExercisesFromRoutine: mockCreateExercisesFromRoutine,
    }),
  useUIStore: (
    selector: (state: { syncWorkoutTimer: typeof mockSyncWorkoutTimer }) => unknown,
  ) =>
    selector({
      syncWorkoutTimer: mockSyncWorkoutTimer,
    }),
}));

import api from "@/shared/api/client";
import { useWorkoutPageData } from "./useWorkoutPageData";

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

describe("useWorkoutPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    mockAuthState.initialized = true;
    mockGuestState.hydrated = true;
    mockGuestState.workouts = [];
    vi.mocked(api.get).mockResolvedValue({
      data: makeWorkout({
        id: 123,
        end_time: null,
        name: "Chest Day",
        start_time: "2024-01-01T10:00:00.000Z",
      }),
    });
    mockGetExercisesInWorkout.mockResolvedValue([]);
  });

  it("loads authenticated workout data and syncs the workout timer", async () => {
    const { result } = renderHook(
      () =>
        useWorkoutPageData({
          pathname: "/workouts/123",
          routeState: null,
          workoutId: "123",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.workoutName).toBe("Chest Day");
      expect(result.current.listStatus).toBe("success");
    });

    expect(mockGetExercisesInWorkout).toHaveBeenCalledWith("123");
    expect(mockSyncWorkoutTimer).toHaveBeenCalledWith({
      id: 123,
      startTime: "2024-01-01T10:00:00.000Z",
      endTime: null,
    });
  });

  it("uses guest workout data and hydrates exercises from the routine route state", async () => {
    mockAuthState.isAuthenticated = false;
    const guestWorkout = makeGuestWorkout({
      id: "guest-123",
      name: "Guest Chest Day",
      exercises: [],
    });
    const routine = makeRoutine({ id: 44, name: "Push Day" });
    mockGuestState.workouts = [guestWorkout];

    const { result } = renderHook(
      () =>
        useWorkoutPageData({
          pathname: "/workouts/guest-123",
          routeState: { routine },
          workoutId: "guest-123",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.workoutName).toBe("Guest Chest Day");
      expect(result.current.listStatus).toBe("success");
    });

    expect(vi.mocked(api.get)).not.toHaveBeenCalled();
    expect(mockCreateExercisesFromRoutine).toHaveBeenCalledWith(
      routine,
      "guest-123",
    );
    expect(mockSyncWorkoutTimer).toHaveBeenCalledWith({
      id: "guest-123",
      startTime: guestWorkout.start_time,
      endTime: guestWorkout.end_time,
    });
  });

  it("waits for guest hydration before creating exercises from the routine", async () => {
    mockAuthState.isAuthenticated = false;
    mockGuestState.hydrated = false;
    const guestWorkout = makeGuestWorkout({
      id: "guest-123",
      exercises: [],
    });
    const routine = makeRoutine({ id: 44, name: "Push Day" });

    const { rerender } = renderHook(
      () =>
        useWorkoutPageData({
          pathname: "/workouts/guest-123",
          routeState: { routine },
          workoutId: "guest-123",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(mockCreateExercisesFromRoutine).not.toHaveBeenCalled();

    mockGuestState.hydrated = true;
    mockGuestState.workouts = [guestWorkout];
    rerender();

    await waitFor(() => {
      expect(mockCreateExercisesFromRoutine).toHaveBeenCalledWith(
        routine,
        "guest-123",
      );
    });
  });
});
