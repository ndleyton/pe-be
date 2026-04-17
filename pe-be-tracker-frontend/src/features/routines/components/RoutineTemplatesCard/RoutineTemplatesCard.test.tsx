import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";

import {
  makeRoutineExerciseTemplate,
  repSet,
  speedSet,
} from "@/test/fixtures";
import { render } from "@/test/testUtils";
import type {
  RoutineEditorTemplate,
} from "@/features/routines/lib/routineEditor";
import { RoutineTemplatesCard } from "./RoutineTemplatesCard";

const noop = () => undefined;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("RoutineTemplatesCard", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a Time input for speed-based sets using MM:SS", async () => {
    const onUpdateSet = vi.fn();
    const baseTemplate = makeRoutineExerciseTemplate();
    const speedTemplate: RoutineEditorTemplate = {
      id: "template-1",
      exercise_type_id: baseTemplate.exercise_type_id,
      exercise_type: {
        id: baseTemplate.exercise_type?.id ?? 1,
        name: baseTemplate.exercise_type?.name ?? "Exercise",
        description: baseTemplate.exercise_type?.description ?? null,
        default_intensity_unit:
          baseTemplate.exercise_type?.default_intensity_unit ?? 1,
        times_used: baseTemplate.exercise_type?.times_used ?? 0,
      },
      notes: baseTemplate.notes ?? "",
      set_templates: [{ ...speedSet, intensity_unit: { ...speedSet.intensity_unit! } }],
    };

    render(
      <RoutineTemplatesCard
        canEdit
        editorTemplates={[speedTemplate]}
        onAddExercise={noop}
        onAddSet={noop}
        onChangeExercise={noop}
        onRemoveSet={noop}
        onRemoveTemplate={noop}
        onSelectUnit={noop}
        onUpdateSet={onUpdateSet}
        onUpdateTemplate={noop}
      />,
    );

    expect(screen.getByLabelText("Time")).toHaveValue("10:05");

    const input = screen.getByLabelText("Time");
    fireEvent.change(input, { target: { value: "12:34" } });

    expect(onUpdateSet).toHaveBeenLastCalledWith("template-1", "set-1", {
      reps: null,
      duration_seconds: 754,
    });
  });

  it("preserves partial MM:SS drafts without snapping back", () => {
    const onUpdateSet = vi.fn();
    const baseTemplate = makeRoutineExerciseTemplate();
    const speedTemplate: RoutineEditorTemplate = {
      id: "template-1",
      exercise_type_id: baseTemplate.exercise_type_id,
      exercise_type: {
        id: baseTemplate.exercise_type?.id ?? 1,
        name: baseTemplate.exercise_type?.name ?? "Exercise",
        description: baseTemplate.exercise_type?.description ?? null,
        default_intensity_unit:
          baseTemplate.exercise_type?.default_intensity_unit ?? 1,
        times_used: baseTemplate.exercise_type?.times_used ?? 0,
      },
      notes: baseTemplate.notes ?? "",
      set_templates: [{ ...speedSet, intensity_unit: { ...speedSet.intensity_unit! } }],
    };

    render(
      <RoutineTemplatesCard
        canEdit
        editorTemplates={[speedTemplate]}
        onAddExercise={noop}
        onAddSet={noop}
        onChangeExercise={noop}
        onRemoveSet={noop}
        onRemoveTemplate={noop}
        onSelectUnit={noop}
        onUpdateSet={onUpdateSet}
        onUpdateTemplate={noop}
      />,
    );

    const input = screen.getByLabelText("Time");
    fireEvent.change(input, { target: { value: "10:" } });

    expect(input).toHaveValue("10:");
    expect(onUpdateSet).not.toHaveBeenCalled();
  });

  it("accepts shorthand time input and normalizes it on blur", () => {
    const onUpdateSet = vi.fn();
    const baseTemplate = makeRoutineExerciseTemplate();
    const speedTemplate: RoutineEditorTemplate = {
      id: "template-1",
      exercise_type_id: baseTemplate.exercise_type_id,
      exercise_type: {
        id: baseTemplate.exercise_type?.id ?? 1,
        name: baseTemplate.exercise_type?.name ?? "Exercise",
        description: baseTemplate.exercise_type?.description ?? null,
        default_intensity_unit:
          baseTemplate.exercise_type?.default_intensity_unit ?? 1,
        times_used: baseTemplate.exercise_type?.times_used ?? 0,
      },
      notes: baseTemplate.notes ?? "",
      set_templates: [{ ...speedSet, intensity_unit: { ...speedSet.intensity_unit! } }],
    };

    render(
      <RoutineTemplatesCard
        canEdit
        editorTemplates={[speedTemplate]}
        onAddExercise={noop}
        onAddSet={noop}
        onChangeExercise={noop}
        onRemoveSet={noop}
        onRemoveTemplate={noop}
        onSelectUnit={noop}
        onUpdateSet={onUpdateSet}
        onUpdateTemplate={noop}
      />,
    );

    const input = screen.getByLabelText("Time");
    fireEvent.change(input, { target: { value: "125" } });

    expect(input).toHaveValue("125");
    expect(onUpdateSet).not.toHaveBeenCalled();

    fireEvent.blur(input);

    expect(input).toHaveValue("01:25");
    expect(onUpdateSet).toHaveBeenLastCalledWith("template-1", "set-1", {
      reps: null,
      duration_seconds: 85,
    });
  });

  it("restores the saved time draft on escape", () => {
    const onUpdateSet = vi.fn();
    const baseTemplate = makeRoutineExerciseTemplate();
    const speedTemplate: RoutineEditorTemplate = {
      id: "template-1",
      exercise_type_id: baseTemplate.exercise_type_id,
      exercise_type: {
        id: baseTemplate.exercise_type?.id ?? 1,
        name: baseTemplate.exercise_type?.name ?? "Exercise",
        description: baseTemplate.exercise_type?.description ?? null,
        default_intensity_unit:
          baseTemplate.exercise_type?.default_intensity_unit ?? 1,
        times_used: baseTemplate.exercise_type?.times_used ?? 0,
      },
      notes: baseTemplate.notes ?? "",
      set_templates: [{ ...speedSet, intensity_unit: { ...speedSet.intensity_unit! } }],
    };

    render(
      <RoutineTemplatesCard
        canEdit
        editorTemplates={[speedTemplate]}
        onAddExercise={noop}
        onAddSet={noop}
        onChangeExercise={noop}
        onRemoveSet={noop}
        onRemoveTemplate={noop}
        onSelectUnit={noop}
        onUpdateSet={onUpdateSet}
        onUpdateTemplate={noop}
      />,
    );

    const input = screen.getByLabelText("Time");
    fireEvent.change(input, { target: { value: "123" } });

    expect(input).toHaveValue("123");

    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).toHaveValue("10:05");
    expect(onUpdateSet).not.toHaveBeenCalled();
  });

  it("shows reps for non-speed sets", () => {
    const baseTemplate = makeRoutineExerciseTemplate();
    const repTemplate: RoutineEditorTemplate = {
      id: "template-1",
      exercise_type_id: baseTemplate.exercise_type_id,
      exercise_type: {
        id: baseTemplate.exercise_type?.id ?? 1,
        name: baseTemplate.exercise_type?.name ?? "Exercise",
        description: baseTemplate.exercise_type?.description ?? null,
        default_intensity_unit:
          baseTemplate.exercise_type?.default_intensity_unit ?? 1,
        times_used: baseTemplate.exercise_type?.times_used ?? 0,
      },
      notes: baseTemplate.notes ?? "",
      set_templates: [{ ...repSet, intensity_unit: { ...repSet.intensity_unit! } }],
    };

    render(
      <RoutineTemplatesCard
        canEdit
        editorTemplates={[repTemplate]}
        onAddExercise={noop}
        onAddSet={noop}
        onChangeExercise={noop}
        onRemoveSet={noop}
        onRemoveTemplate={noop}
        onSelectUnit={noop}
        onUpdateSet={vi.fn()}
        onUpdateTemplate={noop}
      />,
    );

    expect(screen.getByLabelText("Reps")).toHaveValue(8);
    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument();
  });

  it("uses icon-only remove controls in editor mode", () => {
    const baseTemplate = makeRoutineExerciseTemplate();
    const repTemplate: RoutineEditorTemplate = {
      id: "template-1",
      exercise_type_id: baseTemplate.exercise_type_id,
      exercise_type: {
        id: baseTemplate.exercise_type?.id ?? 1,
        name: baseTemplate.exercise_type?.name ?? "Exercise",
        description: baseTemplate.exercise_type?.description ?? null,
        default_intensity_unit:
          baseTemplate.exercise_type?.default_intensity_unit ?? 1,
        times_used: baseTemplate.exercise_type?.times_used ?? 0,
      },
      notes: baseTemplate.notes ?? "",
      set_templates: [{ ...repSet, intensity_unit: { ...repSet.intensity_unit! } }],
    };

    render(
      <RoutineTemplatesCard
        canEdit
        editorTemplates={[repTemplate]}
        onAddExercise={noop}
        onAddSet={noop}
        onChangeExercise={noop}
        onRemoveSet={noop}
        onRemoveTemplate={noop}
        onSelectUnit={noop}
        onUpdateSet={vi.fn()}
        onUpdateTemplate={noop}
      />,
    );

    const removeSetButton = screen.getByTestId("remove-routine-set-0-0");
    expect(removeSetButton).toHaveAccessibleName("Remove set 1");
    expect(removeSetButton).not.toHaveTextContent("Remove");
  });

  it("uses icon-only exercise template actions in editor mode", () => {
    const baseTemplate = makeRoutineExerciseTemplate();
    const repTemplate: RoutineEditorTemplate = {
      id: "template-1",
      exercise_type_id: baseTemplate.exercise_type_id,
      exercise_type: {
        id: baseTemplate.exercise_type?.id ?? 1,
        name: baseTemplate.exercise_type?.name ?? "Exercise",
        description: baseTemplate.exercise_type?.description ?? null,
        default_intensity_unit:
          baseTemplate.exercise_type?.default_intensity_unit ?? 1,
        times_used: baseTemplate.exercise_type?.times_used ?? 0,
      },
      notes: baseTemplate.notes ?? "",
      set_templates: [{ ...repSet, intensity_unit: { ...repSet.intensity_unit! } }],
    };

    render(
      <RoutineTemplatesCard
        canEdit
        editorTemplates={[repTemplate]}
        onAddExercise={noop}
        onAddSet={noop}
        onChangeExercise={noop}
        onRemoveSet={noop}
        onRemoveTemplate={noop}
        onSelectUnit={noop}
        onUpdateSet={vi.fn()}
        onUpdateTemplate={noop}
      />,
    );

    const changeButton = screen.getByTestId("change-routine-exercise-0");
    const removeButton = screen.getByTestId("remove-routine-template-0");

    expect(changeButton).toHaveAccessibleName("Change exercise 1");
    expect(changeButton).not.toHaveTextContent("Change");
    expect(removeButton).toHaveAccessibleName("Remove exercise 1");
    expect(removeButton).not.toHaveTextContent("Remove");
  });

  it("renders view-only sets in a stacked list", () => {
    const baseTemplate = makeRoutineExerciseTemplate();
    const repTemplate: RoutineEditorTemplate = {
      id: "template-1",
      exercise_type_id: baseTemplate.exercise_type_id,
      exercise_type: {
        id: baseTemplate.exercise_type?.id ?? 1,
        name: baseTemplate.exercise_type?.name ?? "Exercise",
        description: baseTemplate.exercise_type?.description ?? null,
        default_intensity_unit:
          baseTemplate.exercise_type?.default_intensity_unit ?? 1,
        times_used: baseTemplate.exercise_type?.times_used ?? 0,
      },
      notes: baseTemplate.notes ?? "",
      set_templates: [
        { ...repSet, id: "set-1", intensity_unit: { ...repSet.intensity_unit! } },
        {
          ...repSet,
          id: "set-2",
          reps: 10,
          intensity_unit: { ...repSet.intensity_unit! },
        },
      ],
    };

    const { container } = render(
      <RoutineTemplatesCard
        canEdit={false}
        editorTemplates={[repTemplate]}
        onAddExercise={noop}
        onAddSet={noop}
        onChangeExercise={noop}
        onRemoveSet={noop}
        onRemoveTemplate={noop}
        onSelectUnit={noop}
        onUpdateSet={vi.fn()}
        onUpdateTemplate={noop}
      />,
    );

    expect(screen.getByText(/8 reps/i)).toBeInTheDocument();
    expect(screen.getByText(/10 reps/i)).toBeInTheDocument();
    expect(container.querySelector(".mt-2.space-y-2")).not.toBeNull();
  });

  it("exposes RIR aria-valuetext for the inverted slider mapping", () => {
    const baseTemplate = makeRoutineExerciseTemplate();
    const repTemplate: RoutineEditorTemplate = {
      id: "template-1",
      exercise_type_id: baseTemplate.exercise_type_id,
      exercise_type: {
        id: baseTemplate.exercise_type?.id ?? 1,
        name: baseTemplate.exercise_type?.name ?? "Exercise",
        description: baseTemplate.exercise_type?.description ?? null,
        default_intensity_unit:
          baseTemplate.exercise_type?.default_intensity_unit ?? 1,
        times_used: baseTemplate.exercise_type?.times_used ?? 0,
      },
      notes: baseTemplate.notes ?? "",
      set_templates: [{ ...repSet, intensity_unit: { ...repSet.intensity_unit! } }],
    };

    render(
      <RoutineTemplatesCard
        canEdit
        editorTemplates={[repTemplate]}
        onAddExercise={noop}
        onAddSet={noop}
        onChangeExercise={noop}
        onRemoveSet={noop}
        onRemoveTemplate={noop}
        onSelectUnit={noop}
        onUpdateSet={vi.fn()}
        onUpdateTemplate={noop}
      />,
    );

    fireEvent.click(screen.getByLabelText("Edit set 1 details"));
    const dialog = screen.getByRole("dialog");
    const slider = within(dialog).getByRole("slider", { name: "RIR" });
    expect(slider).toHaveAttribute("aria-valuetext", "RIR not set");
  });
});
