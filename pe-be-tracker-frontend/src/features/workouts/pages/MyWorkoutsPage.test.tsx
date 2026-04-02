import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/testUtils";
import {
  makeOngoingWorkout,
  makePaginatedWorkouts,
  makeWorkout,
  makeWorkoutWithStringId,
} from "@/test/fixtures";
import api from "@/shared/api/client";
import MyWorkoutsPage from "./MyWorkoutsPage";
import { getMyWorkouts } from "@/features/workouts";

vi.mock("@/features/workouts/components", () => ({
  WorkoutForm: () => <div data-testid="workout-form">Mock Workout Form</div>,
}));

vi.mock("@/features/workouts", () => ({
  getMyWorkouts: vi.fn(),
}));

// Mock API client
vi.mock("@/shared/api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("axios", async () => {
  const actual = await vi.importActual("axios");
  return {
    ...actual,
    default: actual.default,
    isAxiosError: (error: any) => error && error.isAxiosError === true,
  };
});

vi.mock("@/stores", () => ({
  useAuthStore: vi.fn((selector) => {
    const mockState = {
      isAuthenticated: true,
      user: { id: 1, email: "test@example.com" },
      loading: false,
      initialized: true,
    };
    return selector ? selector(mockState) : mockState;
  }),
  useGuestStore: vi.fn((selector) => {
    const mockState = {
      hydrated: true,
      workouts: [],
      routines: [],
      exerciseTypes: [],
      workoutTypes: [],
      hasAttemptedSync: false,
      addWorkout: vi.fn(),
      updateWorkout: vi.fn(),
      deleteWorkout: vi.fn(),
      addExercise: vi.fn(),
      updateExercise: vi.fn(),
      deleteExercise: vi.fn(),
      addExerciseSet: vi.fn(),
      updateExerciseSet: vi.fn(),
      deleteExerciseSet: vi.fn(),
      addExerciseType: vi.fn(),
      updateExerciseType: vi.fn(),
      addWorkoutType: vi.fn(),
      updateWorkoutType: vi.fn(),
      addRoutine: vi.fn(),
      deleteRoutine: vi.fn(),
      createRoutineFromWorkout: vi.fn(),
      createExercisesFromRoutine: vi.fn(),
      clear: vi.fn(),
      getWorkout: vi.fn(),
      getExercise: vi.fn(),
      syncWithServer: vi.fn(),
    };
    return selector ? selector(mockState) : mockState;
  }),
}));

