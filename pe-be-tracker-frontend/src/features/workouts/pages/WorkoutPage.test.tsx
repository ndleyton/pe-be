import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/test/testUtils";
import api from "@/shared/api/client";
import WorkoutPage from "./WorkoutPage";

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockWorkoutId = "123";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ workoutId: mockWorkoutId }),
    useNavigate: () => mockNavigate,
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
    ({ exercises }: { exercises: { id: number | string }[] }) => (
      <div data-testid="exercise-list">
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
  ExerciseTypeModal: ({
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
};

const mockUIState = {
  workoutTimer: { startTime: null },
  startWorkoutTimer: vi.fn(),
  stopWorkoutTimer: vi.fn(),
  getFormattedWorkoutTime: vi.fn(() => "00:00"),
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
}));

describe("WorkoutPage", () => {
  let scrollToMock: ReturnType<typeof vi.fn>;
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
    mockGuestState.workouts = [];
    mockGuestState.hydrated = true;
    vi.mocked(api.get).mockImplementation(buildApiGetImplementation());
    scrollToMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value: scrollToMock,
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

  it("shows floating action button", () => {
    render(<WorkoutPage />);

    return expect(
      screen.findByLabelText(/floating action button/i),
    ).resolves.toBeInTheDocument();
  });

  it('shows "Add Exercise" button', () => {
    render(<WorkoutPage />);
    return expect(
      screen.findByRole("button", { name: /add exercise/i }),
    ).resolves.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: /add exercise/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /select exercise type/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/optimistic-/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalled();
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
      screen.getByRole("button", { name: /select exercise type/i }),
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
      await screen.findByRole("heading", { name: /page not found/i, level: 2 }),
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
      await screen.findByRole("heading", { name: /page not found/i, level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add exercise/i }),
    ).not.toBeInTheDocument();
  });

  it("shows not found for a missing guest workout", async () => {
    mockAuthState.isAuthenticated = false;

    render(<WorkoutPage />);

    expect(
      await screen.findByRole("heading", { name: /page not found/i, level: 2 }),
    ).toBeInTheDocument();
    expect(vi.mocked(api.get)).not.toHaveBeenCalledWith(
      `/workouts/${mockWorkoutId}`,
    );
  });

  it("shows a generic error for server failures", async () => {
    vi.mocked(api.get).mockImplementation(
      buildApiGetImplementation(() =>
        Promise.reject({ response: { status: 500 } }),
      ),
    );

    render(<WorkoutPage />);

    expect(
      await screen.findByText(/failed to load workout\./i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /page not found/i, level: 2 }),
    ).not.toBeInTheDocument();
  });
});
