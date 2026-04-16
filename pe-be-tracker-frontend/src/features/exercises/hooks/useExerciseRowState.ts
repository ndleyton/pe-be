import { useCallback, useEffect, useState } from "react";

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
  const [intensityInputs, setIntensityInputs] = useState<Record<string, string>>(
    () => buildIntensityInputs(exercise.exercise_sets || [], initialIntensityUnit.id),
  );
  const [repsInputs, setRepsInputs] = useState<Record<string, string>>(() =>
    buildRepsInputs(exercise.exercise_sets || []),
  );
  const [durationInputs, setDurationInputs] = useState<Record<string, string>>(
    () => buildDurationInputs(exercise.exercise_sets || []),
  );
  const [exerciseNotesOpen, setExerciseNotesOpen] = useState(false);
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
    setIntensityInputs(buildIntensityInputs(exerciseSets, currentIntensityUnit.id));
    setRepsInputs(buildRepsInputs(exerciseSets));
    setDurationInputs(buildDurationInputs(exerciseSets));
  }, [currentIntensityUnit.id, exerciseSets]);

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
      (set) => String(set.id) === String(activeSetId),
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

  const handleExerciseNotesOpenChange = (open: boolean) => {
    setExerciseNotesOpen(open);
  };

  const openExerciseNotes = () => {
    setExerciseNotesValue(exercise.notes || "");
    setExerciseNotesOpen(true);
  };

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
  }, []);

  const setDurationInputValue = useCallback((setId: string | number, value: string) =>
    setDurationInputs((current) => ({
      ...current,
      [String(setId)]: value,
    })), []);

  const setIntensityInputValue = useCallback((setId: string | number, value: string) =>
    setIntensityInputs((current) => ({
      ...current,
      [String(setId)]: value,
    })), []);

  const setRepsInputValue = useCallback((setId: string | number, value: string) =>
    setRepsInputs((current) => ({
      ...current,
      [String(setId)]: value,
    })), []);

  return {
    activeSetId,
    currentIntensityUnit,
    durationInputs,
    exerciseNotesOpen,
    exerciseNotesValue,
    exerciseSettingsOpen,
    handleExerciseNotesOpenChange,
    handleIntensityUnitChange,
    handleSetOptionsOpenChange,
    intensityInputs,
    openExerciseNotes,
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