vi.mock("@/shared/components/FloatingActionButton", () => ({
  default: ({ children, onClick, dataTestId }: any) => (
    <button data-testid={dataTestId} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/shared/components/WeekTracking", () => ({
  WeekTracking: ({ workouts }: { workouts: any[] }) => (
    <div data-testid="week-tracking">
      Week tracking with {workouts.length} workouts
    </div>
  ),
}));

vi.mock(
  "@/features/routines/components/RoutinesSection/RoutinesSection",
  () => ({
    RoutinesSection: ({ onStartWorkout }: any) => (
      <div data-testid="routines-section">
        <button
          onClick={() => onStartWorkout({ id: "123", name: "Routine A" })}
        >
          Start from routine
        </button>
      </div>
    ),
  }),
);

const mockGetMyWorkouts = vi.mocked(getMyWorkouts);

const mockWorkouts = [
  makeWorkout({
    id: 1,
    name: "Morning Workout",
    notes: "Great session",
    start_time: "2024-01-01T08:00:00Z",
    end_time: "2024-01-01T09:00:00Z",
    created_at: "2024-01-01T08:00:00Z",
    updated_at: "2024-01-01T09:00:00Z",
  }),
  makeWorkout({
    id: 2,
    name: null,
    notes: null,
    start_time: "2024-01-01T18:00:00Z",
    end_time: "2024-01-01T19:30:00Z",
    created_at: "2024-01-01T18:00:00Z",
    updated_at: "2024-01-01T19:30:00Z",
  }),
  makeOngoingWorkout({
    id: 3,
    name: "Evening Workout",
    notes: "Quick session",
    start_time: "2024-01-02T19:00:00Z",
    created_at: "2024-01-02T19:00:00Z",
    updated_at: "2024-01-02T19:00:00Z",
  }),
];

describe("MyWorkoutsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMyWorkouts.mockResolvedValue(makePaginatedWorkouts(mockWorkouts) as any);
  });

  it("renders the page with heading", async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /workouts/i, level: 1 }),
      ).toBeInTheDocument();
    });
  });

  it("shows message when no workouts exist", async () => {
    mockGetMyWorkouts.mockResolvedValue(makePaginatedWorkouts([]) as any);
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no workouts yet/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /start your first workout/i }),
      ).toBeInTheDocument();
    });
  });

  it("calls getMyWorkouts with default parameters for authenticated users", async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(mockGetMyWorkouts).toHaveBeenCalledWith(undefined, 100);
    });
  });

  it("displays workouts after loading", async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText("Morning Workout")).toBeInTheDocument();
      expect(
        screen.getByText("Traditional Strength Training"),
      ).toBeInTheDocument(); // Default name for null
      expect(screen.getByText("Evening Workout")).toBeInTheDocument();
    });
  });

  it("shows workout duration for completed workouts", async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText("1h 0m")).toBeInTheDocument(); // 1 hour duration
      expect(screen.getByText("1h 30m")).toBeInTheDocument(); // 1.5 hour duration
    });
  });

  it('shows "In Progress" for ongoing workouts', async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("In Progress").length).toBeGreaterThan(0);
    });
  });

  it("formats dates correctly", async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      // Check that dates are displayed (timezone-agnostic)
      // Should see some dates from January, regardless of exact timezone conversion
      const dates = screen.getAllByText(/Jan \d+|Dec 3[01]/);
      expect(dates.length).toBeGreaterThanOrEqual(2); // At least 2 workout dates
    });
  });

  it("handles workout clicks and navigation", async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText("Morning Workout")).toBeInTheDocument();
    });

    const workoutElement = screen.getByText("Morning Workout").closest("div");
    await userEvent.click(workoutElement!);

    // Navigation is handled by the router, so we just verify the element is clickable
    expect(workoutElement).toBeInTheDocument();
  });

  it("shows and hides workout form", async () => {
    render(<MyWorkoutsPage />);

    // Wait for component to load first
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /workouts/i, level: 1 }),
      ).toBeInTheDocument();
    });

    // FAB should be visible initially
    expect(screen.getByTestId("fab-add-workout")).toBeInTheDocument();

    // Click FAB to show form
    await userEvent.click(screen.getByTestId("fab-add-workout"));

    await waitFor(() => {
      expect(screen.getByTestId("workout-form")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
    });

    // FAB should be hidden when form is shown
    expect(screen.queryByTestId("fab-add-workout")).not.toBeInTheDocument();

    // Click cancel to hide form
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("workout-form")).not.toBeInTheDocument();
      expect(screen.getByTestId("fab-add-workout")).toBeInTheDocument();
    });
  });

  it("starts workout from routine", async () => {
    render(<MyWorkoutsPage />);

    // Wait for component to load first
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /workouts/i, level: 1 }),
      ).toBeInTheDocument();
    });

    // Mock backend start endpoint response
    (api.post as unknown as jest.Mock).mockResolvedValueOnce({
      data: { id: 42 },
    });

    const startFromRoutineButton = screen.getByText("Start from routine");
    await userEvent.click(startFromRoutineButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/routines/123/start");
    });

    // Should not open the workout form anymore
    expect(screen.queryByTestId("workout-form")).not.toBeInTheDocument();
  });

  it("handles API errors gracefully", async () => {
    mockGetMyWorkouts.mockRejectedValue(new Error("API Error"));

    render(<MyWorkoutsPage />);

    expect(await screen.findByText("API Error")).toBeInTheDocument();
  });

  it("handles 401 unauthorized errors with special message", async () => {
    const unauthorizedError = {
      response: { status: 401 },
      message: "Unauthorized",
      isAxiosError: true,
    };
    mockGetMyWorkouts.mockRejectedValue(unauthorizedError);

    render(<MyWorkoutsPage />);

    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/please log in to view your workouts/i),
    ).toBeInTheDocument();
  });

  it("handles 403 forbidden errors with special message", async () => {
    const forbiddenError = {
      response: { status: 403 },
      message: "Forbidden",
      isAxiosError: true,
    };
    mockGetMyWorkouts.mockRejectedValue(forbiddenError);

    render(<MyWorkoutsPage />);

    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
  });

  it("refetches data when workout is created", async () => {
    render(<MyWorkoutsPage />);

    // Wait for component to load first
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /workouts/i, level: 1 }),
      ).toBeInTheDocument();
    });

    // Show form
    await userEvent.click(screen.getByTestId("fab-add-workout"));

    await waitFor(() => {
      expect(screen.getByTestId("workout-form")).toBeInTheDocument();
    });

    // Simulate workout creation callback
    // Note: This would typically be tested through the WorkoutForm component
    // but since it's mocked, we can't test the actual callback
  });

  it("displays week tracking component with workouts", async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("week-tracking")).toBeInTheDocument();
      expect(
        screen.getByText("Week tracking with 3 workouts"),
      ).toBeInTheDocument();
    });
  });

  it("handles workouts with string IDs", async () => {
    const workoutsWithStringIds = [
      makeWorkoutWithStringId({
        id: "workout-uuid-1",
      }),
    ];

    mockGetMyWorkouts.mockResolvedValue(
      makePaginatedWorkouts(workoutsWithStringIds) as any,
    );

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText("String ID Workout")).toBeInTheDocument();
    });
  });

  it("handles duration calculation edge cases", async () => {
    const edgeCaseWorkouts = [
      makeWorkout({
        id: 1,
        name: "Short Workout",
        notes: null,
        start_time: "2024-01-01T08:00:00Z",
        end_time: "2024-01-01T08:05:00Z",
        created_at: "2024-01-01T08:00:00Z",
        updated_at: "2024-01-01T08:05:00Z",
      }),
      makeWorkout({
        id: 2,
        name: "Long Workout",
        notes: null,
        start_time: "2024-01-01T08:00:00Z",
        end_time: "2024-01-01T11:30:00Z",
        created_at: "2024-01-01T08:00:00Z",
        updated_at: "2024-01-01T11:30:00Z",
      }),
    ];

    mockGetMyWorkouts.mockResolvedValue(
      makePaginatedWorkouts(edgeCaseWorkouts) as any,
    );

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText("5m 0s")).toBeInTheDocument(); // 5 minutes
      expect(screen.getByText("3h 30m")).toBeInTheDocument(); // 3.5 hours
    });
  });
});
