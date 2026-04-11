import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/testUtils";
import {
  makeExerciseType,
  makeExerciseTypes,
  makeMuscleGroup,
  makePaginatedExerciseTypes,
} from "@/test/fixtures";
import ExerciseTypesPage from "./ExerciseTypesPage";
import {
  createExerciseType,
  getExerciseTypes,
  getMuscleGroups,
} from "@/features/exercises/api";
import type { ExerciseType } from "@/features/exercises/types";

vi.mock("@/features/exercises/api");

let mockIsAuthenticated = false;

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
}));

vi.mock("@/features/exercises/components", () => ({
  ExerciseTypeCard: ({ exerciseType }: { exerciseType: ExerciseType }) => (
    <div data-testid={`exercise-type-${exerciseType.id}`}>
      {exerciseType.name}
    </div>
  ),
}));

const mockGetExerciseTypes = vi.mocked(getExerciseTypes);
const mockGetMuscleGroups = vi.mocked(getMuscleGroups);
const mockCreateExerciseType = vi.mocked(createExerciseType);

const mockExerciseTypes: ExerciseType[] = [
  makeExerciseType({
    id: 1,
    name: "Push-ups",
    description: "Classic bodyweight exercise",
    muscle_groups: ["chest", "triceps"],
    usage_count: 10,
    default_intensity_unit: 1,
    times_used: 10,
  }),
  makeExerciseType({
    id: 2,
    name: "Squats",
    description: "Lower body exercise",
    muscle_groups: ["quadriceps", "glutes"],
    usage_count: 8,
    default_intensity_unit: 1,
    times_used: 8,
  }),
  makeExerciseType({
    id: 3,
    name: "Pull-ups",
    description: "Upper body pulling exercise",
    muscle_groups: ["back", "biceps"],
    equipment: "pull-up bar",
    usage_count: 6,
    default_intensity_unit: 1,
    times_used: 6,
  }),
];

