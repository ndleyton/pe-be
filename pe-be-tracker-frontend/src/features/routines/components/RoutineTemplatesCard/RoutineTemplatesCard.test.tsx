import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";

import {
  makeRoutineExerciseTemplate,
} from "@/test/fixtures";
import { render } from "@/test/testUtils";
import type {
  RoutineEditorSet,
  RoutineEditorTemplate,
} from "@/features/routines/lib/routineEditor";
import { RoutineTemplatesCard } from "./RoutineTemplatesCard";

const noop = () => undefined;

describe("RoutineTemplatesCard", () => {
  it("shows a Time input for speed-based sets using MM:SS", async () => {
    const onUpdateSet = vi.fn();
    const speedSet: RoutineEditorSet = {
      id: "set-1",
      reps: null,
      duration_seconds: 605,
      intensity: 10,
      rpe: null,
      intensity_unit_id: 3,
      intensity_unit: {
        id: 3,
        name: "Kilometers per hour",
        abbreviation: "km/h",
      },
    };
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
      set_templates: [speedSet],
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

  it("shows reps for non-speed sets", () => {
    const repSet: RoutineEditorSet = {
      id: "set-1",
      reps: 8,
      duration_seconds: null,
      intensity: 50,
      rpe: null,
      intensity_unit_id: 1,
      intensity_unit: {
        id: 1,
        name: "Kilograms",
        abbreviation: "kg",
      },
    };
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
      set_templates: [repSet],
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
