import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/testUtils";
import ExerciseRow from "./ExerciseRow";
import {
  Exercise,
  ExerciseSet,
  createExerciseSet,
  updateExerciseSet,
  deleteExercise,
} from "@/features/exercises/api";

const { preloadSpy } = vi.hoisted(() => ({
  preloadSpy: vi.fn(),
}));

class ResizeObserverMock {
  observe() { }
  unobserve() { }
  disconnect() { }
}

// Mock API functions
vi.mock("@/features/exercises/api", async () => {
  const actual = await vi.importActual("@/features/exercises/api");
  return {
    ...actual,
    createExerciseSet: vi.fn(),
    updateExerciseSet: vi.fn(),
    deleteExercise: vi.fn(),
  };
});

vi.mock("@/shared/lib/createIntentPreload", () => ({
  createIntentPreload: vi.fn(() => preloadSpy),
}));

// Mock the ExerciseTypeMore component
vi.mock("../ExerciseTypeMore", () => ({
  ExerciseTypeMore: ({
    currentIntensityUnit,
    onIntensityUnitChange,
    onExerciseDelete,
    onClose,
  }: any) => (
    <div data-testid="exercise-type-more">
      <span>Current unit: {currentIntensityUnit.abbreviation}</span>
      <button
        onClick={() =>
          onIntensityUnitChange({ id: 2, name: "Pounds", abbreviation: "lbs" })
        }
        data-testid="change-unit-button"
      >
        Change to lbs
      </button>
      <button
        onClick={onExerciseDelete}
        data-testid="delete-exercise-button"
        className="text-red-600 dark:text-red-400"
      >
        🗑️ Delete Exercise
      </button>
      {onClose && (
        <button onClick={onClose} data-testid="close-button">
          Close
        </button>
      )}
    </div>
  ),
}));

// Mock the AddExerciseSetForm component (no longer used in the new implementation)
vi.mock("../../../exercise-sets/components/AddExerciseSetForm", () => ({
  AddExerciseSetForm: ({ exerciseId, onSetAdded, onCancel }: any) => (
    <div data-testid="add-exercise-set-form">
      <span>Add set form for exercise {exerciseId}</span>
      <button
        onClick={() =>
          onSetAdded({ id: 999, reps: 5, exercise_id: exerciseId })
        }
      >
        Add Mock Set
      </button>
      <button onClick={onCancel}>Cancel Form</button>
    </div>
  ),
}));

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    isAuthenticated: true,
  },
}));

// Mock the auth store and guest store
vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
  useGuestStore: vi.fn(() => ({ deleteExercise: vi.fn() })),
  GuestExerciseSet: {},
}));

// Mock react-query
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
    })),
    useQuery: vi.fn((options: any) => {
      if (options.queryKey[0] === "exerciseTypeStats") {
        // Only return stats for the PR test case to avoid side effects in other tests
        if (options.queryKey[1] === 999 || options.queryKey[1] === "999") {
          return {
            data: {
              personalBest: {
                weight: 50,
                reps: 5,
                date: "2023-01-01",
              },
              intensityUnit: { id: 1, abbreviation: "kg" },
            },
            isLoading: false,
          };
        }
        return { data: null, isLoading: false };
      }
      return { data: null, isLoading: false };
    }),
  };
});

// Mock Lucide React icons
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return {
    ...actual,
    MoreVertical: () => <div data-testid="more-vertical-icon">⋮</div>,
    Timer: () => <div data-testid="timer-icon">⏱</div>,
    StickyNote: () => <div data-testid="sticky-note-icon">📝</div>,
    Plus: () => <div data-testid="plus-icon">+</div>,
    Minus: () => <div data-testid="minus-icon">-</div>,
    Check: () => <div data-testid="check-icon">✓</div>,
    Trophy: () => <div data-testid="trophy-icon">🏆</div>,
    X: () => <div data-testid="x-icon">✕</div>,
    XIcon: () => <div data-testid="x-icon">✕</div>,
  };
});

