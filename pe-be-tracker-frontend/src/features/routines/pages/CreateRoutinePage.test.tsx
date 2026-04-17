import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";

import { render } from "@/test/testUtils";
import CreateRoutinePage from "./CreateRoutinePage";
import {
  useRoutineCreateActions,
  useRoutineDetailsData,
  useRoutineEditor,
} from "@/features/routines/hooks";

const mockNavigate = vi.fn();
const mockUseBlocker = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useBlocker: () => mockUseBlocker(),
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/features/exercises/components", () => ({
  ExerciseTypeModal: () => null,
  IntensityUnitModal: () => null,
}));

vi.mock("@/features/routines/components", () => ({
  RoutineInfoCard: () => <div data-testid="routine-info-card" />,
  RoutineTemplatesCard: () => <div data-testid="routine-templates-card" />,
}));

vi.mock("@/features/routines/hooks", () => ({
  useRoutineCreateActions: vi.fn(),
  useRoutineDetailsData: vi.fn(),
  useRoutineEditor: vi.fn(),
}));

const mockUseRoutineCreateActions = vi.mocked(useRoutineCreateActions);
const mockUseRoutineDetailsData = vi.mocked(useRoutineDetailsData);
const mockUseRoutineEditor = vi.mocked(useRoutineEditor);

describe("CreateRoutinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBlocker.mockReturnValue({ state: "unblocked" });

    mockUseRoutineEditor.mockReturnValue({
      description: "",
      editorTemplates: [],
      exercisePickerTarget: null,
      hasInvalidTemplates: false,
      hasUnsavedChanges: false,
      name: "",
      visibility: "private",
      author: null,
      category: null,
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
      setAuthor: vi.fn(),
      setCategory: vi.fn(),
      setName: vi.fn(),
      updateSet: vi.fn(),
      updateTemplate: vi.fn(),
    } as ReturnType<typeof useRoutineEditor>);

    mockUseRoutineCreateActions.mockReturnValue({
      saveMutation: {
        error: null,
        isPending: false,
        mutate: vi.fn(),
      },
    } as ReturnType<typeof useRoutineCreateActions>);
  });

  it("does not redirect before auth initialization completes", () => {
    mockUseRoutineDetailsData.mockReturnValue({
      availableIntensityUnits: [],
      authInitialized: false,
      canEdit: false,
      editAccessMessage: null,
      isAuthenticated: false,
      routine: null,
      routineError: null,
      routinePending: false,
      unitsPending: false,
    });

    render(<CreateRoutinePage />);

    expect(
      screen.getByRole("heading", { name: /new routine/i, level: 1 }),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users after auth initialization", () => {
    mockUseRoutineDetailsData.mockReturnValue({
      availableIntensityUnits: [],
      authInitialized: true,
      canEdit: false,
      editAccessMessage: null,
      isAuthenticated: false,
      routine: null,
      routineError: null,
      routinePending: false,
      unitsPending: false,
    });

    render(<CreateRoutinePage />);

    expect(mockNavigate).toHaveBeenCalledWith("/routines", { replace: true });
  });
});
