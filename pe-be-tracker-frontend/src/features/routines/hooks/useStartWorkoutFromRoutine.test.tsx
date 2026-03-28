import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { renderHook } from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  makeGuestRoutine,
  makeGuestRoutineExercise,
  makeGuestRoutineSet,
  makeGuestWorkoutType,
} from "@/test/fixtures";

const mockNavigate = vi.fn();

const {
  mockStartWorkoutFromRoutine,
  mockAddWorkout,
  mockAuthState,
  mockGuestState,
} = vi.hoisted(() => ({
  mockStartWorkoutFromRoutine: vi.fn(),
  mockAddWorkout: vi.fn(),
  mockAuthState: {
    isAuthenticated: true,
  },
  mockGuestState: {
    workoutTypes: [] as Array<ReturnType<typeof makeGuestWorkoutType>>,
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

vi.mock("@/features/routines/api", () => ({
  startWorkoutFromRoutine: mockStartWorkoutFromRoutine,
}));

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
  useGuestStore: (
    selector: (state: typeof mockGuestState & { addWorkout: typeof mockAddWorkout }) => unknown,
  ) =>
    selector({
      ...mockGuestState,
      addWorkout: mockAddWorkout,
    }),
}));

import { useStartWorkoutFromRoutine } from "./useStartWorkoutFromRoutine";

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

describe("useStartWorkoutFromRoutine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    mockGuestState.workoutTypes = [];
    mockStartWorkoutFromRoutine.mockResolvedValue({ id: 321 });
    mockAddWorkout.mockReturnValue("guest-workout-1");
  });

  it("starts a server workout for authenticated users", async () => {
    const routine = makeGuestRoutine({ id: "42", name: "Push Day" });
    const { result } = renderHook(() => useStartWorkoutFromRoutine(), {
      wrapper: createWrapper(),
    });

    await result.current(routine);

    expect(mockStartWorkoutFromRoutine).toHaveBeenCalledWith(42);
    expect(mockAddWorkout).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/workouts/321");
  });

  it("creates a guest workout with the preferred default workout type", async () => {
    mockAuthState.isAuthenticated = false;
    const defaultWorkoutType = makeGuestWorkoutType({
      id: "8",
      name: "Other",
    });
    const fallbackWorkoutType = makeGuestWorkoutType({
      id: "11",
      name: "Strength",
    });
    mockGuestState.workoutTypes = [fallbackWorkoutType, defaultWorkoutType];

    const routine = makeGuestRoutine({
      id: "guest-routine-42",
      name: "Push Day",
      exercises: [
        makeGuestRoutineExercise({
          sets: [makeGuestRoutineSet()],
        }),
      ],
    });
    const { result } = renderHook(() => useStartWorkoutFromRoutine(), {
      wrapper: createWrapper(),
    });

    await result.current(routine);

    expect(mockStartWorkoutFromRoutine).not.toHaveBeenCalled();
    expect(mockAddWorkout).toHaveBeenCalledTimes(1);
    expect(mockAddWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringMatching(/^Push Day - /),
        notes: null,
        end_time: null,
        workout_type_id: "8",
        workout_type: defaultWorkoutType,
        exercises: [],
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/workouts/guest-workout-1", {
      state: { routine },
    });
  });

  it("falls back to the first guest workout type when the preferred one is unavailable", async () => {
    mockAuthState.isAuthenticated = false;
    const fallbackWorkoutType = makeGuestWorkoutType({
      id: "11",
      name: "Strength",
    });
    mockGuestState.workoutTypes = [fallbackWorkoutType];

    const routine = makeGuestRoutine({ id: "guest-routine-42" });
    const { result } = renderHook(() => useStartWorkoutFromRoutine(), {
      wrapper: createWrapper(),
    });

    await result.current(routine);

    expect(mockAddWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        workout_type_id: "11",
        workout_type: fallbackWorkoutType,
      }),
    );
  });
});
