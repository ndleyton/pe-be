import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test/testUtils";
import type { Exercise } from "@/features/exercises/api";
import { makeExerciseType } from "@/test/fixtures/exercises";
import { SaveRoutineModal } from "./SaveRoutineModal";

const {
  mockCreateRoutine,
  mockUpdateExerciseSet,
  mockAuthState,
  mockGuestState,
} = vi.hoisted(() => {
  const mockCreateRoutine = vi.fn();
  const mockUpdateExerciseSet = vi.fn();
  const mockCreateRoutineFromWorkout = vi.fn();

  return {
    mockCreateRoutine,
    mockUpdateExerciseSet,
    mockCreateRoutineFromWorkout,
    mockAuthState: {
      isAuthenticated: true,
    },
    mockGuestState: {
      createRoutineFromWorkout: mockCreateRoutineFromWorkout,
    },
  };
});

vi.mock("@/features/routines/api", () => ({
  createRoutine: mockCreateRoutine,
}));

vi.mock("@/features/exercises/api", () => ({
  updateExerciseSet: mockUpdateExerciseSet,
}));

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
  useGuestStore: (
    selector?: (state: typeof mockGuestState) => unknown,
  ) => {
    if (selector) return selector(mockGuestState);
    return mockGuestState;
  },
}));

const exercises: Exercise[] = [
  {
    id: 11,
    timestamp: "2026-03-09T10:00:00.000Z",
    notes: null,
    exercise_type_id: 7,
    workout_id: 25,
    created_at: "2026-03-09T10:00:00.000Z",
    updated_at: "2026-03-09T10:00:00.000Z",
    exercise_type: makeExerciseType({
      id: 7,
      name: "Bench Press",
      description: "Chest press",
      default_intensity_unit: 2,
      times_used: 0,
    }),
    exercise_sets: [
      {
        id: 101,
        reps: null,
        duration_seconds: 600,
        intensity: null,
        intensity_unit_id: 2,
        exercise_id: 11,
        rest_time_seconds: null,
        done: false,
        created_at: "2026-03-09T10:00:00.000Z",
        updated_at: "2026-03-09T10:00:00.000Z",
      },
      {
        id: 102,
        reps: 8,
        duration_seconds: null,
        intensity: 135,
        intensity_unit_id: 2,
        exercise_id: 11,
        rest_time_seconds: 90,
        done: true,
        created_at: "2026-03-09T10:01:00.000Z",
        updated_at: "2026-03-09T10:01:00.000Z",
      },
    ],
  },
];

describe("SaveRoutineModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateRoutine.mockResolvedValue({ id: 99 });
    mockUpdateExerciseSet.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the workout's type and preserves nullable set values", async () => {
    const user = userEvent.setup();

    render(
      <SaveRoutineModal
        isOpen={true}
        onClose={vi.fn()}
        workoutName="Push Day"
        workoutTypeId={42}
        exercises={exercises}
        workoutId="25"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save Routine" }));

    await waitFor(() => {
      expect(mockCreateRoutine).toHaveBeenCalledWith({
        name: "Push Day",
        workout_type_id: 42,
        exercise_templates: [
          {
            exercise_type_id: 7,
            set_templates: [
              {
                reps: null,
                duration_seconds: 600,
                intensity: null,
                intensity_unit_id: 2,
              },
              {
                reps: 8,
                duration_seconds: null,
                intensity: 135,
                intensity_unit_id: 2,
              },
            ],
          },
        ],
      });
    });
  });

  it("does not render modal content while closed", () => {
    render(
      <SaveRoutineModal
        isOpen={false}
        onClose={vi.fn()}
        workoutName="Push Day"
        workoutTypeId={42}
        exercises={exercises}
        workoutId="25"
      />,
    );

    expect(
      screen.queryByRole("heading", { name: /save as routine/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/routine name/i)).not.toBeInTheDocument();
  });
});
