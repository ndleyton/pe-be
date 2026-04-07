import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/testUtils";
import { EXERCISE_TYPE_MODAL_INITIAL_LIMIT } from "@/features/exercises/constants";
import { makeExerciseType, makePaginatedExerciseTypes } from "@/test/fixtures";
import type { ExerciseType } from "@/features/exercises/types";
import ExerciseTypeModal from "./ExerciseTypeModal";

const mockGetExerciseTypes = vi.fn();
const mockCreateExerciseType = vi.fn();
let mockIsAuthenticated = false;
let mockGuestStore: {
  exerciseTypes: ExerciseType[];
  updateExerciseType: ReturnType<typeof vi.fn>;
  addExerciseType: ReturnType<typeof vi.fn>;
} = {
  exerciseTypes: [],
  updateExerciseType: vi.fn(),
  addExerciseType: vi.fn(),
};

vi.mock("@/features/exercises/api", () => ({
  getExerciseTypes: (...args: unknown[]) => mockGetExerciseTypes(...args),
  createExerciseType: (...args: unknown[]) => mockCreateExerciseType(...args),
}));

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
  useGuestStore: (
    selector?: (state: typeof mockGuestStore) => unknown,
  ) => (selector ? selector(mockGuestStore) : mockGuestStore),
}));

describe("ExerciseTypeModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = false;
    mockGuestStore = {
      exerciseTypes: [],
      updateExerciseType: vi.fn(),
      addExerciseType: vi.fn(),
    };
    mockGetExerciseTypes.mockResolvedValue(
      makePaginatedExerciseTypes([]),
    );
  });

  it("does not render when closed", () => {
    render(
      <ExerciseTypeModal
        isOpen={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    expect(screen.queryByText("Select Exercise Type")).not.toBeInTheDocument();
  });

  it("renders modal when open", () => {
    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    expect(screen.getByText("Select Exercise Type")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /close modal/i }),
    ).toBeInTheDocument();
  });

  it("has a search input", () => {
    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    expect(
      screen.getByPlaceholderText(/Search exercise types.../i),
    ).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    const closeButton = screen.getByRole("button", { name: /close modal/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("does not show the global usage badge for authenticated users", async () => {
    mockIsAuthenticated = true;
    mockGetExerciseTypes.mockResolvedValue(
      makePaginatedExerciseTypes([makeExerciseType({ times_used: 12 })]),
    );

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Push-ups")).toBeInTheDocument();
    });

    expect(screen.queryByText(/used by you/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/12 times?/i)).not.toBeInTheDocument();
  });

  it("requests a limited initial authenticated exercise type page", async () => {
    mockIsAuthenticated = true;
    mockGetExerciseTypes.mockResolvedValue(
      makePaginatedExerciseTypes([makeExerciseType()]),
    );

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "usage",
        undefined,
        EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
      );
    });
  });

  it("shows guest-specific usage wording for guest exercise types", async () => {
    mockGuestStore = {
      ...mockGuestStore,
      exerciseTypes: [makeExerciseType({ times_used: 3, name: "Squats" })],
    };

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Squats")).toBeInTheDocument();
    });
  });

  it("renders only the initial browse window and exposes load more", async () => {
    mockGuestStore = {
      ...mockGuestStore,
      exerciseTypes: Array.from({ length: 35 }, (_, index) =>
        makeExerciseType({
          id: index + 1,
          name: `Exercise ${index + 1}`,
        }),
      ),
    };

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Exercise 1")).toBeInTheDocument();
    });

    expect(screen.getByText("Exercise 30")).toBeInTheDocument();
    expect(screen.queryByText("Exercise 31")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /load more/i }),
    ).toBeInTheDocument();
  });
});
