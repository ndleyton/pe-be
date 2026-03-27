import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Outlet, RouterProvider, createMemoryRouter } from "react-router-dom";
import api from "@/shared/api/client";
import routes from "./routes";

const mockWorkoutId = "123";

vi.mock("./layouts/AppLayout", () => ({
  default: () => <Outlet />,
}));

vi.mock("@/features/chat/pages", () => ({
  ChatPage: () => <div>Chat Page</div>,
}));

vi.mock("@/features/workouts/pages", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/workouts/pages")
  >("@/features/workouts/pages");

  return {
    ...actual,
    MyWorkoutsPage: () => <div>My Workouts Page</div>,
  };
});

vi.mock("@/shared/api/client", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/features/exercises/api", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/exercises/api")
  >("@/features/exercises/api");

  return {
    ...actual,
    getExercisesInWorkout: vi.fn().mockResolvedValue([]),
    createExercise: vi.fn(),
  };
});

vi.mock("@/features/exercises/components", () => ({
  ExerciseList: () => <div data-testid="exercise-list" />,
  ExerciseTypeModal: () => <div data-testid="exercise-type-modal" />,
}));

vi.mock("@/features/workouts/components", () => ({
  FinishWorkoutModal: () => null,
}));

vi.mock("@/features/routines/components/SaveRoutineModal/SaveRoutineModal", () => ({
  SaveRoutineModal: () => null,
}));

vi.mock("@/shared/components/FloatingActionButton", () => ({
  default: () => null,
}));

const mockGuestState = {
  workouts: [],
  hydrated: true,
  deleteExercise: vi.fn(),
  createExercisesFromRoutine: vi.fn(),
  addExercise: vi.fn(),
  updateExercise: vi.fn(),
  updateWorkout: vi.fn(),
};

const mockAuthState = {
  isAuthenticated: true,
  loading: false,
};

const mockUIState = {
  workoutTimer: { startTime: null },
  startWorkoutTimer: vi.fn(),
  stopWorkoutTimer: vi.fn(),
  syncWorkoutTimer: vi.fn(),
  getFormattedWorkoutTime: vi.fn(() => "00:00"),
};

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
  useGuestStore: (
    selector?: (state: typeof mockGuestState) => unknown,
  ) => {
    if (selector) return selector(mockGuestState);
    return mockGuestState;
  },
  useUIStore: (selector: (state: typeof mockUIState) => unknown) =>
    selector(mockUIState),
}));

describe("routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    mockAuthState.loading = false;
    mockGuestState.workouts = [];
    mockGuestState.hydrated = true;
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === `/workouts/${mockWorkoutId}`) {
        return Promise.reject({ response: { status: 404 } });
      }

      return Promise.resolve({ data: null });
    });
  });

  it("renders the not found page for an invalid workout detail route", async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: [`/workouts/${mockWorkoutId}`],
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: /page not found/i, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/loading workout/i)).not.toBeInTheDocument();
  });
});
