import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/testUtils";
import { makeExerciseSet } from "@/test/fixtures";
import { ExerciseSetTable } from "./ExerciseSetTable";

describe("pending pair rows", () => {
  it("replaces markers with spinners and enables controls when confirmed", () => {
    const left = makeExerciseSet({ id: "temp-pair-left", client_key: "temp-pair-left", side: "left", done: false });
    const right = makeExerciseSet({ id: "temp-pair-right", client_key: "temp-pair-right", side: "right", done: false });
    const existing = makeExerciseSet({ id: 10, done: false });
    const props = {
      activeSetId: null, currentIntensityUnitAbbreviation: "kg", currentIntensityUnitId: 1,
      durationInputs: {}, intensityInputs: {}, repsInputs: {},
      exerciseSets: [existing, left, right], pendingPairSetKeys: [left.client_key!, right.client_key!],
      isUnsavedExercise: false, setNotesValue: "", setRpeValue: null, setRirValue: null,
      onAddSet: vi.fn(), onAddPair: vi.fn(), onCloseSetOptions: vi.fn(),
      onDecrementReps: vi.fn(), onDeleteSet: vi.fn(), onIncrementReps: vi.fn(),
      onOpenSetOptions: vi.fn(), onSetOptionsOpenChange: vi.fn(),
      onSetDurationInputValue: vi.fn(), onSetNotesValueChange: vi.fn(),
      onSetRepsInputValue: vi.fn(), onSetRpeValueChange: vi.fn(), onSetRirValueChange: vi.fn(),
      onSetValueModeChange: vi.fn(), onSetWeightInputValue: vi.fn(),
      onToggleSetCompletion: vi.fn(), onUpdateSetField: vi.fn(), onUpdateSetSide: vi.fn(),
    };
    const { rerender } = render(<ExerciseSetTable {...props} />);
    expect(screen.getAllByRole("status", { name: "Saving set" })).toHaveLength(2);
    expect(screen.queryByText("L")).not.toBeInTheDocument();
    expect(screen.queryByText("R")).not.toBeInTheDocument();
    for (const spinner of screen.getAllByRole("status")) {
      const row = spinner.closest('[aria-busy="true"]') as HTMLElement;
      for (const control of [...within(row).getAllByRole("button"), ...within(row).getAllByRole("textbox")]) {
        expect(control).toBeDisabled();
      }
    }
    expect(screen.getAllByTestId("done-button")[0]).toBeEnabled();
    rerender(<ExerciseSetTable {...props} pendingPairSetKeys={[]} exerciseSets={[
      existing, { ...left, id: 11 }, { ...right, id: 12 },
    ]} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
    for (const button of screen.getAllByTestId("done-button")) expect(button).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open options for set 2" })).toBeEnabled();
  });
});
