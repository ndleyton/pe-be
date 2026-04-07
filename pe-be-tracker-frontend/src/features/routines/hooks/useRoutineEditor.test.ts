import { describe, expect, it } from "vitest";

import { act, renderHook, waitFor } from "@/test/testUtils";
import {
  makeRoutine,
  makeRoutineExerciseTemplate,
  makeRoutineSetTemplate,
} from "@/test/fixtures";
import { useRoutineEditor } from "./useRoutineEditor";
import type { RoutineIntensityUnitOption } from "@/features/routines/lib/routineEditor";

const availableIntensityUnits: RoutineIntensityUnitOption[] = [
  {
    id: 1,
    name: "Kilograms",
    abbreviation: "kg",
  },
  {
    id: 2,
    name: "Pounds",
    abbreviation: "lb",
  },
];

const routine = makeRoutine({
  name: "Upper Body",
  description: "Bench and accessories",
  workout_type_id: 10,
  creator_id: 20,
  exercise_templates: [
    makeRoutineExerciseTemplate({
      id: 101,
      exercise_type_id: 301,
      exercise_type: {
        id: 301,
        name: "Bench Press",
        description: "Chest press",
        default_intensity_unit: 1,
        times_used: 4,
      },
      set_templates: [
        makeRoutineSetTemplate({
          id: 201,
          reps: 8,
          intensity: 100,
          intensity_unit_id: 1,
          intensity_unit: {
            id: 1,
            name: "Kilograms",
            abbreviation: "kg",
          },
        }),
      ],
    }),
  ],
});

describe("useRoutineEditor", () => {
  it("adds a new set to an existing template", async () => {
    const { result } = renderHook(() =>
      useRoutineEditor({
        availableIntensityUnits,
        routine,
      }),
    );

    await waitFor(() => {
      expect(result.current.editorTemplates).toHaveLength(1);
    });

    act(() => {
      result.current.addSetToTemplate("101");
    });

    expect(result.current.editorTemplates[0].set_templates).toHaveLength(2);
    expect(
      result.current.editorTemplates[0].set_templates[1].intensity_unit_id,
    ).toBe(1);
  });

  it("flags templates with missing intensity units as invalid", async () => {
    const { result } = renderHook(() =>
      useRoutineEditor({
        availableIntensityUnits,
        routine,
      }),
    );

    await waitFor(() => {
      expect(result.current.hasInvalidTemplates).toBe(false);
    });

    act(() => {
      result.current.updateSet("101", "201", {
        intensity_unit_id: 0,
        intensity_unit: null,
      });
    });

    expect(result.current.hasInvalidTemplates).toBe(true);
  });

  it("marks the editor dirty as soon as description changes", async () => {
    const { result } = renderHook(() =>
      useRoutineEditor({
        availableIntensityUnits,
        routine,
      }),
    );

    await waitFor(() => {
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    act(() => {
      result.current.setDescription("Updated description");
    });

    expect(result.current.description).toBe("Updated description");
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it("updates template notes and marks editor as dirty", async () => {
    const { result } = renderHook(() =>
      useRoutineEditor({
        availableIntensityUnits,
        routine,
      }),
    );

    await waitFor(() => {
      expect(result.current.editorTemplates[0].notes).toBe("");
    });

    act(() => {
      result.current.updateTemplate("101", { notes: "Keep core tight" });
    });

    expect(result.current.editorTemplates[0].notes).toBe("Keep core tight");
    expect(result.current.hasUnsavedChanges).toBe(true);
  });
});
