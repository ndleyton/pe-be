import { useEffect, useState } from "react";

import type {
  Exercise,
  ExerciseSet,
  IntensityUnit,
} from "@/features/exercises/api";
import {
  DEFAULT_INTENSITY_UNIT,
  buildIntensityInputs,
  buildRepsInputs,
  formatIntensityInputValue,
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
import { parseDecimalInput } from "@/utils/format";

const normalizeRpeValue = (value: string): number | null => {
  const parsed = parseDecimalInput(value);
  if (parsed === null || parsed < 0 || parsed > 10) {
    return null;
  }

  return Math.round(parsed * 2) / 2;
};

export const useExerciseRowState = ({
  exercise,
  exerciseSets,
  updateSetOptions,
}: {
  exercise: Exercise;
  exerciseSets: ExerciseSet[];
  updateSetOptions: (
    setId: string | number,
    updates: { notes?: string; rpe?: number | null },
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
  const [exerciseNotesOpen, setExerciseNotesOpen] = useState(false);
  const [exerciseNotesValue, setExerciseNotesValue] = useState("");
  const [activeSetId, setActiveSetId] = useState<string | number | null>(null);
  const [setNotesValue, setSetNotesValue] = useState("");
  const [setRpeValue, setSetRpeValue] = useState("");
  const [exerciseSettingsOpen, setExerciseSettingsOpen] = useState(false);

  const debouncedSetNotesValue = useDebounce(setNotesValue, 1000);
  const debouncedSetRpeValue = useDebounce(setRpeValue, 1000);

  useEffect(() => {
    setIntensityInputs(buildIntensityInputs(exerciseSets, currentIntensityUnit.id));
    setRepsInputs(buildRepsInputs(exerciseSets));
  }, [currentIntensityUnit.id, exerciseSets]);

  useEffect(() => {
    if (
      activeSetId === null ||
      debouncedSetNotesValue !== setNotesValue ||
      debouncedSetRpeValue !== setRpeValue
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
    const nextRpe = normalizeRpeValue(debouncedSetRpeValue);
    const currentNotes = currentSet.notes || "";
    const currentRpe = currentSet.rpe ?? null;

    if (
      nextNotes === currentNotes &&
      nextRpe === currentRpe
    ) {
      return;
    }

    void updateSetOptions(activeSetId, { notes: nextNotes, rpe: nextRpe });
  }, [
    activeSetId,
    debouncedSetNotesValue,
    debouncedSetRpeValue,
    exerciseSets,
    setNotesValue,
    setRpeValue,
    updateSetOptions,
  ]);

  const handleExerciseNotesOpenChange = (open: boolean) => {
    setExerciseNotesOpen(open);
    if (!open) {
      setExerciseNotesValue("");
    }
  };

  const openExerciseNotes = () => {
    setExerciseNotesValue(exercise.notes || "");
    setExerciseNotesOpen(true);
  };

  const closeSetOptions = () => {
    setActiveSetId(null);
    setSetNotesValue("");
    setSetRpeValue("");
  };

  const openSetOptions = (
    setId: string | number,
    initialNotes: string,
    initialRpe: number | null | undefined,
  ) => {
    setActiveSetId(setId);
    setSetNotesValue(initialNotes);
    setSetRpeValue(formatIntensityInputValue(initialRpe ?? null));
  };

  const handleSetOptionsOpenChange = (open: boolean) => {
    if (!open) {
      closeSetOptions();
    }
  };

  const handleIntensityUnitChange = (
    unit: IntensityUnit | GuestIntensityUnit,
  ) => {
    setCurrentIntensityUnit(unit);
    setExerciseSettingsOpen(false);
  };

  return {
    activeSetId,
    currentIntensityUnit,
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
    setExerciseNotesValue,
    setExerciseSettingsOpen,
    setIntensityInputValue: (setId: string | number, value: string) =>
      setIntensityInputs((current) => ({
        ...current,
        [String(setId)]: value,
        })),
    setNotesValue,
    setRpeValue,
    setRepsInputValue: (setId: string | number, value: string) =>
      setRepsInputs((current) => ({
        ...current,
        [String(setId)]: value,
      })),
    setSetRpeValue,
    setSetNotesValue,
    closeSetOptions,
  };
};
