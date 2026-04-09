import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";

import { render } from "@/test/testUtils";
import RoutineDetailsPage from "./RoutineDetailsPage";
import {
  useRoutineDetailsActions,
  useRoutineDetailsData,
  useRoutineEditor,
} from "@/features/routines/hooks";

const mockUseParams = vi.fn();
const mockUseBlocker = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useParams: () => mockUseParams(),
    useBlocker: () => mockUseBlocker(),
  };
});

vi.mock("@/features/exercises/components", () => ({
  ExerciseTypeModal: () => null,
  IntensityUnitModal: () => null,
}));

vi.mock("@/features/routines/components", () => ({
  RoutineDetailsLoadingState: () => (
    <div data-testid="routine-details-loading">
      <div data-slot="skeleton" />
    </div>
  ),
  RoutineInfoCard: () => <div data-testid="routine-info-card" />,
  RoutineTemplatesCard: () => <div data-testid="routine-templates-card" />,
  RoutineDetailsPageSkeleton: () => (
    <div data-testid="routine-page-skeleton">
      <div data-slot="skeleton" />
    </div>
  ),
}));

vi.mock(
  "@/features/routines/components/RoutineStructuredData/RoutineStructuredData",
  () => ({
    RoutineStructuredData: () => null,
  }),
);

vi.mock("@/features/routines/hooks", () => ({
  useRoutineDetailsActions: vi.fn(),
  useRoutineDetailsData: vi.fn(),
  useRoutineEditor: vi.fn(),
}));

const mockUseRoutineDetailsData = vi.mocked(useRoutineDetailsData);
const mockUseRoutineEditor = vi.mocked(useRoutineEditor);
const mockUseRoutineDetailsActions = vi.mocked(useRoutineDetailsActions);

describe("RoutineDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({ routineId: "42" });
    mockUseBlocker.mockReturnValue({ state: "unblocked" });

    mockUseRoutineEditor.mockReturnValue({
      description: "",
      editorTemplates: [],
      exercisePickerTarget: null,
      hasInvalidTemplates: false,
      hasUnsavedChanges: false,
      name: "",
      visibility: "private",
      unitPickerTarget: null,
      addSetToTemplate: vi.fn(),
      closeExercisePicker: vi.fn(),
      closeUnitPicker: vi.fn(),
      handleExerciseTypeSelected: vi.fn(),
      handleIntensityUnitSelected: vi.fn(),
      openExercisePicker: vi.fn(),
      openUnitPicker: vi.fn(),
      removeSetFromTemplate: vi.fn(),
      removeTemplate: vi.fn(),
      setDescription: vi.fn(),
      setVisibility: vi.fn(),
      setName: vi.fn(),
      updateSet: vi.fn(),
      updateTemplate: vi.fn(),
    } as ReturnType<typeof useRoutineEditor>);

    mockUseRoutineDetailsActions.mockReturnValue({
      deleteMutation: { error: null, isPending: false },
      handleDelete: vi.fn(),
      saveMutation: {
        error: null,
        isPending: false,
        mutateAsync: vi.fn(),
      },
      startMutation: { error: null, isPending: false, mutate: vi.fn() },
    } as unknown as ReturnType<typeof useRoutineDetailsActions>);
  });

  it("keeps the routine shell visible while data is pending", () => {
    mockUseRoutineDetailsData.mockReturnValue({
      availableIntensityUnits: [],
      canEdit: false,
      editAccessMessage: null,
      isAuthenticated: true,
      routine: null,
      routineError: null,
      routinePending: true,
      unitsPending: false,
    });

    const { container } = render(<RoutineDetailsPage />);

    expect(
      screen.getByRole("heading", { name: /routine details/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go back/i })).toBeInTheDocument();
    expect(screen.queryByText(/loading routine/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows the unavailable alert when the routine request fails", () => {
    mockUseRoutineDetailsData.mockReturnValue({
      availableIntensityUnits: [],
      canEdit: false,
      editAccessMessage: null,
      isAuthenticated: true,
      routine: null,
      routineError: new Error("Request failed"),
      routinePending: false,
      unitsPending: false,
    });

    render(<RoutineDetailsPage />);

    expect(screen.getByText(/routine unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/we couldn't load this routine/i)).toBeInTheDocument();
  });
});
