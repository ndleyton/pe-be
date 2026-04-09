import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";

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

describe("RoutineTemplatesCard", () => {
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
});
