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
  type GuestIntensityUnit,
} from "@/features/exercises/lib/exerciseRow";
import { useDebounce } from "@/shared/hooks";

export const useExerciseRowState = ({
  exercise,
  exerciseSets,
  updateSetNotes,
}: {
  exercise: Exercise;
  exerciseSets: ExerciseSet[];
  updateSetNotes: (setId: string | number, notes: string) => Promise<void>;
}) => {
  const [intensityInputs, setIntensityInputs] = useState<Record<string, string>>(
    () => buildIntensityInputs(exercise.exercise_sets || []),
  );
  const [repsInputs, setRepsInputs] = useState<Record<string, string>>(() =>
    buildRepsInputs(exercise.exercise_sets || []),
  );
  const [exerciseNotesOpen, setExerciseNotesOpen] = useState(false);
  const [exerciseNotesValue, setExerciseNotesValue] = useState("");
  const [activeSetId, setActiveSetId] = useState<string | number | null>(null);
  const [setNotesValue, setSetNotesValue] = useState("");
  const [initialSetNotesValue, setInitialSetNotesValue] = useState("");
  const [exerciseSettingsOpen, setExerciseSettingsOpen] = useState(false);
  const [currentIntensityUnit, setCurrentIntensityUnit] = useState<
    IntensityUnit | GuestIntensityUnit
  >(DEFAULT_INTENSITY_UNIT);

  const debouncedSetNotesValue = useDebounce(setNotesValue, 1000);

  useEffect(() => {
    setIntensityInputs(buildIntensityInputs(exerciseSets));
    setRepsInputs(buildRepsInputs(exerciseSets));
  }, [exerciseSets]);

  useEffect(() => {
    if (activeSetId === null || debouncedSetNotesValue === initialSetNotesValue) {
      return;
    }

    const currentSet = exerciseSets.find(
      (set) => String(set.id) === String(activeSetId),
    );

    if (!currentSet || debouncedSetNotesValue === (currentSet.notes || "")) {
      return;
    }

    void updateSetNotes(activeSetId, debouncedSetNotesValue);
  }, [
    activeSetId,
    debouncedSetNotesValue,
    exerciseSets,
    initialSetNotesValue,
    updateSetNotes,
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
    setInitialSetNotesValue("");
  };

  const openSetOptions = (setId: string | number, initialNotes: string) => {
    setActiveSetId(setId);
    setSetNotesValue(initialNotes);
    setInitialSetNotesValue(initialNotes);
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
    setRepsInputValue: (setId: string | number, value: string) =>
      setRepsInputs((current) => ({
        ...current,
        [String(setId)]: value,
      })),
    setSetNotesValue,
    closeSetOptions,
  };
};
