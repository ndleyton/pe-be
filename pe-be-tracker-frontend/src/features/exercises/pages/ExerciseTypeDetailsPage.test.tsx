import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { render } from "@/test/testUtils";
import { makeExerciseType } from "@/test/fixtures";
import ExerciseTypeDetailsPage from "./ExerciseTypeDetailsPage";
import {
  getExerciseTypeById,
  getExerciseTypeStats,
  releaseExerciseType,
  requestExerciseTypeEvaluation,
  updateExerciseType,
} from "@/features/exercises/api";

vi.mock("@/features/exercises/api", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/exercises/api")
  >("@/features/exercises/api");

  return {
    ...actual,
    getExerciseTypeById: vi.fn(),
    getExerciseTypeStats: vi.fn(),
    updateExerciseType: vi.fn(),
    requestExerciseTypeEvaluation: vi.fn(),
    releaseExerciseType: vi.fn(),
  };
});

vi.mock("@/features/workouts", () => ({
  addExerciseToCurrentWorkout: vi.fn(),
}));

const mockAuthState = {
  isAuthenticated: true,
  user: { id: 1, is_superuser: true },
};

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useParams: () => ({ exerciseTypeId: "12" }),
    useNavigate: () => vi.fn(),
  };
});

const mockGetExerciseTypeById = vi.mocked(getExerciseTypeById);
const mockGetExerciseTypeStats = vi.mocked(getExerciseTypeStats);
const mockUpdateExerciseType = vi.mocked(updateExerciseType);
const mockRequestExerciseTypeEvaluation = vi.mocked(requestExerciseTypeEvaluation);
const mockReleaseExerciseType = vi.mocked(releaseExerciseType);

describe("ExerciseTypeDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: 1, is_superuser: true };
    mockGetExerciseTypeStats.mockResolvedValue({
      progressiveOverload: [],
      lastWorkout: null,
      personalBest: null,
      totalSets: 0,
      intensityUnit: { id: 1, name: "Pounds", abbreviation: "lb" },
    });
    mockUpdateExerciseType.mockImplementation(async (_id, updates) =>
      makeExerciseType({
        id: 12,
        status: "released",
        owner_id: null,
        images: [],
        ...updates,
      }),
    );
    mockRequestExerciseTypeEvaluation.mockResolvedValue(
      makeExerciseType({ id: 12, status: "in_review", images: [] }),
    );
    mockReleaseExerciseType.mockResolvedValue(
      makeExerciseType({ id: 12, status: "released", images: [] }),
    );
  });

  it("lets a superuser enter edit mode for a released exercise type", async () => {
    mockGetExerciseTypeById.mockResolvedValue(
      makeExerciseType({
        id: 12,
        name: "Lat Pulldown",
        status: "released",
        owner_id: null,
        images: [],
      }),
    );

    render(<ExerciseTypeDetailsPage />);

    await waitFor(() => {
      expect(mockGetExerciseTypeById).toHaveBeenCalledWith("12");
    });

    expect(
      screen.queryByRole("heading", { name: /edit exercise type/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    expect(
      await screen.findByRole("heading", { name: /edit exercise type/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/admin edits apply directly to this released exercise type/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("saves admin edits for a released exercise type after entering edit mode", async () => {
    mockGetExerciseTypeById.mockResolvedValue(
      makeExerciseType({
        id: 12,
        name: "Lat Pulldown",
        description: "Cable back exercise",
        status: "released",
        owner_id: null,
        images: [],
      }),
    );

    render(<ExerciseTypeDetailsPage />);

    await screen.findByRole("button", { name: /^edit$/i });
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    const nameInput = await screen.findByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Wide Grip Lat Pulldown");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateExerciseType).toHaveBeenCalledWith(12, {
        name: "Wide Grip Lat Pulldown",
        description: "Cable back exercise",
        equipment: null,
        category: null,
        instructions: null,
      });
    });
  });

  it("keeps candidate and in-review exercise types editable without the extra button", async () => {
    mockGetExerciseTypeById.mockResolvedValue(
      makeExerciseType({
        id: 12,
        name: "Pending Exercise",
        status: "in_review",
        owner_id: 7,
        images: [],
      }),
    );

    render(<ExerciseTypeDetailsPage />);

    expect(
      await screen.findByRole("heading", { name: /edit exercise type/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/non-released exercise types can be reviewed and updated before release/i),
    ).toBeInTheDocument();
  });
  it("displays equipment, category, and instructions", async () => {
    mockGetExerciseTypeById.mockResolvedValue(
      makeExerciseType({
        id: 12,
        name: "Barbell Bench Press",
        equipment: "barbell",
        category: "strength",
        instructions: "Lie on the bench and press the bar up.",
        status: "released",
        images: [],
      }),
    );

    render(<ExerciseTypeDetailsPage />);

    await waitFor(() => {
      // Use exact match for badges to avoid matching the title "Barbell Bench Press"
      expect(screen.getByText("barbell")).toBeInTheDocument();
    });
    expect(screen.getByText("strength")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /instructions/i })).toBeInTheDocument();
    expect(
      screen.getByText(/lie on the bench and press the bar up/i),
    ).toBeInTheDocument();
  });
});
