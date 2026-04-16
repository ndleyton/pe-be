import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/test/testUtils";
import api from "@/shared/api/client";
import WorkoutPage from "./WorkoutPage";

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockWorkoutId = "123";
let mockLocationState: unknown;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ workoutId: mockWorkoutId }),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: `/workouts/${mockWorkoutId}`, state: mockLocationState }),
  };
});

const mockExerciseType = {
  id: 42,
  name: "Bench Press",
  description: "Chest",
  default_intensity_unit: 1,
  times_used: 0,
  equipment: null,
  instructions: null,
  category: null,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  usage_count: 0,
  muscles: [],
  muscle_groups: [],
};

const exerciseComponentsMocks = vi.hoisted(() => ({
  ExerciseListMock: vi.fn(
    ({
      exercises,
      status,
    }: {
      exercises: { id: number | string }[];
      status: "idle" | "pending" | "success" | "error";
    }) => (
      <div data-testid="exercise-list">
        <div data-testid="exercise-list-status">{status}</div>
        {exercises.map((exercise) => (
          <div key={String(exercise.id)}>{String(exercise.id)}</div>
        ))}
      </div>
    ),
  ),
}));

// Mock exercise-related components used by WorkoutPage
vi.mock("@/features/exercises/components", () => ({
  ExerciseList: exerciseComponentsMocks.ExerciseListMock,
}));

vi.mock("@/features/exercises/components/ExerciseTypeModal/ExerciseTypeModal", () => ({
  default: ({
    isOpen,
    onSelect,
  }: {
    isOpen: boolean;
    onSelect: (exerciseType: typeof mockExerciseType) => void;
  }) =>
    isOpen ? (
      <button type="button" onClick={() => onSelect(mockExerciseType)}>
        Select Exercise Type
      </button>
    ) : (
      <div data-testid="exercise-type-modal" />
    ),
}));

const exerciseApiMocks = vi.hoisted(() => ({
  mockGetExercisesInWorkout: vi.fn(),
  mockCreateExercise: vi.fn(),
}));

vi.mock("@/features/exercises/api", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/exercises/api")
  >("@/features/exercises/api");
  return {
    ...actual,
    getExercisesInWorkout: exerciseApiMocks.mockGetExercisesInWorkout,
    createExercise: exerciseApiMocks.mockCreateExercise,
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
  initialized: true,
};

const mockUIState = {
  workoutTimer: { startTime: null },
  startWorkoutTimer: vi.fn(),
  stopWorkoutTimer: vi.fn(),
  syncWorkoutTimer: vi.fn(),
  getFormattedWorkoutTime: vi.fn(() => "00:00"),
};

const mockAppHistoryState = {
  entries: [],
  syncEntry: vi.fn(),
  reset: vi.fn(),
};

const mockWorkout = {
  id: Number(mockWorkoutId),
  name: "Chest Day",
  notes: null,
  start_time: "2024-01-01T10:00:00.000Z",
  end_time: null,
  workout_type_id: 1,
  created_at: "2024-01-01T10:00:00.000Z",
  updated_at: "2024-01-01T10:00:00.000Z",
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
  useAppHistoryStore: (
    selector: (state: typeof mockAppHistoryState) => unknown,
  ) => selector(mockAppHistoryState),
}));

