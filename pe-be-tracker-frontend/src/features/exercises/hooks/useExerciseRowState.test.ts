import { act, renderHook } from "@/test/testUtils";
import { makeExercise, makeExerciseSet, makeExerciseType } from "@/test/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    isAuthenticated: true,
  },
}));

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
}));

import { useExerciseRowState } from "./useExerciseRowState";

describe("useExerciseRowState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens and resets exercise notes state", () => {
    const exercise = makeExercise({
      notes: "Focus on tempo",
      exercise_sets: [makeExerciseSet({ id: 1, exercise_id: 1 })],
    });
    const updateSetOptions = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useExerciseRowState({
        exercise,
        exerciseSets: exercise.exercise_sets,
        updateSetOptions,
      }),
    );

    act(() => {
      result.current.openExerciseNotes();
    });

    expect(result.current.exerciseNotesOpen).toBe(true);
    expect(result.current.exerciseNotesValue).toBe("Focus on tempo");

    act(() => {
      result.current.handleExerciseNotesOpenChange(false);
    });

    expect(result.current.exerciseNotesOpen).toBe(false);
    expect(result.current.exerciseNotesValue).toBe("");
  });

  it("debounces set note persistence for the active set", async () => {
    const exerciseSets = [
      makeExerciseSet({
        id: 1,
        exercise_id: 1,
        notes: "Original note",
      }),
    ];
    const exercise = makeExercise({
      exercise_sets: exerciseSets,
    });
    const updateSetOptions = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useExerciseRowState({
        exercise,
        exerciseSets,
        updateSetOptions,
      }),
    );

    act(() => {
      result.current.openSetOptions(1, "Original note", null);
      result.current.setSetNotesValue("Updated note");
    });

    expect(updateSetOptions).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(updateSetOptions).toHaveBeenCalledWith(1, {
      notes: "Updated note",
      rpe: null,
    });
  });

  it("keeps effort null until the slider is moved", async () => {
    const exerciseSets = [
      makeExerciseSet({
        id: 1,
        exercise_id: 1,
        notes: "Original note",
        rpe: null,
      }),
    ];
    const exercise = makeExercise({
      exercise_sets: exerciseSets,
    });
    const updateSetOptions = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useExerciseRowState({
        exercise,
        exerciseSets,
        updateSetOptions,
      }),
    );

    act(() => {
      result.current.openSetOptions(1, "Original note", null);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.setRpeValue).toBeNull();
    expect(updateSetOptions).not.toHaveBeenCalled();
  });

  it("debounces effort persistence when the slider value changes", async () => {
    const exerciseSets = [
      makeExerciseSet({
        id: 1,
        exercise_id: 1,
        notes: "Original note",
        rpe: null,
      }),
    ];
    const exercise = makeExercise({
      exercise_sets: exerciseSets,
    });
    const updateSetOptions = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useExerciseRowState({
        exercise,
        exerciseSets,
        updateSetOptions,
      }),
    );

    act(() => {
      result.current.openSetOptions(1, "Original note", null);
      result.current.setSetRpeValue(8.5);
    });

    expect(updateSetOptions).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(updateSetOptions).toHaveBeenCalledWith(1, {
      notes: "Original note",
      rpe: 8.5,
    });
  });

  it("syncs input buffers from exercise sets and closes settings on unit change", () => {
    const initialSets = [
      makeExerciseSet({
        id: 1,
        exercise_id: 1,
        reps: 10,
        intensity: 50,
        intensity_unit_id: 1,
      }),
    ];
    const nextSets = [
      makeExerciseSet({
        id: 1,
        exercise_id: 1,
        reps: 12,
        intensity: 55.5,
        intensity_unit_id: 1,
      }),
    ];
    const exercise = makeExercise({
      exercise_type: makeExerciseType({ default_intensity_unit: 2 }),
      exercise_sets: initialSets,
    });
    const updateSetOptions = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ sets }) =>
        useExerciseRowState({
          exercise,
          exerciseSets: sets,
          updateSetOptions,
        }),
      {
        initialProps: {
          sets: initialSets,
        },
      },
    );

    expect(result.current.currentIntensityUnit.abbreviation).toBe("kg");
    expect(result.current.intensityInputs["1"]).toBe("50");

    act(() => {
      result.current.setExerciseSettingsOpen(true);
      result.current.handleIntensityUnitChange({
        id: 2,
        name: "Pounds",
        abbreviation: "lbs",
      });
    });

    expect(result.current.exerciseSettingsOpen).toBe(false);
    expect(result.current.currentIntensityUnit.abbreviation).toBe("lbs");

    rerender({ sets: nextSets });

    expect(result.current.intensityInputs["1"]).toBe("122.36");
    expect(result.current.repsInputs["1"]).toBe("12");
  });
});
