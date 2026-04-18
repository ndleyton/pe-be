import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
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
  const setScrollMetrics = (element: HTMLElement) => {
    Object.defineProperty(element, "clientHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(element, "scrollTop", {
      configurable: true,
      writable: true,
      value: 580,
    });
  };

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

    expect(
      screen.queryByPlaceholderText(/search exercise types/i),
    ).not.toBeInTheDocument();
  });

  it("renders modal when open", () => {
    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    expect(
      screen.getByPlaceholderText(/search exercise types/i),
    ).toBeInTheDocument();
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
      screen.getByPlaceholderText(/search exercise types/i),
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

  it("clears the search input after selecting an exercise type", async () => {
    mockGuestStore = {
      ...mockGuestStore,
      exerciseTypes: [
        makeExerciseType({ id: 1, name: "Squats" }),
        makeExerciseType({ id: 2, name: "Bench Press" }),
      ],
    };

    const user = userEvent.setup();

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/search exercise types/i);
    await user.type(searchInput, "squ");

    await waitFor(() => {
      expect(screen.getByText("Squats")).toBeInTheDocument();
    });

    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /squats/i }));

    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Squats" }),
    );
    expect(searchInput).toHaveValue("");

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });
  });

  it("reveals more guest exercise types when the modal list is scrolled", async () => {
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

    const scrollContainer = screen.getByTestId(
      "exercise-type-modal-scroll-container",
    );
    setScrollMetrics(scrollContainer);
    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(screen.getByText("Exercise 31")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /load more/i }),
    ).not.toBeInTheDocument();
  });

  it("fetches and renders the next authenticated page when the modal list is scrolled", async () => {
    mockIsAuthenticated = true;
    mockGetExerciseTypes.mockImplementation(
      (_orderBy?: unknown, cursor?: number | null) => {
        if (cursor === 30) {
          return Promise.resolve(
            makePaginatedExerciseTypes(
              Array.from({ length: 2 }, (_, index) =>
                makeExerciseType({
                  id: 31 + index,
                  name: `Exercise ${31 + index}`,
                }),
              ),
              null,
            ),
          );
        }

        return Promise.resolve(
          makePaginatedExerciseTypes(
            Array.from({ length: EXERCISE_TYPE_MODAL_INITIAL_LIMIT }, (_, index) =>
              makeExerciseType({
                id: index + 1,
                name: `Exercise ${index + 1}`,
              }),
            ),
            30,
          ),
        );
      },
    );

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Exercise 30")).toBeInTheDocument();
    });

    expect(screen.queryByText("Exercise 31")).not.toBeInTheDocument();

    const scrollContainer = screen.getByTestId(
      "exercise-type-modal-scroll-container",
    );
    setScrollMetrics(scrollContainer);
    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "usage",
        30,
        EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Exercise 31")).toBeInTheDocument();
      expect(screen.getByText("Exercise 32")).toBeInTheDocument();
    });
  });

  it("queries authenticated search results instead of filtering only the loaded browse page", async () => {
    mockIsAuthenticated = true;
    mockGetExerciseTypes.mockImplementation(
      (
        orderBy?: "usage" | "name",
        _cursor?: number | null,
        _limit?: number,
        _muscleGroupId?: number,
        name?: string,
      ) => {
        if (orderBy === "name" && name === "Exercise 31") {
          return Promise.resolve(
            makePaginatedExerciseTypes([
              makeExerciseType({
                id: 31,
                name: "Exercise 31",
              }),
            ]),
          );
        }

        return Promise.resolve(
          makePaginatedExerciseTypes(
            Array.from({ length: EXERCISE_TYPE_MODAL_INITIAL_LIMIT }, (_, index) =>
              makeExerciseType({
                id: index + 1,
                name: `Exercise ${index + 1}`,
              }),
            ),
            30,
          ),
        );
      },
    );

    const user = userEvent.setup();

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    const searchInput = await screen.findByPlaceholderText(
      /search exercise types/i,
    );
    await user.type(searchInput, "Exercise 31");

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "name",
        undefined,
        EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
        undefined,
        "Exercise 31",
      );
    });

    expect(screen.getByText("Exercise 31")).toBeInTheDocument();
    expect(screen.queryByText(/no matches/i)).not.toBeInTheDocument();
  });

  it("keeps create available when authenticated fuzzy search returns similar but not exact matches", async () => {
    mockIsAuthenticated = true;
    mockGetExerciseTypes.mockImplementation(
      (
        orderBy?: "usage" | "name",
        _cursor?: number | null,
        _limit?: number,
        _muscleGroupId?: number,
        name?: string,
      ) => {
        if (orderBy === "name" && name === "Deadlift") {
          return Promise.resolve(
            makePaginatedExerciseTypes([
              makeExerciseType({
                id: 301,
                name: "Romanian Deadlift",
              }),
            ]),
          );
        }

        return Promise.resolve(
          makePaginatedExerciseTypes([
            makeExerciseType({
              id: 1,
              name: "Browse Exercise 1",
            }),
          ]),
        );
      },
    );

    const user = userEvent.setup();

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    const searchInput = await screen.findByPlaceholderText(
      /search exercise types/i,
    );
    await user.type(searchInput, "Deadlift");

    await waitFor(() => {
      expect(screen.getByText("Romanian Deadlift")).toBeInTheDocument();
      expect(screen.getByTitle('Create "Deadlift"')).toBeInTheDocument();
    });
  });

  it("hides create when authenticated search results contain an exact name match", async () => {
    mockIsAuthenticated = true;
    mockGetExerciseTypes.mockImplementation(
      (
        orderBy?: "usage" | "name",
        _cursor?: number | null,
        _limit?: number,
        _muscleGroupId?: number,
        name?: string,
      ) => {
        if (orderBy === "name" && name === "Deadlift") {
          return Promise.resolve(
            makePaginatedExerciseTypes([
              makeExerciseType({
                id: 301,
                name: "Romanian Deadlift",
              }),
              makeExerciseType({
                id: 302,
                name: "Deadlift",
              }),
            ]),
          );
        }

        return Promise.resolve(
          makePaginatedExerciseTypes([
            makeExerciseType({
              id: 1,
              name: "Browse Exercise 1",
            }),
          ]),
        );
      },
    );

    const user = userEvent.setup();

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    const searchInput = await screen.findByPlaceholderText(
      /search exercise types/i,
    );
    await user.type(searchInput, "Deadlift");

    await waitFor(() => {
      expect(screen.getByText("Deadlift")).toBeInTheDocument();
    });

    expect(screen.queryByTitle('Create "Deadlift"')).not.toBeInTheDocument();
  });

  it("fetches the next authenticated search page when the filtered list is scrolled", async () => {
    mockIsAuthenticated = true;
    mockGetExerciseTypes.mockImplementation(
      (
        orderBy?: "usage" | "name",
        cursor?: number | null,
        _limit?: number,
        _muscleGroupId?: number,
        name?: string,
      ) => {
        if (orderBy === "name" && name === "Exercise") {
          if (cursor === 30) {
            return Promise.resolve(
              makePaginatedExerciseTypes(
                [makeExerciseType({ id: 31, name: "Exercise Match 31" })],
                null,
              ),
            );
          }

          return Promise.resolve(
            makePaginatedExerciseTypes(
              Array.from({ length: EXERCISE_TYPE_MODAL_INITIAL_LIMIT }, (_, index) =>
                makeExerciseType({
                  id: index + 1,
                  name: `Exercise Match ${index + 1}`,
                }),
              ),
              30,
            ),
          );
        }

        return Promise.resolve(
          makePaginatedExerciseTypes(
            Array.from({ length: EXERCISE_TYPE_MODAL_INITIAL_LIMIT }, (_, index) =>
              makeExerciseType({
                id: index + 1,
                name: `Browse Exercise ${index + 1}`,
              }),
            ),
            30,
          ),
        );
      },
    );

    const user = userEvent.setup();

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    const searchInput = await screen.findByPlaceholderText(
      /search exercise types/i,
    );
    await user.type(searchInput, "Exercise");

    await waitFor(() => {
      expect(screen.getByText("Exercise Match 30")).toBeInTheDocument();
    });

    expect(screen.queryByText("Exercise Match 31")).not.toBeInTheDocument();

    const scrollContainer = screen.getByTestId(
      "exercise-type-modal-scroll-container",
    );
    setScrollMetrics(scrollContainer);
    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "name",
        30,
        EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
        undefined,
        "Exercise",
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Exercise Match 31")).toBeInTheDocument();
    });
  });

  it("keeps the previous authenticated search results visible while the next search is pending", async () => {
    mockIsAuthenticated = true;
    let resolveDeadSearch:
      | ((value: ReturnType<typeof makePaginatedExerciseTypes>) => void)
      | null = null;

    mockGetExerciseTypes.mockImplementation(
      (
        orderBy?: "usage" | "name",
        _cursor?: number | null,
        _limit?: number,
        _muscleGroupId?: number,
        name?: string,
      ) => {
        if (orderBy === "name" && name === "Bench") {
          return Promise.resolve(
            makePaginatedExerciseTypes([
              makeExerciseType({
                id: 201,
                name: "Bench Press",
              }),
            ]),
          );
        }

        if (orderBy === "name" && name === "Dead") {
          return new Promise((resolve) => {
            resolveDeadSearch = resolve;
          });
        }

        return Promise.resolve(
          makePaginatedExerciseTypes(
            Array.from({ length: EXERCISE_TYPE_MODAL_INITIAL_LIMIT }, (_, index) =>
              makeExerciseType({
                id: index + 1,
                name: `Browse Exercise ${index + 1}`,
              }),
            ),
            30,
          ),
        );
      },
    );

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    const searchInput = await screen.findByPlaceholderText(
      /search exercise types/i,
    );

    fireEvent.change(searchInput, { target: { value: "Bench" } });

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    fireEvent.change(searchInput, { target: { value: "Dead" } });

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "name",
        undefined,
        EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
        undefined,
        "Dead",
      );
    });

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.queryByText("Deadlift")).not.toBeInTheDocument();

    await act(async () => {
      resolveDeadSearch?.(
        makePaginatedExerciseTypes([
          makeExerciseType({
            id: 202,
            name: "Deadlift",
          }),
        ]),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Deadlift")).toBeInTheDocument();
    });

    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument();
  });
});
