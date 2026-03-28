import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { renderHook, waitFor } from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  makeExercise,
  makeGuestRoutine,
  makeGuestWorkout,
  makeGuestWorkoutType,
  makeWorkout,
} from "@/test/fixtures";

const {
  mockGetExercisesInWorkout,
  mockGetWorkoutById,
  mockAuthState,
  mockCreateExercisesFromRoutine,
  mockGuestState,
  mockSyncWorkoutTimer,
} = vi.hoisted(() => ({
  mockGetExercisesInWorkout: vi.fn(),
  mockGetWorkoutById: vi.fn(),
  mockCreateExercisesFromRoutine: vi.fn(),
  mockSyncWorkoutTimer: vi.fn(),
  mockAuthState: {
    isAuthenticated: true,
    loading: false,
  },
  mockGuestState: {
    hydrated: true,
    workouts: [] as ReturnType<typeof makeGuestWorkout>[],
  },
}));

vi.mock("@/features/exercises/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/exercises/api")>(
    "@/features/exercises/api",
  );
  return {
    ...actual,
    getExercisesInWorkout: mockGetExercisesInWorkout,
  };
});

vi.mock("@/features/workouts/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/workouts/api")>(
    "@/features/workouts/api",
  );
  return {
    ...actual,
    getWorkoutById: mockGetWorkoutById,
  };
});

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
  useGuestStore: (
    selector: (state: typeof mockGuestState & { createExercisesFromRoutine: typeof mockCreateExercisesFromRoutine }) => unknown,
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
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("useWorkoutPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    mockAuthState.loading = false;
    mockGuestState.hydrated = true;
    mockGuestState.workouts = [];
  });

  it("loads authenticated workout data and syncs the workout timer", async () => {
    const workout = makeWorkout({
      id: 123,
      name: "Chest Day",
      workout_type_id: 5,
    });
    const exercise = makeExercise({
      workout_id: 123,
    });
    mockGetWorkoutById.mockResolvedValue(workout);
    mockGetExercisesInWorkout.mockResolvedValue([exercise]);

    const { result } = renderHook(
      () =>
        useWorkoutPageData({
          workoutId: "123",
          shouldScrollToBottomOnLoad: false,
          onPromptFinishWorkout: vi.fn(),
        }),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.workoutName).toBe("Chest Day");
    });

    expect(result.current.exercises).toHaveLength(1);
    expect(result.current.workoutTypeId).toBe(5);
    expect(result.current.listStatus).toBe("success");
    expect(mockSyncWorkoutTimer).toHaveBeenCalledWith({
      id: workout.id,
      startTime: workout.start_time,
      endTime: workout.end_time,
    });
  });

  it("uses guest workout data and creates routine exercises locally", async () => {
    mockAuthState.isAuthenticated = false;
    const workoutType = makeGuestWorkoutType({ id: "8", name: "Other" });
    const guestWorkout = makeGuestWorkout({
      id: "guest-workout-1",
      name: "Guest Chest Day",
      workout_type_id: workoutType.id,
      workout_type: workoutType,
      exercises: [],
    });
    const routine = makeGuestRoutine({
      id: "guest-routine-1",
      name: "Push Day",
    });
    mockGuestState.workouts = [guestWorkout];

    const { result } = renderHook(
      () =>
        useWorkoutPageData({
          workoutId: "guest-workout-1",
          routine,
          shouldScrollToBottomOnLoad: false,
          onPromptFinishWorkout: vi.fn(),
        }),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(mockCreateExercisesFromRoutine).toHaveBeenCalledWith(
        routine,
        "guest-workout-1",
      );
    });

    expect(result.current.workoutName).toBe("Guest Chest Day");
    expect(result.current.showNotFound).toBe(false);
    expect(mockGetWorkoutById).not.toHaveBeenCalled();
    expect(mockGetExercisesInWorkout).not.toHaveBeenCalled();
    expect(mockSyncWorkoutTimer).toHaveBeenCalledWith({
      id: guestWorkout.id,
      startTime: guestWorkout.start_time,
      endTime: guestWorkout.end_time,
    });
  });
});