const mockMuscleGroups = [
  makeMuscleGroup({ id: 1, name: "Chest" }),
  makeMuscleGroup({ id: 2, name: "Legs" }),
  makeMuscleGroup({ id: 3, name: "Back" }),
];

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe("ExerciseTypesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = false;
    Element.prototype.hasPointerCapture ??= vi.fn(() => false);
    Element.prototype.releasePointerCapture ??= vi.fn();
    Element.prototype.scrollIntoView ??= vi.fn();

    Object.defineProperty(document.documentElement, "scrollTop", {
      value: 0,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });

    mockGetExerciseTypes.mockResolvedValue(
      makePaginatedExerciseTypes(mockExerciseTypes),
    );
    mockGetMuscleGroups.mockResolvedValue(mockMuscleGroups);
    mockCreateExerciseType.mockResolvedValue(makeExerciseType({ id: 999 }));
  });

  it("renders the page title and search controls", async () => {
    render(<ExerciseTypesPage />);

    expect(
      screen.getByRole("heading", { name: /exercises/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search exercises/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /filter by muscle group/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /popular/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /a-z/i })).toBeInTheDocument();
  });

  it("loads the default browse query and muscle groups", async () => {
    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "usage",
        undefined,
        100,
        undefined,
      );
      expect(mockGetMuscleGroups).toHaveBeenCalledTimes(1);
    });
  });

  it("reloads exercise types when a muscle group is selected", async () => {
    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("combobox", { name: /filter by muscle group/i }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "Chest" }));

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenLastCalledWith(
        "usage",
        undefined,
        100,
        1,
      );
    });
  });

  it("populates muscle-group options from getMuscleGroups instead of exercise pages", async () => {
    mockGetExerciseTypes.mockResolvedValue(
      makePaginatedExerciseTypes([
        makeExerciseType({
          id: 10,
          name: "Cable Row",
          muscle_groups: ["back"],
        }),
      ]),
    );
    mockGetMuscleGroups.mockResolvedValue([
      makeMuscleGroup({ id: 9, name: "Shoulders" }),
    ]);

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-10")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("combobox", { name: /filter by muscle group/i }),
    );

    expect(await screen.findByRole("option", { name: "Shoulders" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "Back" }),
    ).not.toBeInTheDocument();
  });

  it("shows the muscle-group selector loading state while getMuscleGroups is pending", async () => {
    const deferred = createDeferred<typeof mockMuscleGroups>();
    mockGetMuscleGroups.mockReturnValueOnce(deferred.promise);

    render(<ExerciseTypesPage />);

    expect(
      screen.getByRole("combobox", { name: /filter by muscle group/i }),
    ).toBeDisabled();

    deferred.resolve(mockMuscleGroups);

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /filter by muscle group/i }),
      ).toBeEnabled();
    });
  });

  it("keeps the muscle-group selector enabled when the muscle-group lookup fails", async () => {
    mockGetMuscleGroups.mockRejectedValueOnce(new Error("lookup failed"));

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /filter by muscle group/i }),
      ).toBeEnabled();
    });
  });

  it("falls back to an empty muscle-group option list when getMuscleGroups fails", async () => {
    mockGetMuscleGroups.mockRejectedValueOnce(new Error("lookup failed"));

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /filter by muscle group/i }),
      ).toBeEnabled();
    });

    await userEvent.click(
      screen.getByRole("combobox", { name: /filter by muscle group/i }),
    );

    expect(
      await screen.findByRole("option", { name: "All Muscle Groups" }),
    ).toBeVisible();
    expect(screen.queryByRole("option", { name: "Chest" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Legs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Back" })).not.toBeInTheDocument();
  });

  it("displays exercise types after loading", async () => {
    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
      expect(screen.getByTestId("exercise-type-2")).toBeInTheDocument();
      expect(screen.getByTestId("exercise-type-3")).toBeInTheDocument();
    });
  });

  it("uses server-backed search instead of filtering only the loaded browse page", async () => {
    const searchResult = makeExerciseType({
      id: 44,
      name: "Nordic Curl",
      description: "Hamstring exercise",
    });

    mockGetExerciseTypes.mockImplementation(
      async (_orderBy, _cursor, _limit, _muscleGroupId, name) => {
        if (name === "Nordic") {
          return makePaginatedExerciseTypes([searchResult]);
        }

        return makePaginatedExerciseTypes(mockExerciseTypes);
      },
    );

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
    });

    await userEvent.type(
      screen.getByPlaceholderText(/search exercises/i),
      "Nordic",
    );

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "usage",
        undefined,
        100,
        undefined,
        "Nordic",
      );
      expect(screen.getByTestId("exercise-type-44")).toBeInTheDocument();
    });
  });

  it("shows empty state when the server search returns no matches", async () => {
    mockGetExerciseTypes.mockImplementation(
      async (_orderBy, _cursor, _limit, _muscleGroupId, name) =>
        name
          ? makePaginatedExerciseTypes([])
          : makePaginatedExerciseTypes(mockExerciseTypes),
    );

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
    });

    await userEvent.type(
      screen.getByPlaceholderText(/search exercises/i),
      "nonexistent",
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no exercise types match your current filters/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /clear filters/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows an inline create control for authenticated users with no server matches", async () => {
    mockIsAuthenticated = true;
    mockGetExerciseTypes.mockImplementation(
      async (_orderBy, _cursor, _limit, _muscleGroupId, name) =>
        name
          ? makePaginatedExerciseTypes([])
          : makePaginatedExerciseTypes(mockExerciseTypes),
    );

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
    });

    await userEvent.type(
      screen.getByPlaceholderText(/search exercises/i),
      "Nordic Curl",
    );

    await waitFor(() => {
      expect(screen.getByTitle('Create "Nordic Curl"')).toBeInTheDocument();
    });
  });

  it("creates a new exercise type from server-backed search for authenticated users", async () => {
    mockIsAuthenticated = true;
    mockGetExerciseTypes.mockImplementation(
      async (_orderBy, _cursor, _limit, _muscleGroupId, name) =>
        name
          ? makePaginatedExerciseTypes([])
          : makePaginatedExerciseTypes(mockExerciseTypes),
    );
    mockCreateExerciseType.mockResolvedValue(
      makeExerciseType({
        id: 44,
        name: "Nordic Curl",
        description: "Custom exercise",
        default_intensity_unit: 1,
      }),
    );

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
    });

    await userEvent.type(
      screen.getByPlaceholderText(/search exercises/i),
      "Nordic Curl",
    );
    await userEvent.click(screen.getByTitle('Create "Nordic Curl"'));

    await waitFor(() => {
      expect(mockCreateExerciseType).toHaveBeenCalledWith(
        {
          name: "Nordic Curl",
          description: "Custom exercise",
          default_intensity_unit: 1,
        },
        expect.any(Object),
      );
    });
  });

  it("restores the browse results when the search is cleared", async () => {
    const searchResult = makeExerciseType({
      id: 44,
      name: "Nordic Curl",
      description: "Hamstring exercise",
    });

    mockGetExerciseTypes.mockImplementation(
      async (_orderBy, _cursor, _limit, _muscleGroupId, name) =>
        name === "Nordic"
          ? makePaginatedExerciseTypes([searchResult])
          : makePaginatedExerciseTypes(mockExerciseTypes),
    );

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search exercises/i);
    await userEvent.type(searchInput, "Nordic");

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-44")).toBeInTheDocument();
    });

    await userEvent.clear(searchInput);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
      expect(screen.queryByTestId("exercise-type-44")).not.toBeInTheDocument();
    });
  });

  it("fetches the next browse page when the user scrolls near the bottom", async () => {
    const fullPage = makeExerciseTypes(100, (index) => ({
      id: index + 1,
      name: `Exercise ${index + 1}`,
      description: `Description ${index + 1}`,
      muscle_groups: ["test"],
      usage_count: index + 1,
      default_intensity_unit: 1,
      times_used: index + 1,
    }));
    const nextPage = [makeExerciseType({ id: 101, name: "Exercise 101" })];

    mockGetExerciseTypes.mockImplementation(
      async (_orderBy, cursor, _limit, _muscleGroupId, name) => {
        if (name) {
          return makePaginatedExerciseTypes([]);
        }

        if (cursor === 100) {
          return makePaginatedExerciseTypes(nextPage);
        }

        return makePaginatedExerciseTypes(fullPage, 100);
      },
    );

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
    });

    Object.defineProperty(document.documentElement, "scrollTop", {
      value: 900,
      configurable: true,
    });

    fireEvent.scroll(window);

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "usage",
        100,
        100,
        undefined,
      );
      expect(screen.getByTestId("exercise-type-101")).toBeInTheDocument();
    });
  });

  it("fetches the next search page when the user scrolls during search", async () => {
    const firstSearchPage = [
      makeExerciseType({ id: 201, name: "Push Exercise 201" }),
    ];
    const secondSearchPage = [
      makeExerciseType({ id: 202, name: "Push Exercise 202" }),
    ];

    mockGetExerciseTypes.mockImplementation(
      async (_orderBy, cursor, _limit, _muscleGroupId, name) => {
        if (name === "Push") {
          if (cursor === 100) {
            return makePaginatedExerciseTypes(secondSearchPage);
          }

          return makePaginatedExerciseTypes(firstSearchPage, 100);
        }

        return makePaginatedExerciseTypes(mockExerciseTypes);
      },
    );

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
    });

    await userEvent.type(
      screen.getByPlaceholderText(/search exercises/i),
      "Push",
    );

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-201")).toBeInTheDocument();
    });

    Object.defineProperty(document.documentElement, "scrollTop", {
      value: 900,
      configurable: true,
    });

    fireEvent.scroll(window);

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "usage",
        100,
        100,
        undefined,
        "Push",
      );
      expect(screen.getByTestId("exercise-type-202")).toBeInTheDocument();
    });
  });

  it("shows no more items message when all data is loaded", async () => {
    mockGetExerciseTypes.mockResolvedValue({
      data: mockExerciseTypes.slice(0, 2),
      next_cursor: null,
    });

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("exercise-type-1")).toBeInTheDocument();
      expect(
        screen.getByText(/no more exercise types to load/i),
      ).toBeInTheDocument();
    });
  });

  it("shows an error message when the active exercise-type query fails", async () => {
    mockGetExerciseTypes.mockRejectedValue(new Error("API Error"));

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/error loading exercise types/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/please try again/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no exercise types exist", async () => {
    mockGetExerciseTypes.mockResolvedValue(makePaginatedExerciseTypes([]));

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/no exercise types available/i),
      ).toBeInTheDocument();
    });
  });
});
