import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { render } from "@/test/testUtils";
import { makeExerciseType, makeMuscle, makeMuscleGroup } from "@/test/fixtures";
import ExerciseTypeDetailsPage from "./ExerciseTypeDetailsPage";
import {
  getExerciseTypeById,
  getIntensityUnits,
  getMuscles,
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
    getIntensityUnits: vi.fn(),
    getMuscles: vi.fn(),
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
const mockGetIntensityUnits = vi.mocked(getIntensityUnits);
const mockGetMuscles = vi.mocked(getMuscles);
const mockGetExerciseTypeStats = vi.mocked(getExerciseTypeStats);
const mockUpdateExerciseType = vi.mocked(updateExerciseType);
const mockRequestExerciseTypeEvaluation = vi.mocked(requestExerciseTypeEvaluation);
const mockReleaseExerciseType = vi.mocked(releaseExerciseType);

describe("ExerciseTypeDetailsPage", () => {
  beforeAll(() => {
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = () => {};
    }
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: 1, is_superuser: true };
    mockGetIntensityUnits.mockResolvedValue([
      { id: 1, name: "Kilograms", abbreviation: "kg" },
      { id: 2, name: "Pounds", abbreviation: "lb" },
    ]);
    mockGetMuscles.mockResolvedValue([
      makeMuscle({
        id: 10,
        name: "Latissimus Dorsi",
        muscle_group: makeMuscleGroup({ id: 100, name: "Back" }),
      }),
      makeMuscle({
        id: 11,
        name: "Biceps",
        muscle_group: makeMuscleGroup({ id: 101, name: "Arms" }),
      }),
    ]);
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

  it("keeps the exercise detail shell visible while data is pending", () => {
    mockGetExerciseTypeById.mockImplementation(
      () => new Promise(() => undefined),
    );

    const { container } = render(<ExerciseTypeDetailsPage />);

    expect(screen.getByRole("link", { name: /go back/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /progressive overload/i }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
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
    const backGroup = makeMuscleGroup({ id: 100, name: "Back" });
    const lat = makeMuscle({
      id: 10,
      name: "Latissimus Dorsi",
      muscle_group: backGroup,
    });
    mockGetExerciseTypeById.mockResolvedValue(
      makeExerciseType({
        id: 12,
        name: "Lat Pulldown",
        description: "Cable back exercise",
        default_intensity_unit: 1,
        muscles: [lat],
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
    await userEvent.click(
      screen.getByRole("combobox", { name: /default intensity unit/i }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "lb - Pounds" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Latissimus Dorsi" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Biceps" }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateExerciseType).toHaveBeenCalledWith(12, {
        name: "Wide Grip Lat Pulldown",
        description: "Cable back exercise",
        default_intensity_unit: 2,
        equipment: null,
        category: null,
        instructions: null,
        muscle_ids: [11],
      });
    });
  });

  it("disables the save button while an update is pending", async () => {
    let resolveUpdate = () => {};
    mockUpdateExerciseType.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = () =>
            resolve(
              makeExerciseType({
                id: 12,
                name: "Lat Pulldown",
                status: "released",
                owner_id: null,
                images: [],
              }),
            );
        }),
    );
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

    await screen.findByRole("button", { name: /^edit$/i });
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    const saveButton = await screen.findByRole("button", {
      name: /save changes/i,
    });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    });

    await userEvent.click(screen.getByRole("button", { name: /saving/i }));
    expect(mockUpdateExerciseType).toHaveBeenCalledTimes(1);

    resolveUpdate();
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
