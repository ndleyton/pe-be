import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  Exercise,
  ExerciseSet,
  IntensityUnit,
} from "@/features/exercises/api";
import {
  DEFAULT_INTENSITY_UNIT,
  buildDurationInputs,
  buildIntensityInputs,
  buildRepsInputs,
  getExerciseSetClientKey,
} from "@/features/exercises/lib/exerciseRow";
import {
  resolveExerciseDisplayIntensityUnit,
  type GuestIntensityUnit,
} from "@/features/exercises/lib/intensityUnits";
import {
  GUEST_INTENSITY_UNITS,
  KNOWN_INTENSITY_UNITS,
} from "@/features/exercises/constants";
import { useDebounce } from "@/shared/hooks";
import { useAuthStore } from "@/stores";

export const useExerciseRowState = ({
  exercise,
  exerciseSets,
  updateSetOptions,
}: {
  exercise: Exercise;
  exerciseSets: ExerciseSet[];
  updateSetOptions: (
    setId: string | number,
    updates: { notes?: string; rpe?: number | null; rir?: number | null },
  ) => Promise<void>;
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const availableIntensityUnits = isAuthenticated
    ? KNOWN_INTENSITY_UNITS
    : GUEST_INTENSITY_UNITS;
  const initialIntensityUnit = resolveExerciseDisplayIntensityUnit(
    exercise,
    availableIntensityUnits,
    DEFAULT_INTENSITY_UNIT,
  );
  const [currentIntensityUnit, setCurrentIntensityUnit] = useState<
    IntensityUnit | GuestIntensityUnit
  >(initialIntensityUnit);

  // Option K: Track active string drafts only while editing; otherwise derive directly from numeric model
  const [draftInputs, setDraftInputs] = useState<
    Record<string, { reps?: string; intensity?: string; duration?: string }>
  >({});

  const intensityInputs = useMemo(() => {
    const base = buildIntensityInputs(exerciseSets, currentIntensityUnit.id);
    const result: Record<string, string> = { ...base };
    Object.entries(draftInputs).forEach(([key, drafts]) => {
      if (drafts.intensity !== undefined) {
        result[key] = drafts.intensity;
      }
    });
    return result;
  }, [currentIntensityUnit.id, draftInputs, exerciseSets]);

  const repsInputs = useMemo(() => {
    const base = buildRepsInputs(exerciseSets);
    const result: Record<string, string> = { ...base };
    Object.entries(draftInputs).forEach(([key, drafts]) => {
      if (drafts.reps !== undefined) {
        result[key] = drafts.reps;
      }
    });
    return result;
  }, [draftInputs, exerciseSets]);

  const durationInputs = useMemo(() => {
    const base = buildDurationInputs(exerciseSets);
    const result: Record<string, string> = { ...base };
    Object.entries(draftInputs).forEach(([key, drafts]) => {
      if (drafts.duration !== undefined) {
        result[key] = drafts.duration;
      }
    });
    return result;
  }, [draftInputs, exerciseSets]);

  const [exerciseNotesValue, setExerciseNotesValue] = useState(exercise.notes || "");
  const [activeSetId, setActiveSetId] = useState<string | number | null>(null);
  const [setNotesValue, setSetNotesValue] = useState("");
  const [setRpeValue, setSetRpeValue] = useState<number | null>(null);
  const [setRirValue, setSetRirValue] = useState<number | null>(null);
  const [exerciseSettingsOpen, setExerciseSettingsOpen] = useState(false);

  const debouncedSetNotesValue = useDebounce(setNotesValue, 1000);
  const debouncedSetRpeValue = useDebounce(setRpeValue, 1000);
  const debouncedSetRirValue = useDebounce(setRirValue, 1000);

  useEffect(() => {
    setExerciseNotesValue(exercise.notes || "");
  }, [exercise.notes]);

  useEffect(() => {
    if (
      activeSetId === null ||
      debouncedSetNotesValue !== setNotesValue ||
      debouncedSetRpeValue !== setRpeValue ||
      debouncedSetRirValue !== setRirValue
    ) {
      return;
    }

    const currentSet = exerciseSets.find(
      (set) => getExerciseSetClientKey(set) === String(activeSetId),
    );

    if (!currentSet) {
      return;
    }

    const nextNotes = debouncedSetNotesValue;
    const nextRpe = debouncedSetRpeValue;
    const nextRir = debouncedSetRirValue;
    const currentNotes = currentSet.notes || "";
    const currentRpe = currentSet.rpe ?? null;
    const currentRir = currentSet.rir ?? null;

    if (
      nextNotes === currentNotes &&
      nextRpe === currentRpe &&
      nextRir === currentRir
    ) {
      return;
    }

    void updateSetOptions(activeSetId, { notes: nextNotes, rpe: nextRpe, rir: nextRir });
  }, [
    activeSetId,
    debouncedSetNotesValue,
    debouncedSetRpeValue,
    debouncedSetRirValue,
    exerciseSets,
    setNotesValue,
    setRpeValue,
    setRirValue,
    updateSetOptions,
  ]);


  const closeSetOptions = useCallback(() => {
    setActiveSetId(null);
    setSetNotesValue("");
    setSetRpeValue(null);
    setSetRirValue(null);
  }, []);

  const openSetOptions = useCallback((
    setId: string | number,
    initialNotes: string,
    initialRpe: number | null | undefined,
    initialRir: number | null | undefined,
  ) => {
    setActiveSetId(setId);
    setSetNotesValue(initialNotes);
    setSetRpeValue(initialRpe ?? null);
    setSetRirValue(initialRir ?? null);
  }, []);

  const handleSetOptionsOpenChange = useCallback((open: boolean) => {
    if (!open) {
      closeSetOptions();
    }
  }, [closeSetOptions]);

  const handleIntensityUnitChange = useCallback((
    unit: IntensityUnit | GuestIntensityUnit,
  ) => {
    setCurrentIntensityUnit(unit);
    setExerciseSettingsOpen(false);
    setDraftInputs((current) => {
      const next: Record<string, { reps?: string; intensity?: string; duration?: string }> = {};
      let changed = false;
      Object.entries(current).forEach(([key, drafts]) => {
        if (drafts.intensity !== undefined) {
          changed = true;
          const { intensity: _, ...rest } = drafts;
          if (Object.keys(rest).length > 0) {
            next[key] = rest;
          }
        } else {
          next[key] = drafts;
        }
      });
      return changed ? next : current;
    });
  }, []);

  const setDurationInputValue = useCallback((setId: string | number, value: string) => {
    setDraftInputs((current) => ({
      ...current,
      [String(setId)]: {
        ...current[String(setId)],
        duration: value,
      },
    }));
  }, []);

  const setIntensityInputValue = useCallback((setId: string | number, value: string) => {
    setDraftInputs((current) => ({
      ...current,
      [String(setId)]: {
        ...current[String(setId)],
        intensity: value,
      },
    }));
  }, []);

  const setRepsInputValue = useCallback((setId: string | number, value: string) => {
    setDraftInputs((current) => ({
      ...current,
      [String(setId)]: {
        ...current[String(setId)],
        reps: value,
      },
    }));
  }, []);

  const clearDraftInput = useCallback((setId: string | number, field?: "reps" | "intensity" | "duration") => {
    const key = String(setId);
    setDraftInputs((current) => {
      if (!current[key]) return current;
      if (!field) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      const nextSetDraft = { ...current[key] };
      delete nextSetDraft[field];
      if (Object.keys(nextSetDraft).length === 0) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return {
        ...current,
        [key]: nextSetDraft,
      };
    });
  }, []);

  return {
    activeSetId,
    clearDraftInput,
    currentIntensityUnit,
    durationInputs,
    exerciseNotesValue,
    exerciseSettingsOpen,
    handleIntensityUnitChange,
    handleSetOptionsOpenChange,
    intensityInputs,
    openSetOptions,
    repsInputs,
    setDurationInputValue,
    setExerciseNotesValue,
    setExerciseSettingsOpen,
    setIntensityInputValue,
    setNotesValue,
    setRpeValue,
    setRirValue,
    setRepsInputValue,
    setSetRpeValue,
    setSetRirValue,
    setSetNotesValue,
    closeSetOptions,
  };
};
