import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  createExerciseSet,
  deleteExercise,
  deleteExerciseSet,
  updateExerciseSet,
  type CreateExerciseSetData,
  type ExerciseSet,
  type UpdateExerciseSetData,
} from "@/features/exercises/api";
import {
  sortExerciseSets,
  toGuestExerciseSets,
  type ExerciseRowProps,
} from "@/features/exercises/lib/exerciseRow";
import {
  convertIntensityValue,
  DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS,
  prefersDurationForIntensityUnit,
} from "@/features/exercises/lib/intensityUnits";
import { useAuthStore, useGuestStore } from "@/stores";

type SetField = "weight" | "reps";

export const useExerciseSetActions = ({
  exercise,
  onExerciseDelete,
  onExerciseUpdate,
  workoutId,
}: ExerciseRowProps) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestDeleteExercise = useGuestStore((state) => state.deleteExercise);
  const queryClient = useQueryClient();

  const isUnsavedExercise =
    isAuthenticated &&
    typeof exercise.id === "string" &&
    exercise.id.startsWith("optimistic-");

  const [exerciseSets, setExerciseSets] = useState<ExerciseSet[]>(
    sortExerciseSets(exercise.exercise_sets || []),
  );
  const exerciseSetsRef = useRef(exerciseSets);
  const latestExerciseRef = useRef(exercise);

  useEffect(() => {
    const normalizedExerciseSets = sortExerciseSets(exercise.exercise_sets || []);
    exerciseSetsRef.current = normalizedExerciseSets;
    setExerciseSets(normalizedExerciseSets);
  }, [exercise.exercise_sets]);

  useEffect(() => {
    latestExerciseRef.current = exercise;
  }, [exercise]);

  useEffect(() => {
    exerciseSetsRef.current = exerciseSets;
  }, [exerciseSets]);

  const pendingUpdatesRef = useRef<
    Record<
      string,
      {
        timeout: ReturnType<typeof setTimeout>;
        data: UpdateExerciseSetData;
      }
    >
  >({});

  const publishExerciseUpdate = (nextExerciseSets: ExerciseSet[]) => {
    if (!onExerciseUpdate) {
      return;
    }

    const updatedExercise = {
      ...latestExerciseRef.current,
      exercise_sets: isAuthenticated
        ? nextExerciseSets
        : toGuestExerciseSets(nextExerciseSets),
    };

    latestExerciseRef.current = updatedExercise;
    onExerciseUpdate(updatedExercise);
  };

  const invalidateExerciseQuery = () => {
    if (!workoutId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
  };

  useEffect(() => {
    return () => {
      Object.entries(pendingUpdatesRef.current).forEach(([setId, update]) => {
        clearTimeout(update.timeout);
        void updateExerciseSet(setId, update.data).catch((error) => {
          console.error("Failed to flush update on unmount:", error);
        });
      });
    };
  }, []);

  const applyLocalExerciseSets = (
    updater:
      | ExerciseSet[]
      | ((currentExerciseSets: ExerciseSet[]) => ExerciseSet[]),
  ) => {
    const nextExerciseSets = sortExerciseSets(
      typeof updater === "function"
        ? updater(exerciseSetsRef.current)
        : updater,
    );

    exerciseSetsRef.current = nextExerciseSets;
    setExerciseSets(nextExerciseSets);
    publishExerciseUpdate(nextExerciseSets);
    return nextExerciseSets;
  };

  const queueSetUpdate = (
    setId: string | number,
    data: UpdateExerciseSetData,
  ) => {
    const key = String(setId);

    if (pendingUpdatesRef.current[key]) {
      clearTimeout(pendingUpdatesRef.current[key].timeout);
      pendingUpdatesRef.current[key].data = {
        ...pendingUpdatesRef.current[key].data,
        ...data,
      };
    } else {
      pendingUpdatesRef.current[key] = {
        timeout: setTimeout(() => undefined, 0),
        data,
      };
    }

    pendingUpdatesRef.current[key].timeout = setTimeout(async () => {
      try {
        const finalData = pendingUpdatesRef.current[key].data;
        await updateExerciseSet(setId, finalData);
      } catch (error) {
        console.error("Failed to update exercise set:", error);
        invalidateExerciseQuery();
      } finally {
        delete pendingUpdatesRef.current[key];
      }
    }, 500);
  };

  const updateSetField = (
    setId: string | number,
    field: SetField,
    value: number | null,
    displayUnitId?: number,
  ) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => String(set.id) === String(setId),
    );
    if (!currentSet) {
      return;
    }

    const nextValue =
      field === "weight"
        ? convertIntensityValue(
            value,
            displayUnitId ?? currentSet.intensity_unit_id,
            currentSet.intensity_unit_id,
          )
        : value;
    applyLocalExerciseSets((currentExerciseSets) =>
      currentExerciseSets.map((set) =>
        String(set.id) === String(setId)
          ? {
              ...set,
              [field === "weight" ? "intensity" : "reps"]: nextValue,
            }
          : set,
      ),
    );

    if (!isAuthenticated) {
      return;
    }

    const updateData: UpdateExerciseSetData =
      field === "weight" ? { intensity: nextValue } : { reps: value };

    queueSetUpdate(setId, updateData);
  };

  const incrementReps = (setId: string | number) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => String(set.id) === String(setId),
    );
    const nextReps = (currentSet?.reps || 0) + 1;
    updateSetField(setId, "reps", nextReps);
  };

  const decrementReps = (setId: string | number) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => String(set.id) === String(setId),
    );
    const nextReps = Math.max((currentSet?.reps || 0) - 1, 0);
    updateSetField(setId, "reps", nextReps);
  };

  const toggleSetCompletion = async (setId: string | number) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => String(set.id) === String(setId),
    );
    if (!currentSet) {
      return;
    }

    applyLocalExerciseSets((currentExerciseSets) =>
      currentExerciseSets.map((set) =>
        String(set.id) === String(setId)
          ? {
              ...set,
              done: !set.done,
            }
          : set,
      ),
    );

    if (!isAuthenticated) {
      return;
    }

    try {
      await updateExerciseSet(setId, { done: !currentSet.done });
    } catch (error) {
      console.error("Failed to toggle exercise set completion:", error);
      invalidateExerciseQuery();
    }
  };

  const updateSetNotes = async (setId: string | number, notes: string) => {
    applyLocalExerciseSets((currentExerciseSets) =>
      currentExerciseSets.map((set) =>
        String(set.id) === String(setId)
          ? {
              ...set,
              notes,
            }
          : set,
      ),
    );

    if (!isAuthenticated) {
      return;
    }

    try {
      await updateExerciseSet(setId, { notes });
    } catch (error) {
      console.error("Failed to update exercise set notes:", error);
      invalidateExerciseQuery();
    }
  };

  const deleteSet = async (setId: string | number) => {
    applyLocalExerciseSets((currentExerciseSets) =>
      currentExerciseSets.filter((set) => String(set.id) !== String(setId)),
    );

    if (!isAuthenticated) {
      return;
    }

    try {
      await deleteExerciseSet(setId);
    } catch (error) {
      console.error("Failed to delete exercise set:", error);
      invalidateExerciseQuery();
    }
  };

  const addSet = async (intensityUnitId: number) => {
    if (isUnsavedExercise) {
      return;
    }

    const currentExerciseSets = exerciseSetsRef.current;
    const lastSet = currentExerciseSets[currentExerciseSets.length - 1];
    const durationPreferred = prefersDurationForIntensityUnit({
      id: intensityUnitId,
      name: "",
      abbreviation: "",
    });
    const nextDurationSeconds = lastSet
      ? (
        lastSet.duration_seconds ??
        (lastSet.reps == null && durationPreferred
          ? DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS
          : null)
      )
      : durationPreferred
        ? DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS
        : null;
    const tempId = `temp-${Date.now()}`;
    const nextSetType = currentExerciseSets.length === 0 ? "warmup" : "working";
    const nextIntensity = convertIntensityValue(
      lastSet?.intensity ?? null,
      lastSet?.intensity_unit_id,
      intensityUnitId,
    );
    const optimisticSet: ExerciseSet = {
      id: tempId,
      reps: lastSet?.reps,
      duration_seconds: nextDurationSeconds,
      intensity: nextIntensity,
      intensity_unit_id: intensityUnitId,
      exercise_id: exercise.id,
      rest_time_seconds: null,
      done: false,
      notes: null,
      type: nextSetType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    applyLocalExerciseSets((existingExerciseSets) => [
      ...existingExerciseSets,
      optimisticSet,
    ]);

    if (!isAuthenticated) {
      return;
    }

    try {
      const payload: CreateExerciseSetData = {
        reps: lastSet?.reps || 0,
        duration_seconds: nextDurationSeconds,
        intensity: nextIntensity || 0,
        intensity_unit_id: intensityUnitId,
        exercise_id: exercise.id,
        rest_time_seconds: 0,
        done: false,
        notes: undefined,
        type: nextSetType,
      };

      const createdSet = await createExerciseSet(payload);
      applyLocalExerciseSets((existingExerciseSets) =>
        existingExerciseSets.map((set) =>
          String(set.id) === String(tempId) ? createdSet : set,
        ),
      );
    } catch (error) {
      console.error("Failed to create exercise set:", error);
      invalidateExerciseQuery();
    }
  };

  const updateExerciseNotes = (notes: string) => {
    if (!onExerciseUpdate) {
      return;
    }

    const updatedExercise = {
      ...latestExerciseRef.current,
      notes,
    };

    latestExerciseRef.current = updatedExercise;
    onExerciseUpdate(updatedExercise);
  };

  const handleExerciseDelete = async () => {
    if (isUnsavedExercise) {
      return;
    }

    try {
      if (isAuthenticated) {
        await deleteExercise(exercise.id);
      } else {
        guestDeleteExercise(String(exercise.id));
      }

      onExerciseDelete?.(exercise.id);
    } catch (error) {
      console.error("Error deleting exercise:", error);
    }
  };

  return {
    addSet,
    decrementReps,
    deleteSet,
    exerciseSets,
    handleExerciseDelete,
    incrementReps,
    isAuthenticated,
    isUnsavedExercise,
    toggleSetCompletion,
    updateExerciseNotes,
    updateSetField,
    updateSetNotes,
  };
};
