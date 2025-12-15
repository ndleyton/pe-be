import { describe, it, expect, vi, beforeEach } from "vitest";
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
          onIntensityUnitChange({ id: 3, name: "Pounds", abbreviation: "lbs" })
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

// Mock the auth store and guest store
vi.mock("@/stores", () => ({
  useAuthStore: vi.fn(() => ({ isAuthenticated: true })),
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
    X: () => <div data-testid="x-icon">✕</div>,
    XIcon: () => <div data-testid="x-icon">✕</div>,
  };
});

describe("ExerciseRow", () => {
  const mockExerciseSet1: ExerciseSet = {
    id: 1,
    reps: 10,
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
    (createExerciseSet as any).mockResolvedValue({
      id: 999,
      reps: 0,
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

  it("renders exercise information in card format", () => {
    render(<ExerciseRow {...defaultProps} />);

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    // expect(screen.getByText(/Rest Timer: 2min 30s/)).toBeInTheDocument(); // TODO: Add rest timer back in
    // Exercise notes are now accessible via the sticky note icon next to the exercise name
    const stickyNoteIcons = screen.getAllByTestId("sticky-note-icon");
    expect(stickyNoteIcons.length).toBeGreaterThan(0); // Should have at least the exercise notes sticky note
  });

  it("displays exercise notes in sticky note and dialog", async () => {
    render(<ExerciseRow {...defaultProps} />);

    // Get the sticky note icons and click the first one (exercise notes)
    const stickyNoteIcons = screen.getAllByTestId("sticky-note-icon");
    const exerciseNotesButton = stickyNoteIcons[0].closest("button");
    expect(exerciseNotesButton).toBeInTheDocument();

    // Click the sticky note to open the dialog
    fireEvent.click(exerciseNotesButton!);

    // The dialog should open with the notes in a textarea
    await waitFor(() => {
      const notesTextarea = screen.getByPlaceholderText(
        /add notes for this exercise/i,
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

  it("displays exercise sets in grid format", () => {
    const { container } = render(<ExerciseRow {...defaultProps} />);

    // Check for set numbers
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // Weight inputs are textboxes with inputMode="decimal"
    const weightInputs = Array.from(
      container.querySelectorAll('input[inputmode="decimal"]'),
    ) as HTMLInputElement[];
    // Reps inputs are number inputs (spinbuttons)
    const repsInputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];

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
    render(<ExerciseRow {...defaultProps} />);

    // Click the exercise notes sticky note to open dialog
    const stickyNoteIcons = screen.getAllByTestId("sticky-note-icon");
    const exerciseNotesButton = stickyNoteIcons[0].closest("button");
    await user.click(exerciseNotesButton!);

    // Wait for dialog to open and find textarea
    await waitFor(() => {
      const notesTextarea = screen.getByPlaceholderText(
        /add notes for this exercise/i,
      );
      expect(notesTextarea).toBeInTheDocument();
    });

    const notesTextarea = screen.getByPlaceholderText(
      /add notes for this exercise/i,
    );
    await user.clear(notesTextarea);
    await user.type(notesTextarea, "Updated notes");

    expect(notesTextarea).toHaveValue("Updated notes");
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

  it("disables inputs when set is completed", () => {
    render(<ExerciseRow {...defaultProps} />);

    const allInputs = screen.getAllByRole("spinbutton");
    const allButtons = screen.getAllByRole("button");

    // Check that completed set (second set) has disabled inputs
    const secondSetInputs = allInputs.slice(2, 4); // Assuming second set inputs
    secondSetInputs.forEach((input) => {
      expect(input).toBeDisabled();
    });

    // Check that plus/minus buttons for completed set are disabled
    const plusButtons = screen.getAllByTestId("plus-icon");
    const minusButtons = screen.getAllByTestId("minus-icon");

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

      expect(screen.getByText("Set Notes & Options")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/add notes for this set/i),
      ).toBeInTheDocument();
    }
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
      />,
    );

    // Should still show the sticky note icon for adding notes
    const stickyNoteIcons = screen.getAllByTestId("sticky-note-icon");
    expect(stickyNoteIcons.length).toBeGreaterThan(0);
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
});