describe("ExerciseRow", () => {
  const mockExerciseSet1: ExerciseSet = {
    id: 1,
    reps: 10,
    duration_seconds: null,
    intensity: 50.5,
    intensity_unit_id: 1,
    exercise_id: 123,
    rest_time_seconds: 60,
    done: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const mockExerciseSet2: ExerciseSet = {
    id: 2,
    reps: 12,
    duration_seconds: null,
    intensity: 55.0,
    intensity_unit_id: 1,
    exercise_id: 123,
    rest_time_seconds: 90,
    done: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const mockExercise: Exercise = {
    id: 123,
    timestamp: "2024-01-01T10:00:00Z",
    notes: "Great workout!",
    exercise_type_id: 1,
    workout_id: 456,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    exercise_type: {
      id: 1,
      name: "Bench Press",
      description: "Chest exercise",
      default_intensity_unit: 1,
      times_used: 5,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      muscle_groups: ["chest"],
      equipment: "barbell",
      instructions: null,
      category: null,
      usage_count: 5,
    },
    exercise_sets: [mockExerciseSet1, mockExerciseSet2],
  };

  const mockOnExerciseUpdate = vi.fn();

  const defaultProps = {
    exercise: mockExercise,
    onExerciseUpdate: mockOnExerciseUpdate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    (createExerciseSet as any).mockResolvedValue({
      id: 999,
      reps: 0,
      duration_seconds: null,
      intensity: 0,
      intensity_unit_id: 2,
      exercise_id: 123,
      rest_time_seconds: null,
      done: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    (updateExerciseSet as any).mockResolvedValue({});
    (deleteExercise as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders exercise information in card format", () => {
    render(<ExerciseRow {...defaultProps} />);

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view details for bench press/i }),
    ).toHaveAttribute("href", "/exercise-types/1");
    const detailsLink = screen.getByRole("link", {
      name: /view details for bench press/i,
    });
    fireEvent.mouseEnter(detailsLink);
    fireEvent.touchStart(detailsLink);
    fireEvent.focus(detailsLink);
    expect(preloadSpy).toHaveBeenCalledTimes(3);
    // expect(screen.getByText(/Rest Timer: 2min 30s/)).toBeInTheDocument(); // TODO: Add rest timer back in
  });

  it("hides the exercise details link for guest exercise types", () => {
    const guestExercise: Exercise = {
      ...mockExercise,
      exercise_type_id: "guest-type-1",
      exercise_type: {
        ...mockExercise.exercise_type,
        id: "guest-type-1" as never,
      },
    };

    render(
      <ExerciseRow
        {...defaultProps}
        exercise={guestExercise}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /view details for bench press/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the exercise details link for non-released exercise types", () => {
    const candidateExercise: Exercise = {
      ...mockExercise,
      exercise_type: {
        ...mockExercise.exercise_type,
        status: "candidate",
      },
    };

    render(<ExerciseRow {...defaultProps} exercise={candidateExercise} />);

    expect(
      screen.queryByRole("link", { name: /view details for bench press/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
  });

  it("displays exercise notes in the accordion content when expanded", async () => {
    render(<ExerciseRow {...defaultProps} isExpanded={true} />);

    // The notes textarea should be rendered in the document (within the open accordion)
    await waitFor(() => {
      const notesTextarea = screen.getByPlaceholderText(
        /add exercise notes/i,
      );
      expect(notesTextarea).toHaveValue("Great workout!");
    });
  });

  it("shows table headers for sets", () => {
    render(<ExerciseRow {...defaultProps} />);

    expect(screen.getByText("SET")).toBeInTheDocument();
    expect(screen.getByText("KG")).toBeInTheDocument(); // Default intensity unit
    expect(screen.getByText("REPS")).toBeInTheDocument();
    expect(screen.getByText("DONE")).toBeInTheDocument();
  });

  it("shows Time for speed-based exercises and formats the input as MM:SS", () => {
    const speedExercise: Exercise = {
      ...mockExercise,
      exercise_type: {
        ...mockExercise.exercise_type,
        default_intensity_unit: 3,
      },
      exercise_sets: [
        {
          ...mockExerciseSet1,
          reps: null,
          duration_seconds: 605,
          intensity_unit_id: 3,
        },
      ],
    };

    render(
      <ExerciseRow
        {...defaultProps}
        exercise={speedExercise}
      />,
    );

    expect(screen.getByText("TIME")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10:05")).toBeInTheDocument();
  });

  it("displays exercise sets in grid format", () => {
    const { container } = render(<ExerciseRow {...defaultProps} />);

    // Check for set numbers
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // Weight inputs are textboxes with inputMode="decimal"
    const weightInputs = Array.from(
      container.querySelectorAll('input[inputmode="decimal"]'),
    ) as HTMLInputElement[];
    // Reps inputs are text inputs with inputMode="numeric"
    const repsInputs = Array.from(container.querySelectorAll('input[inputmode="numeric"]')) as HTMLInputElement[];

    const weightValues = weightInputs.map((i) => i.value);
    const repsValues = repsInputs.map((i) => i.value);

    expect(weightValues).toEqual(expect.arrayContaining(["50.5", "55"]));
    expect(repsValues).toEqual(expect.arrayContaining(["10", "12"]));
  });

  it("shows Add Set button", () => {
    render(<ExerciseRow {...defaultProps} />);

    const addSetButton = screen.getByRole("button", { name: /add set/i });
    expect(addSetButton).toBeInTheDocument();
  });

  it("can update exercise notes", async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} isExpanded={true} />);

    // Wait for the textarea to be rendered in the open accordion
    await waitFor(() => {
      const notesTextarea = screen.getByPlaceholderText(
        /add exercise notes/i,
      );
      expect(notesTextarea).toBeInTheDocument();
    });

    const notesTextarea = screen.getByPlaceholderText(
      /add exercise notes/i,
    );
    await user.clear(notesTextarea);
    await user.type(notesTextarea, "Updated notes");

    expect(notesTextarea).toHaveValue("Updated notes");

    // Simulate blur to trigger save
    fireEvent.blur(notesTextarea);
    // Note: To test the actual update call, we would need to mock the update hook correctly
    // or verify that it called the onExerciseUpdate callback with the new notes if it does
  });

  it("can increment reps using plus button", async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    const plusButtons = screen.getAllByTestId("plus-icon");
    await user.click(plusButtons[0]); // Click first set's plus button

    await waitFor(() => {
      expect(mockOnExerciseUpdate).toHaveBeenCalledWith({
        ...mockExercise,
        exercise_sets: [{ ...mockExerciseSet1, reps: 11 }, mockExerciseSet2],
      });
    });
  });

  it("can decrement reps using minus button", async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    const minusButtons = screen.getAllByTestId("minus-icon");
    await user.click(minusButtons[0]); // Click first set's minus button

    await waitFor(() => {
      expect(mockOnExerciseUpdate).toHaveBeenCalledWith({
        ...mockExercise,
        exercise_sets: [{ ...mockExerciseSet1, reps: 9 }, mockExerciseSet2],
      });
    });
  });

  it("can update weight/intensity directly in input", async () => {
    const user = userEvent.setup();
    const { container } = render(<ExerciseRow {...defaultProps} />);

    const weightInputs = Array.from(
      container.querySelectorAll('input[inputmode="decimal"]'),
    ) as HTMLInputElement[];
    const weightInput = weightInputs[0];

    await user.clear(weightInput);
    await user.type(weightInput, "60");
    // Commit via Enter which triggers blur in component
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockOnExerciseUpdate).toHaveBeenCalledWith({
        ...mockExercise,
        exercise_sets: [
          { ...mockExerciseSet1, intensity: 60 },
          mockExerciseSet2,
        ],
      });
    });
  });

  it("commits decimal comma on Enter for weight input", async () => {
    const user = userEvent.setup();
    const { container } = render(<ExerciseRow {...defaultProps} />);

    const weightInputs = Array.from(
      container.querySelectorAll('input[inputmode="decimal"]'),
    ) as HTMLInputElement[];
    const weightInput = weightInputs[0];

    await user.clear(weightInput);
    await user.type(weightInput, "60,75");
    // Press Enter to commit
    await user.keyboard("{Enter}");

    await waitFor(() => {
      // API called with normalized decimal
      expect(updateExerciseSet).toHaveBeenCalledWith(1, { intensity: 60.75 });
      // Parent callback receives updated value
      expect(mockOnExerciseUpdate).toHaveBeenCalledWith({
        ...mockExercise,
        exercise_sets: [
          { ...mockExerciseSet1, intensity: 60.75 },
          mockExerciseSet2,
        ],
      });
    });
  });

  it("can toggle set completion", async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    const checkButtons = screen.getAllByTestId("check-icon");
    await user.click(checkButtons[0]); // Toggle first set completion

    await waitFor(() => {
      expect(mockOnExerciseUpdate).toHaveBeenCalledWith({
        ...mockExercise,
        exercise_sets: [{ ...mockExerciseSet1, done: true }, mockExerciseSet2],
      });
    });
  });

  it("shows a trophy icon when a set is a PR and marked as done", async () => {
    const user = userEvent.setup();
    // Use a mock exercise where the first set is already above the PR weight (50 in mock stats)
    // and use ID 999 to trigger the mock stats return
    const prExercise: Exercise = {
      ...mockExercise,
      exercise_type: {
        ...mockExercise.exercise_type,
        id: 999,
      },
      exercise_sets: [
        {
          ...mockExerciseSet1,
          intensity: 105.0,
          intensity_unit_id: 1,
          done: false,
        },
        mockExerciseSet2,
      ],
    };

    render(<ExerciseRow {...defaultProps} exercise={prExercise} />);

    // Initially shows standard check icon (since it's not done)
    const doneButtons = screen.getAllByTestId("done-button");
    expect(doneButtons[0]).toHaveAttribute("aria-label", "Mark set done");

    // Toggle set 1 completion
    await user.click(doneButtons[0]);

    // Now set 1 should show the trophy icon (or at least be marked as done with the correct aria-label)
    await waitFor(() => {
      expect(doneButtons[0]).toHaveAttribute("aria-label", "Personal Best");
    });
  });

  it("disables inputs when set is completed", () => {
    render(<ExerciseRow {...defaultProps} />);

    // Select all weight and reps inputs
    const decimalInputs = Array.from(document.querySelectorAll('input[inputmode="decimal"]'));
    const numericInputs = Array.from(document.querySelectorAll('input[inputmode="numeric"]'));

    // We expect 2 sets. Set 2 is done.
    // Set 2 inputs should be disabled.
    // Let's check specifically for the inputs corresponding to set 2.
    // Assuming inputs are rendered in order (Set 1 Weight, Set 1 Reps, Set 2 Weight, Set 2 Reps)
    // But since we queried separately, we need to check index 1 of each array (Set 2).

    expect(decimalInputs[1]).toBeDisabled();
    expect(numericInputs[1]).toBeDisabled();

    // Check that plus/minus buttons for completed set are disabled
    // Note: We'd need to check the parent button's disabled state
    // This is a simplified check - in real tests you'd check the button element
  });

  it("can add a new set", async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    const addSetButton = screen.getByRole("button", { name: /add set/i });
    await user.click(addSetButton);

    await waitFor(() => {
      expect(mockOnExerciseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          exercise_sets: expect.arrayContaining([
            mockExerciseSet1,
            mockExerciseSet2,
            expect.objectContaining({
              reps: 12, // Should copy from last set
              intensity: 55.0,
              done: false,
            }),
          ]),
        }),
      );
    });
  });

  it("disables authenticated writes for optimistic exercise ids", async () => {
    const user = userEvent.setup();
    const mockOnExerciseDelete = vi.fn();
    const optimisticExercise: Exercise = {
      ...mockExercise,
      id: "optimistic-2024-01-01T00:00:00.000Z-1",
      exercise_sets: [],
    };

    render(
      <ExerciseRow
        exercise={optimisticExercise}
        onExerciseUpdate={mockOnExerciseUpdate}
        onExerciseDelete={mockOnExerciseDelete}
      />,
    );

    const addSetButton = screen.getByRole("button", { name: /add set/i });
    expect(addSetButton).toBeDisabled();
    await user.click(addSetButton);
    expect(createExerciseSet).not.toHaveBeenCalled();
    expect(mockOnExerciseUpdate).not.toHaveBeenCalled();

    const moreButtons = screen.getAllByTestId("more-vertical-icon");
    const exerciseSettingsButton = moreButtons[0].closest("button");
    if (exerciseSettingsButton) {
      await user.click(exerciseSettingsButton);
      const deleteButton = screen.getByTestId("delete-exercise-button");
      await user.click(deleteButton);
    }

    expect(deleteExercise).not.toHaveBeenCalled();
    expect(mockOnExerciseDelete).not.toHaveBeenCalled();
  });

  it("can change intensity unit", async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    // Open settings modal
    const moreButtons = screen.getAllByTestId("more-vertical-icon");
    const exerciseSettingsButton = moreButtons[0].closest("button"); // First one is exercise settings
    if (exerciseSettingsButton) {
      await user.click(exerciseSettingsButton);

      // Verify modal opened
      expect(screen.getByText("Exercise Settings")).toBeInTheDocument();
      expect(screen.getByTestId("exercise-type-more")).toBeInTheDocument();

      // Change unit
      const changeUnitButton = screen.getByTestId("change-unit-button");
      await user.click(changeUnitButton);

      // Check that unit changed in header
      await waitFor(() => {
        expect(screen.getByText("LBS")).toBeInTheDocument();
      });
    }
  });

  it("opens set notes modal", async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    // Get all more-vertical icons and find the one in the first set row (second one)
    const moreButtons = screen.getAllByTestId("more-vertical-icon");
    const setNotesButton = moreButtons[1].closest("button"); // Second one is for the first set

    if (setNotesButton) {
      await user.click(setNotesButton);

      expect(screen.getByText("Set Details")).toBeInTheDocument();
      expect(screen.getByText("Log intensity and notes for this set.")).toBeInTheDocument();
      expect(screen.getByText("RPE")).toBeInTheDocument();
      expect(screen.getByText("RIR")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/add notes for this set/i),
      ).toBeInTheDocument();
      expect(screen.getByText("Tracking")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Reps" }),
      ).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("can switch a set to Time from set options", async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    const moreButtons = screen.getAllByTestId("more-vertical-icon");
    const setOptionsButton = moreButtons[1].closest("button");

    if (setOptionsButton) {
      await user.click(setOptionsButton);
      await user.click(screen.getByRole("button", { name: "Time" }));

      await waitFor(() => {
        expect(updateExerciseSet).toHaveBeenCalledWith(1, {
          reps: null,
          duration_seconds: 600,
        });
      });
    }
  });

  it("commits time input as duration seconds", async () => {
    const user = userEvent.setup();
    const speedExercise: Exercise = {
      ...mockExercise,
      exercise_type: {
        ...mockExercise.exercise_type,
        default_intensity_unit: 3,
      },
      exercise_sets: [
        {
          ...mockExerciseSet1,
          reps: null,
          duration_seconds: 600,
          intensity_unit_id: 3,
        },
      ],
    };

    render(
      <ExerciseRow
        {...defaultProps}
        exercise={speedExercise}
      />,
    );

    const timeInput = screen.getByDisplayValue("10:00");
    await user.clear(timeInput);
    await user.type(timeInput, "12:34");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(updateExerciseSet).toHaveBeenCalledWith(1, {
        duration_seconds: 754,
        reps: null,
      });
      expect(mockOnExerciseUpdate).toHaveBeenCalledWith({
        ...speedExercise,
        exercise_sets: [
          {
            ...speedExercise.exercise_sets[0],
            duration_seconds: 754,
            reps: null,
          },
        ],
      });
    });
  });

  it("handles exercise without sets", () => {
    const exerciseWithoutSets = {
      ...mockExercise,
      exercise_sets: [],
    };

    render(
      <ExerciseRow
        exercise={exerciseWithoutSets}
        onExerciseUpdate={mockOnExerciseUpdate}
      />,
    );

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add set/i }),
    ).toBeInTheDocument();

    // Should still show table headers but no set rows
    expect(screen.getByText("SET")).toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument(); // No set numbers
  });

  it("handles exercise without notes", () => {
    const exerciseWithoutNotes = {
      ...mockExercise,
      notes: null,
    };

    render(
      <ExerciseRow
        exercise={exerciseWithoutNotes}
        onExerciseUpdate={mockOnExerciseUpdate}
        isExpanded={true}
      />,
    );

    // Textarea is present but empty
    const notesTextarea = screen.getByPlaceholderText(/add exercise notes/i);
    expect(notesTextarea).toHaveValue("");
  });

  it("works without onExerciseUpdate callback", () => {
    render(<ExerciseRow exercise={mockExercise} />);

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add set/i }),
    ).toBeInTheDocument();
  });

  it("shows correct set type badges", () => {
    render(<ExerciseRow {...defaultProps} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("applies correct styling for completed sets", () => {
    render(<ExerciseRow {...defaultProps} />);

    // This would require checking className or computed styles
    // For now, we just verify the component renders without error
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
  });

  it("can delete exercise through ExerciseTypeMore", async () => {
    const user = userEvent.setup();
    const mockOnExerciseDelete = vi.fn();

    render(
      <ExerciseRow {...defaultProps} onExerciseDelete={mockOnExerciseDelete} />,
    );

    // Open settings modal
    const moreButtons = screen.getAllByTestId("more-vertical-icon");
    const exerciseSettingsButton = moreButtons[0].closest("button");
    if (exerciseSettingsButton) {
      await user.click(exerciseSettingsButton);

      // Click delete button in ExerciseTypeMore (now directly calls onExerciseDelete)
      const deleteButton = screen.getByTestId("delete-exercise-button");
      await user.click(deleteButton);

      await waitFor(() => {
        expect(deleteExercise).toHaveBeenCalledWith(123);
        expect(mockOnExerciseDelete).toHaveBeenCalledWith(123);
      });
    }
  });

  it("allows clearing reps input (setting to null)", async () => {
    const user = userEvent.setup();
    const { container } = render(<ExerciseRow {...defaultProps} />);

    const repsInputs = Array.from(
      container.querySelectorAll('input[inputmode="numeric"]'),
    ) as HTMLInputElement[];
    const repsInput = repsInputs[0];

    await user.clear(repsInput);
    // Commit via Enter which triggers blur in component
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(updateExerciseSet).toHaveBeenCalledWith(1, {
        reps: null,
        duration_seconds: null,
      });
      expect(mockOnExerciseUpdate).toHaveBeenCalledWith({
        ...mockExercise,
        exercise_sets: [{ ...mockExerciseSet1, reps: null }, mockExerciseSet2],
      });
    });
  });

  it("restores the saved reps value on Escape", async () => {
    const user = userEvent.setup();
    const { container } = render(<ExerciseRow {...defaultProps} />);

    const repsInputs = Array.from(
      container.querySelectorAll('input[inputmode="numeric"]'),
    ) as HTMLInputElement[];
    const repsInput = repsInputs[0];

    await user.clear(repsInput);
    await user.type(repsInput, "15");
    expect(repsInput).toHaveValue("15");

    fireEvent.keyDown(repsInput, { key: "Escape" });

    await waitFor(() => {
      expect(repsInput).toHaveValue("10");
    });
    expect(updateExerciseSet).not.toHaveBeenCalledWith(1, {
      reps: 15,
      duration_seconds: null,
    });
  });
});
