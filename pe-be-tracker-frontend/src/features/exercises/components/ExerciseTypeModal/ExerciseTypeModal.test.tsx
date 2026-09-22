import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/testUtils";
import { EXERCISE_TYPE_MODAL_INITIAL_LIMIT } from "@/features/exercises/constants";
import {
  makeExerciseType,
  makeMuscleGroup,
  makePaginatedExerciseTypes,
} from "@/test/fixtures";
import type { ExerciseType } from "@/features/exercises/types";
import ExerciseTypeModal from "./ExerciseTypeModal";

const mockGetExerciseTypes = vi.fn();
const mockGetMuscleGroups = vi.fn();
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
  getMuscleGroups: (...args: unknown[]) => mockGetMuscleGroups(...args),
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
    mockGetMuscleGroups.mockResolvedValue([]);
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

  it("keeps similar variations identifiable and selects the original exercise", async () => {
    const closeGrip = makeExerciseType({ id: 1, name: "Barbell Bench Press - Close Grip" });
    mockGuestStore.exerciseTypes = [
      closeGrip,
      makeExerciseType({ id: 2, name: "Barbell Bench Press - Medium Grip" }),
    ];
    render(<ExerciseTypeModal isOpen onClose={mockOnClose} onSelect={mockOnSelect} />);

    const result = await screen.findByRole("button", { name: closeGrip.name });
    expect(screen.getByText("Close Grip")).toBeVisible();
    expect(screen.getByText("Medium Grip")).toBeVisible();
    await userEvent.setup().click(result);
    expect(mockOnSelect).toHaveBeenCalledWith(closeGrip);
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

  it("keeps browse results selectable after clearing a completed authenticated search", async () => {
    mockIsAuthenticated = true;
    const browseExercise = makeExerciseType({ id: 1, name: "Squat" });
    const searchExercise = makeExerciseType({ id: 2, name: "Bench Press" });
    mockGetExerciseTypes.mockImplementation((orderBy?: "usage" | "name") =>
      Promise.resolve(
        makePaginatedExerciseTypes([
          orderBy === "name" ? searchExercise : browseExercise,
        ]),
      ),
    );
    const user = userEvent.setup();

    render(
      <ExerciseTypeModal isOpen onClose={mockOnClose} onSelect={mockOnSelect} />,
    );

    await screen.findByRole("button", { name: "Squat" });
    const searchInput = screen.getByPlaceholderText(/search exercise types/i);
    await user.type(searchInput, "Bench");
    await screen.findByRole("button", { name: "Bench Press" });
    await user.clear(searchInput);

    const browseResult = await screen.findByRole("button", { name: "Squat" });
    expect(browseResult.closest(".pointer-events-none")).toBeNull();
    expect(browseResult.closest(".opacity-60")).toBeNull();
    await user.click(browseResult);
    expect(mockOnSelect).toHaveBeenCalledWith(browseExercise);
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
    fireEvent.keyDown(searchInput, { key: "Enter" });
    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Bench Press" })).toBeDisabled();

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

  it("renders muscle group filter chips and allows filtering in guest mode", async () => {
    mockGetMuscleGroups.mockResolvedValue([
      makeMuscleGroup({ id: 1, name: "Chest" }),
      makeMuscleGroup({ id: 2, name: "Legs" }),
    ]);

    mockGuestStore = {
      ...mockGuestStore,
      exerciseTypes: [
        makeExerciseType({ id: 1, name: "Bench Press", muscle_groups: ["Chest"] }),
        makeExerciseType({ id: 2, name: "Squats", muscle_groups: ["Legs"] }),
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

    const chipsContainer = await screen.findByTestId("muscle-group-filter-chips");
    expect(chipsContainer).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chest" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Legs" })).toBeInTheDocument();

    await screen.findByText("Bench Press");
    expect(screen.getByText("Squats")).toBeInTheDocument();

    // Click Chest chip
    await user.click(screen.getByRole("tab", { name: "Chest" }));

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
      expect(screen.queryByText("Squats")).not.toBeInTheDocument();
    });

    // Click All chip
    await user.click(screen.getByRole("tab", { name: "All" }));

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
      expect(screen.getByText("Squats")).toBeInTheDocument();
    });
  });

  it("filters authenticated exercises when a muscle group chip is clicked", async () => {
    mockIsAuthenticated = true;
    mockGetMuscleGroups.mockResolvedValue([
      makeMuscleGroup({ id: 10, name: "Back" }),
    ]);

    mockGetExerciseTypes.mockResolvedValue(
      makePaginatedExerciseTypes([
        makeExerciseType({ id: 1, name: "Lat Pulldown" }),
      ]),
    );

    const user = userEvent.setup();
    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    const backChip = await screen.findByRole("tab", { name: "Back" });
    await user.click(backChip);

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "usage",
        undefined,
        EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
        10,
      );
    });
  });

  it("toggling the active muscle group chip resets filter to all", async () => {
    mockGetMuscleGroups.mockResolvedValue([
      makeMuscleGroup({ id: 1, name: "Chest" }),
    ]);

    mockGuestStore = {
      ...mockGuestStore,
      exerciseTypes: [
        makeExerciseType({ id: 1, name: "Bench Press", muscle_groups: ["Chest"] }),
        makeExerciseType({ id: 2, name: "Squats", muscle_groups: ["Legs"] }),
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

    await screen.findByText("Bench Press");

    const chestChip = await screen.findByRole("tab", { name: "Chest" });
    await user.click(chestChip);

    await waitFor(() => {
      expect(chestChip).toHaveAttribute("aria-selected", "true");
      expect(screen.queryByText("Squats")).not.toBeInTheDocument();
    });

    // Click again to toggle off
    await user.click(chestChip);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText("Squats")).toBeInTheDocument();
    });
  });

  it("combines muscle group filter with search query in authenticated mode", async () => {
    mockIsAuthenticated = true;
    mockGetMuscleGroups.mockResolvedValue([
      makeMuscleGroup({ id: 5, name: "Chest" }),
    ]);

    mockGetExerciseTypes.mockResolvedValue(
      makePaginatedExerciseTypes([
        makeExerciseType({ id: 1, name: "Incline Bench Press" }),
      ]),
    );

    const user = userEvent.setup();
    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    const chestChip = await screen.findByRole("tab", { name: "Chest" });
    await user.click(chestChip);

    const searchInput = screen.getByPlaceholderText(/search exercise types/i);
    await user.type(searchInput, "Incline");

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "name",
        undefined,
        EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
        5,
        "Incline",
      );
    });
  });

  it("renders skeleton cards during initial browse loading in authenticated mode", async () => {
    mockIsAuthenticated = true;
    mockGetExerciseTypes.mockReturnValue(new Promise(() => {}));

    render(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />,
    );

    expect(
      screen.getAllByTestId("exercise-search-result-skeleton").length,
    ).toBeGreaterThan(0);
  });

  it("renders muscle group filter chip skeletons while muscle groups are loading in authenticated mode", async () => {
    mockIsAuthenticated = true;
    mockGetMuscleGroups.mockReturnValue(new Promise(() => {}));
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

    expect(
      screen.getByTestId("muscle-group-filter-chips-skeleton"),
    ).toBeInTheDocument();
  });

  it("shows loading indicator when fetching next page during search", async () => {
    mockIsAuthenticated = true;
    let resolveNextPage: (value: unknown) => void = () => {};
    mockGetExerciseTypes.mockImplementation(
      (
        orderBy?: "usage" | "name",
        cursor?: number | null,
      ) => {
        if (orderBy === "name") {
          if (!cursor) {
            return Promise.resolve(
              makePaginatedExerciseTypes(
                [makeExerciseType({ id: 1, name: "Squats" })],
                2,
              ),
            );
          }
          return new Promise((resolve) => {
            resolveNextPage = resolve;
          });
        }
        return Promise.resolve(makePaginatedExerciseTypes([]));
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

    const searchInput = screen.getByPlaceholderText(/search exercise types/i);
    await user.type(searchInput, "Squat");

    await screen.findByText("Squats");

    const scrollContainer = screen.getByTestId(
      "exercise-type-modal-scroll-container",
    );
    setScrollMetrics(scrollContainer);
    fireEvent.scroll(scrollContainer);

    await screen.findByText("Loading more exercises...");

    await act(async () => {
      resolveNextPage(
        makePaginatedExerciseTypes([
          makeExerciseType({ id: 2, name: "Squats Heavy" }),
        ]),
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Loading more exercises..."),
      ).not.toBeInTheDocument();
    });
  });

  it("does not flash skeleton cards when clicking a muscle group chip", async () => {
    mockIsAuthenticated = true;
    mockGetMuscleGroups.mockResolvedValue([
      makeMuscleGroup({ id: 10, name: "Back" }),
    ]);

    let resolveBackQuery:
      | ((value: ReturnType<typeof makePaginatedExerciseTypes>) => void)
      | null = null;

    mockGetExerciseTypes.mockImplementation(
      (
        _orderBy?: "usage" | "name",
        _cursor?: number | null,
        _limit?: number,
        muscleGroupId?: number,
      ) => {
        if (muscleGroupId === 10) {
          return new Promise((resolve) => {
            resolveBackQuery = resolve;
          });
        }
        return Promise.resolve(
          makePaginatedExerciseTypes([
            makeExerciseType({ id: 1, name: "Bench Press" }),
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

    await screen.findByText("Bench Press");

    const backChip = await screen.findByRole("tab", { name: "Back" });
    await user.click(backChip);

    // Muscle group is selected
    expect(backChip).toHaveAttribute("aria-selected", "true");

    // Skeletons should NOT be rendered while transitioning between muscle groups
    expect(
      screen.queryByTestId("exercise-search-result-skeleton"),
    ).not.toBeInTheDocument();

    // Previous exercise remains visible during transition
    expect(screen.getByText("Bench Press")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search exercise types/i);
    await user.click(searchInput);
    await user.keyboard("{Enter}");
    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Bench Press" })).toBeDisabled();

    // Now resolve the Back query
    await act(async () => {
      resolveBackQuery?.(
        makePaginatedExerciseTypes([
          makeExerciseType({ id: 2, name: "Lat Pulldown" }),
        ]),
      );
    });

    await screen.findByText("Lat Pulldown");
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lat Pulldown" })).toBeEnabled();
    await user.keyboard("{Enter}");
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, name: "Lat Pulldown" }),
    );
  });

  it("keeps no matches visible while an empty search refetches", async () => {
    mockIsAuthenticated = true;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    mockGetExerciseTypes.mockResolvedValue(makePaginatedExerciseTypes([]));
    const { unmount } = render(
      <ExerciseTypeModal isOpen onClose={mockOnClose} onSelect={mockOnSelect} />,
      { queryClient },
    );
    fireEvent.change(screen.getByPlaceholderText(/search exercise types/i), {
      target: { value: "Missing" },
    });
    await screen.findByText("No matches");

    let resolveRefetch!: (page: ReturnType<typeof makePaginatedExerciseTypes>) => void;
    mockGetExerciseTypes.mockImplementation(() => new Promise((resolve) => {
      resolveRefetch = resolve;
    }));
    await act(async () => {
      void queryClient.invalidateQueries({
        queryKey: ["exerciseTypes", "modal", "search"],
      });
      // Allow Query's scheduled observer notification to reach the component.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(queryClient.isFetching()).toBe(1);
    expect(screen.getByText("No matches")).toBeInTheDocument();
    expect(screen.queryByTestId("exercise-search-result-skeleton")).not.toBeInTheDocument();

    await act(async () => resolveRefetch(makePaginatedExerciseTypes([])));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.getByText("No matches")).toBeInTheDocument();
    unmount();
    queryClient.clear();
  });

  it("shows no matches for an empty search within a populated muscle group", async () => {
    mockIsAuthenticated = true;
    mockGetMuscleGroups.mockResolvedValue([
      makeMuscleGroup({ id: 10, name: "Back" }),
    ]);
    mockGetExerciseTypes.mockImplementation(
      (
        orderBy?: "usage" | "name",
        _cursor?: number | null,
        _limit?: number,
        muscleGroupId?: number,
      ) => Promise.resolve(
        makePaginatedExerciseTypes(
          orderBy === "name"
            ? []
            : [makeExerciseType({
                id: muscleGroupId === 10 ? 2 : 1,
                name: muscleGroupId === 10 ? "Lat Pulldown" : "Bench Press",
              })],
        ),
      ),
    );
    const user = userEvent.setup();
    render(
      <ExerciseTypeModal isOpen onClose={mockOnClose} onSelect={mockOnSelect} />,
    );

    await screen.findByRole("button", { name: "Bench Press" });
    await user.click(await screen.findByRole("tab", { name: "Back" }));
    await screen.findByRole("button", { name: "Lat Pulldown" });

    await user.type(
      screen.getByPlaceholderText(/search exercise types/i),
      "Unmatched exercise",
    );

    await screen.findByText("No matches");
    expect(mockGetExerciseTypes).toHaveBeenCalledWith(
      "name", undefined, EXERCISE_TYPE_MODAL_INITIAL_LIMIT, 10, "Unmatched exercise",
    );
    expect(screen.queryByText("No Exercises Found")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No exercises match the selected muscle group."),
    ).not.toBeInTheDocument();
  });

  it("shows muscle group empty state when filtered muscle group has no exercises", async () => {
    mockIsAuthenticated = true;
    mockGetMuscleGroups.mockResolvedValue([
      makeMuscleGroup({ id: 20, name: "Neck" }),
    ]);

    mockGetExerciseTypes.mockImplementation(
      (
        _orderBy?: "usage" | "name",
        _cursor?: number | null,
        _limit?: number,
        muscleGroupId?: number,
      ) => {
        if (muscleGroupId === 20) {
          return Promise.resolve(makePaginatedExerciseTypes([]));
        }
        return Promise.resolve(
          makePaginatedExerciseTypes([
            makeExerciseType({ id: 1, name: "Bench Press" }),
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

    await screen.findByText("Bench Press");

    const neckChip = await screen.findByRole("tab", { name: "Neck" });
    await user.click(neckChip);

    await screen.findByText("No Exercises Found");
    expect(
      screen.getByText("No exercises match the selected muscle group."),
    ).toBeInTheDocument();
  });
});
