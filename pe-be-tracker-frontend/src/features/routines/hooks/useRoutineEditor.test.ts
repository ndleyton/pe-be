import { describe, expect, it } from "vitest";

import { act, renderHook, waitFor } from "@/test/testUtils";
import {
  makeRoutine,
  makeRoutineExerciseTemplate,
  makeRoutineSetTemplate,
} from "@/test/fixtures";
import { buildRoutinePayload } from "@/features/routines/lib/routineEditor";
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
  {
    id: 3,
    name: "Kilometers per hour",
    abbreviation: "km/h",
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

  it("defaults new sets to duration for speed-based exercise types", async () => {
    const speedRoutine = makeRoutine({
      exercise_templates: [
        makeRoutineExerciseTemplate({
          id: 101,
          exercise_type_id: 401,
          exercise_type: {
            id: 401,
            name: "Treadmill",
            description: "Steady state cardio",
            default_intensity_unit: 3,
            times_used: 2,
          },
          set_templates: [
            makeRoutineSetTemplate({
              id: 201,
              reps: null,
              duration_seconds: 1200,
              intensity: 10,
              intensity_unit_id: 3,
              intensity_unit: {
                id: 3,
                name: "Kilometers per hour",
                abbreviation: "km/h",
              },
            }),
          ],
        }),
      ],
    });

    const { result } = renderHook(() =>
      useRoutineEditor({
        availableIntensityUnits,
        routine: speedRoutine,
      }),
    );

    await waitFor(() => {
      expect(result.current.editorTemplates).toHaveLength(1);
    });

    act(() => {
      result.current.addSetToTemplate("101");
    });

    expect(result.current.editorTemplates[0].set_templates[1].duration_seconds).toBe(
      600,
    );
  });

  it("does not auto-fill duration when switching a blank set to a speed unit", async () => {
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
      result.current.updateSet("101", "201", {
        reps: null,
        duration_seconds: null,
      });
    });

    act(() => {
      result.current.openUnitPicker({ templateId: "101", setId: "201" });
      result.current.handleIntensityUnitSelected({
        id: 3,
        name: "Kilometers per hour",
        abbreviation: "km/h",
      });
    });

    expect(result.current.editorTemplates[0].set_templates[0].duration_seconds).toBe(
      null,
    );
    expect(result.current.editorTemplates[0].set_templates[0].intensity_unit_id).toBe(
      3,
    );
  });

  it("omits null duration_seconds and null rpe from routine update payloads", () => {
    const payload = buildRoutinePayload([
      {
        id: "101",
        exercise_type_id: 301,
        exercise_type: null,
        notes: "",
        set_templates: [
          {
            id: "201",
            reps: 12,
            duration_seconds: null,
            intensity: null,
            rpe: null,
            rir: null,
            notes: "",
            type: null,
            intensity_unit_id: 1,
            intensity_unit: null,
          },
        ],
      },
    ]);

    expect(payload).toEqual([
      {
        exercise_type_id: 301,
        notes: null,
        set_templates: [
          {
            reps: 12,
            intensity: null,
            intensity_unit_id: 1,
          },
        ],
      },
    ]);
  });
});