describe("WorkoutPage", () => {
  let windowScrollToMock: ReturnType<typeof vi.fn>;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;
  let requestIdleCallbackMock: ReturnType<typeof vi.fn>;
  let cancelIdleCallbackMock: ReturnType<typeof vi.fn>;
  let preloadedImageUrls: string[];
  const buildApiGetImplementation = (
    workoutHandler?: () => Promise<{ data: unknown }>,
  ) =>
    vi.fn((url: string) => {
      if (url === `/workouts/${mockWorkoutId}`) {
        return workoutHandler
          ? workoutHandler()
          : Promise.resolve({ data: mockWorkout });
      }

      return Promise.resolve({ data: null });
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    mockAuthState.loading = false;
    mockAuthState.initialized = true;
    mockGuestState.workouts = [];
    mockGuestState.hydrated = true;
    mockLocationState = undefined;
    vi.mocked(api.get).mockImplementation(buildApiGetImplementation());
    windowScrollToMock = vi.fn();
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      writable: true,
      value: windowScrollToMock,
    });
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });
    preloadedImageUrls = [];
    class MockImage {
      set src(value: string) {
        preloadedImageUrls.push(value);
      }
    }
    vi.stubGlobal("Image", MockImage);
    requestIdleCallbackMock = vi.fn((callback: IdleRequestCallback) => {
      callback({
        didTimeout: false,
        timeRemaining: () => 50,
      } as IdleDeadline);
      return 1;
    });
    cancelIdleCallbackMock = vi.fn();
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      writable: true,
      value: requestIdleCallbackMock,
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      writable: true,
      value: cancelIdleCallbackMock,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    exerciseComponentsMocks.ExerciseListMock.mockClear();
    exerciseApiMocks.mockGetExercisesInWorkout.mockReset();
    exerciseApiMocks.mockCreateExercise.mockReset();
    exerciseApiMocks.mockGetExercisesInWorkout.mockResolvedValue([]);
    global.fetch = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("<svg />", {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      }),
    );
  });

  it("renders workout page with correct heading", () => {
    render(<WorkoutPage />);

    return expect(
      screen.findByRole("heading", { name: /chest day/i, level: 2 }),
    ).resolves.toBeInTheDocument();
  });

  it("keeps the page shell visible while the workout query is pending", async () => {
    vi.mocked(api.get).mockImplementation(
      buildApiGetImplementation(() => new Promise(() => {})),
    );

    render(<WorkoutPage />);

    expect(
      await screen.findByRole("heading", { name: /loading workout/i, level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add exercise/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("exercise-list-status")).toHaveTextContent(
      "pending",
    );
    expect(screen.queryByText(/workout: #123/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/loading workout\.\.\./i)).not.toBeInTheDocument();
  });

  it("skips the exercise loading state when navigation marks the workout as known empty", async () => {
    mockLocationState = { knownEmptyExercises: true };
    exerciseApiMocks.mockGetExercisesInWorkout.mockImplementation(
      () => new Promise(() => {}),
    );

    const { rerender } = render(<WorkoutPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-list-status")).toHaveTextContent(
        "success",
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith(`/workouts/${mockWorkoutId}`, {
      replace: true,
      state: null,
    });

    mockLocationState = null;
    rerender(<WorkoutPage />);

    expect(screen.getByTestId("exercise-list-status")).toHaveTextContent(
      "success",
    );
  });

  it("syncs the timer from the workout lifecycle", async () => {
    render(<WorkoutPage />);

    await waitFor(() => {
      expect(mockUIState.syncWorkoutTimer).toHaveBeenCalledWith({
        id: mockWorkout.id,
        startTime: mockWorkout.start_time,
        endTime: mockWorkout.end_time,
      });
    });
  });

  it("shows floating action button", () => {
    render(<WorkoutPage />);

    return expect(
      screen.findByLabelText(/floating action button/i),
    ).resolves.toBeInTheDocument();
  });

  it("does not reopen the finish modal when browser back is pressed after canceling", async () => {
    render(<WorkoutPage />);

    fireEvent.click(await screen.findByLabelText(/floating action button/i));

    const cancelButton = await screen.findByRole("button", {
      name: /cancel/i,
    });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(
        screen.queryByTestId("finish-workout-modal"),
      ).not.toBeInTheDocument();
    });

    fireEvent(window, new PopStateEvent("popstate"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("finish-workout-modal"),
      ).not.toBeInTheDocument();
    });
  });

  it('shows "Add Exercise" button', () => {
    render(<WorkoutPage />);
    return expect(
      screen.findByRole("button", { name: /add exercise/i }),
    ).resolves.toBeInTheDocument();
  });

  it("shows the back link without hiding it on large screens", async () => {
    render(<WorkoutPage />);

    const backLink = await screen.findByLabelText(/go back/i);
    expect(backLink).toBeInTheDocument();
    expect(backLink).not.toHaveClass("lg:hidden");
  });

  it("navigates away instead of opening the finish modal when the back button is pressed", async () => {
    render(<WorkoutPage />);

    fireEvent.click(await screen.findByLabelText(/go back/i));

    expect(mockNavigate).toHaveBeenCalledWith("/workouts", {
      replace: true,
    });
    expect(screen.queryByTestId("finish-workout-modal")).not.toBeInTheDocument();
  });

  it("optimistically adds an exercise before the server responds", async () => {
    let exercisesResponse: Array<{ id: number; exercise_type: typeof mockExerciseType }> = [];
    exerciseApiMocks.mockGetExercisesInWorkout.mockImplementation(
      async () => exercisesResponse,
    );

    let resolveCreate: (value: unknown) => void;
    const createPromise = new Promise((resolve) => {
      resolveCreate = resolve;
    });
    exerciseApiMocks.mockCreateExercise.mockReturnValue(createPromise);

    render(<WorkoutPage />);

    await waitFor(() => {
      expect(exerciseComponentsMocks.ExerciseListMock).toHaveBeenCalled();
    });
    windowScrollToMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /add exercise/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /select exercise type/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/optimistic-/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "end",
        inline: "nearest",
      });
    });

    const createdExercise = {
      id: 999,
      timestamp: "2024-01-01T00:00:00.000Z",
      notes: null,
      exercise_type_id: mockExerciseType.id,
      workout_id: Number(mockWorkoutId),
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      exercise_type: mockExerciseType,
      exercise_sets: [],
    };
    exercisesResponse = [createdExercise];
    resolveCreate!(createdExercise);

    await waitFor(() => {
      expect(screen.getByText("999")).toBeInTheDocument();
    });
  });

  it("removes optimistic exercise on create failure when exercises cache was empty", async () => {
    exerciseApiMocks.mockGetExercisesInWorkout.mockImplementation(
      () => new Promise(() => {}),
    );

    let rejectCreate: (reason?: unknown) => void;
    const createPromise = new Promise((_, reject) => {
      rejectCreate = reject;
    });
    exerciseApiMocks.mockCreateExercise.mockReturnValue(createPromise);

    render(<WorkoutPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: /add exercise/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /select exercise type/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/optimistic-/i)).toBeInTheDocument();
    });

    rejectCreate!(new Error("Create failed"));

    await waitFor(() => {
      expect(screen.queryByText(/optimistic-/i)).not.toBeInTheDocument();
    });
  });

  it("shows not found when the workout does not exist", async () => {
    vi.mocked(api.get).mockImplementation(
      buildApiGetImplementation(() =>
        Promise.reject({ response: { status: 404 } }),
      ),
    );

    render(<WorkoutPage />);

    expect(
      await screen.findByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add exercise/i }),
    ).not.toBeInTheDocument();
  });

  it("shows not found when the user lacks access to the workout", async () => {
    vi.mocked(api.get).mockImplementation(
      buildApiGetImplementation(() =>
        Promise.reject({ response: { status: 403 } }),
      ),
    );

    render(<WorkoutPage />);

    expect(
      await screen.findByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add exercise/i }),
    ).not.toBeInTheDocument();
  });

  it("shows not found for a missing guest workout", async () => {
    mockAuthState.isAuthenticated = false;

    render(<WorkoutPage />);

    expect(
      await screen.findByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
    expect(vi.mocked(api.get)).not.toHaveBeenCalledWith(
      `/workouts/${mockWorkoutId}`,
    );
  });

  it("shows a generic error for server failures", async () => {
    let attempts = 0;
    vi.mocked(api.get).mockImplementation(
      buildApiGetImplementation(() => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject({ response: { status: 500 } })
          : Promise.resolve({ data: mockWorkout });
      }),
    );

    render(<WorkoutPage />);

    expect(
      await screen.findByRole("heading", {
        name: /we couldn't load this workout\./i,
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/this may be temporary\. try again or go back to your workouts\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to workouts/i }),
    ).toHaveAttribute("href", "/workouts");
    expect(
      screen.queryByRole("heading", { name: /page not found/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(
      await screen.findByRole("heading", { name: /chest day/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows a network-specific recovery message", async () => {
    vi.mocked(api.get).mockImplementation(
      buildApiGetImplementation(() =>
        Promise.reject(new Error("Network Error")),
      ),
    );

    render(<WorkoutPage />);

    expect(
      await screen.findByText(/check your connection and try again\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to workouts/i }),
    ).toHaveAttribute("href", "/workouts");
  });

  it("scrolls the bottom anchor into view when entering an in-progress workout", async () => {
    render(<WorkoutPage />);

    await waitFor(() => {
      expect(windowScrollToMock).toHaveBeenCalledWith({
        top: 0,
        behavior: "auto",
      });
    });

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "end",
        inline: "nearest",
      });
    });
  });

  it("preloads only the first image for the first few exercises", async () => {
    exerciseApiMocks.mockGetExercisesInWorkout.mockResolvedValue([
      {
        id: 1,
        exercise_type: {
          ...mockExerciseType,
          images: ["https://cdn.example.com/bench-1.webp"],
        },
      },
      {
        id: 2,
        exercise_type: {
          ...mockExerciseType,
          id: 43,
          name: "Incline Bench Press",
          images: ["https://cdn.example.com/incline-1.webp"],
        },
      },
      {
        id: 3,
        exercise_type: {
          ...mockExerciseType,
          id: 44,
          name: "Dumbbell Press",
          images: [],
        },
      },
      {
        id: 4,
        exercise_type: {
          ...mockExerciseType,
          id: 45,
          name: "Cable Fly",
          images: ["https://cdn.example.com/fly-1.webp"],
        },
      },
      {
        id: 5,
        exercise_type: {
          ...mockExerciseType,
          id: 46,
          name: "Push Up",
          images: ["https://cdn.example.com/pushup-1.webp"],
        },
      },
      {
        id: 6,
        exercise_type: {
          ...mockExerciseType,
          id: 47,
          name: "Chest Dip",
          images: ["https://cdn.example.com/dip-1.webp"],
        },
      },
    ]);

    render(<WorkoutPage />);

    await waitFor(() => {
      expect(requestIdleCallbackMock).toHaveBeenCalled();
      expect(preloadedImageUrls).toEqual([
        "https://cdn.example.com/bench-1.webp",
        "https://cdn.example.com/incline-1.webp",
        "https://cdn.example.com/fly-1.webp",
      ]);
    });
  });

  it("smoothly scrolls from the top when navigation requests bottom-on-load", async () => {
    mockLocationState = { scrollToBottomOnLoad: true };

    render(<WorkoutPage />);

    await waitFor(() => {
      expect(windowScrollToMock).toHaveBeenCalledWith({
        top: 0,
        behavior: "auto",
      });
    });

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "end",
        inline: "nearest",
      });
    });
  });
});
